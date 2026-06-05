'use strict';
/* kv.js — KV adapter layer (LocalStorage + Upstash Redis REST) v4 */

// ─── Key helpers ──────────────────────────────────────────────────────────
function buildKey(date, roomId, slot) {
  return `mrs:${date}:${roomId}:${slot}`;
}

async function hashPin(pin) {
  const buf = await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(String(pin))
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Slot helpers ─────────────────────────────────────────────────────────
function generateSlots(cfg) {
  const [oh, om] = cfg.schedule.open.split(':').map(Number);
  const [ch, cm] = cfg.schedule.close.split(':').map(Number);
  const openMins  = oh * 60 + om;
  const closeMins = ch * 60 + cm;
  const gran      = cfg.schedule.granularityMinutes;
  const result    = [];
  for (let m = openMins; m < closeMins; m += gran) {
    result.push(`${String(Math.floor(m/60)).padStart(2,'0')}${String(m%60).padStart(2,'0')}`);
  }
  return result;
}

// Advance a slot string by `gran` minutes, optionally N times
function slotPlusGran(slot, gran, times = 1) {
  const base = parseInt(slot.slice(0,2)) * 60 + parseInt(slot.slice(2));
  const m    = base + gran * times;
  return `${String(Math.floor(m/60)).padStart(2,'0')}${String(m%60).padStart(2,'0')}`;
}

// All redis keys occupied by a booking (primary + continuations)
function occupiedSlotKeys(date, roomId, primarySlot, durationSlots, gran) {
  const keys = [buildKey(date, roomId, primarySlot)];
  let cur = primarySlot;
  for (let i = 1; i < durationSlots; i++) {
    cur = slotPlusGran(cur, gran);
    keys.push(buildKey(date, roomId, cur));
  }
  return keys;
}

// Seconds until 23:59:59 Taipei time (for Redis EXPIRE)
function secondsUntilEndOfDay() {
  const taipeiStr = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' });
  const taipeiNow = new Date(taipeiStr);
  const midnight  = new Date(taipeiStr.slice(0,10) + 'T23:59:59');
  return Math.max(60, Math.floor((midnight - taipeiNow) / 1000));
}

// ─── LocalStorage Adapter ─────────────────────────────────────────────────
class LocalStorageAdapter {
  async getDay(date) {
    const cfg   = window.APP_CONFIG;
    const slots = generateSlots(cfg);
    const result = {};
    for (const room of cfg.rooms) {
      for (const slot of slots) {
        const raw = localStorage.getItem(buildKey(date, room.id, slot));
        result[`${room.id}:${slot}`] = raw ? JSON.parse(raw) : null;
      }
    }
    return result;
  }

  async getMultipleDays(dates) {
    const results = {};
    for (const date of dates) { results[date] = await this.getDay(date); }
    return results;
  }

  async book(date, roomId, slot, booking) {
    const cfg          = window.APP_CONFIG;
    const gran         = cfg.schedule.granularityMinutes;
    const durationSlots = booking.duration_slots || 1;
    const keys         = occupiedSlotKeys(date, roomId, slot, durationSlots, gran);

    for (const key of keys) {
      const existing = localStorage.getItem(key);
      if (existing !== null) {
        const parsed = JSON.parse(existing);
        if (booking._replace_id && parsed.id === booking._replace_id) continue;
        if (parsed._continuation) continue; // continuation of self during edit
        return { ok: false, reason: 'conflict' };
      }
    }

    localStorage.setItem(keys[0], JSON.stringify(booking));
    const cont = {
      _continuation: true, _primary_slot: slot,
      id: booking.id,
      owner: booking.owner || booking.booker,
      booker: booking.booker || booking.owner,
      dept: booking.dept || booking.department,
      department: booking.department || booking.dept
    };
    for (let i = 1; i < keys.length; i++) {
      localStorage.setItem(keys[i], JSON.stringify(cont));
    }
    return { ok: true };
  }

  async cancel(date, roomId, slot, pin) {
    const key = buildKey(date, roomId, slot);
    const raw = localStorage.getItem(key);
    if (raw === null) return { ok: false, reason: 'notfound' };
    const booking = JSON.parse(raw);
    if (booking._continuation) return { ok: false, reason: 'notfound' };
    if (booking.pin_hash) {
      if (!pin) return { ok: false, reason: 'pin' };
      const h = await hashPin(pin);
      if (h !== booking.pin_hash) return { ok: false, reason: 'pin' };
    }
    const cfg  = window.APP_CONFIG;
    const gran = cfg.schedule.granularityMinutes;
    const keys = occupiedSlotKeys(date, roomId, slot, booking.duration_slots || 1, gran);
    keys.forEach(k => localStorage.removeItem(k));
    return { ok: true, booking };
  }

  async appendLog(date, entry) {
    try {
      const key = `mrs:log:${date}`;
      const log = JSON.parse(localStorage.getItem(key) || '[]');
      log.push(entry);
      localStorage.setItem(key, JSON.stringify(log));
    } catch { /* best-effort */ }
  }
}

// ─── Upstash Adapter ──────────────────────────────────────────────────────
class UpstashAdapter {
  constructor(url, token) {
    this._url   = url.replace(/\/$/, '');
    this._token = token;
  }

  async _pipeline(commands) {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${this._url}/pipeline`, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${this._token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(commands),
        signal:  controller.signal
      });
      if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async getDay(date) {
    const cfg   = window.APP_CONFIG;
    const slots = generateSlots(cfg);
    const keys  = [], index = [];
    for (const room of cfg.rooms) {
      for (const slot of slots) {
        keys.push(buildKey(date, room.id, slot));
        index.push(`${room.id}:${slot}`);
      }
    }
    const [res] = await this._pipeline([['MGET', ...keys]]);
    const result = {};
    res.result.forEach((v, i) => { result[index[i]] = v ? JSON.parse(v) : null; });
    return result;
  }

  async getMultipleDays(dates) {
    const cfg   = window.APP_CONFIG;
    const slots = generateSlots(cfg);
    const commands = [], indexMap = [];
    for (const date of dates) {
      const keys = [], index = [];
      for (const room of cfg.rooms) {
        for (const slot of slots) {
          keys.push(buildKey(date, room.id, slot));
          index.push(`${room.id}:${slot}`);
        }
      }
      commands.push(['MGET', ...keys]);
      indexMap.push({ date, index });
    }
    const results = await this._pipeline(commands);
    const out = {};
    results.forEach((res, i) => {
      const { date, index } = indexMap[i];
      const dayResult = {};
      (res.result || []).forEach((v, j) => { dayResult[index[j]] = v ? JSON.parse(v) : null; });
      out[date] = dayResult;
    });
    return out;
  }

  async book(date, roomId, slot, booking) {
    const cfg           = window.APP_CONFIG;
    const gran          = cfg.schedule.granularityMinutes;
    const durationSlots = booking.duration_slots || 1;
    const ttl           = String(secondsUntilEndOfDay());
    const primaryKey    = buildKey(date, roomId, slot);

    const commands = [['SET', primaryKey, JSON.stringify(booking), 'NX', 'EX', ttl]];
    const cont = JSON.stringify({
      _continuation: true, _primary_slot: slot, id: booking.id,
      owner: booking.owner || booking.booker,
      booker: booking.booker || booking.owner,
      dept: booking.dept || booking.department,
      department: booking.department || booking.dept
    });
    let cur = slot;
    for (let i = 1; i < durationSlots; i++) {
      cur = slotPlusGran(cur, gran);
      commands.push(['SET', buildKey(date, roomId, cur), cont, 'EX', ttl]);
    }

    const results = await this._pipeline(commands);
    if (results[0].result !== 'OK') return { ok: false, reason: 'conflict' };
    return { ok: true };
  }

  async cancel(date, roomId, slot, pin) {
    const key = buildKey(date, roomId, slot);
    const [getRes] = await this._pipeline([['GET', key]]);
    if (getRes.result === null) return { ok: false, reason: 'notfound' };
    const booking = JSON.parse(getRes.result);
    if (booking._continuation) return { ok: false, reason: 'notfound' };
    if (booking.pin_hash) {
      if (!pin) return { ok: false, reason: 'pin' };
      const h = await hashPin(pin);
      if (h !== booking.pin_hash) return { ok: false, reason: 'pin' };
    }
    const cfg  = window.APP_CONFIG;
    const gran = cfg.schedule.granularityMinutes;
    const keys = occupiedSlotKeys(date, roomId, slot, booking.duration_slots || 1, gran);
    const [delRes] = await this._pipeline([['DEL', ...keys]]);
    return { ok: delRes.result >= 1, booking };
  }

  async appendLog(date, entry) {
    try {
      await this._pipeline([['RPUSH', `mrs:log:${date}`, JSON.stringify(entry)]]);
    } catch { /* best-effort */ }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────
function createAdapter() {
  const cfg = window.APP_CONFIG;
  if (!cfg) throw new Error('APP_CONFIG not loaded');
  if (cfg.provider === 'upstash') {
    const { restUrl, restToken } = cfg.upstash || {};
    if (!restUrl || !restToken || restUrl.startsWith('YOUR_')) {
      throw new Error('請在 config.js 填入真實的 Upstash restUrl / restToken');
    }
    return new UpstashAdapter(restUrl, restToken);
  }
  return new LocalStorageAdapter();
}
