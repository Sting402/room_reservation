'use strict';
/* kv.js — KV adapter layer (LocalStorage + Upstash Redis REST) */

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

// ─── Slot generation ──────────────────────────────────────────────────────
function generateSlots(cfg) {
  const [oh, om] = cfg.schedule.open.split(':').map(Number);
  const [ch, cm] = cfg.schedule.close.split(':').map(Number);
  const openMins  = oh * 60 + om;
  const closeMins = ch * 60 + cm;
  const gran      = cfg.schedule.granularityMinutes;
  const slots     = [];
  for (let m = openMins; m < closeMins; m += gran) {
    const h   = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, '0')}${String(min).padStart(2, '0')}`);
  }
  return slots; // e.g. ["0900","0930",...,"1730"]
}

// Seconds until 23:59:59 Taipei time (for Redis EXPIRE)
function secondsUntilEndOfDay() {
  const taipeiStr = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' });
  const taipeiNow = new Date(taipeiStr);
  const midnight  = new Date(taipeiStr.slice(0, 10) + 'T23:59:59');
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

  async book(date, roomId, slot, booking) {
    const key = buildKey(date, roomId, slot);
    if (localStorage.getItem(key) !== null) return { ok: false, reason: 'conflict' };
    localStorage.setItem(key, JSON.stringify(booking));
    return { ok: true };
  }

  async cancel(date, roomId, slot, pin) {
    const key = buildKey(date, roomId, slot);
    const raw = localStorage.getItem(key);
    if (raw === null) return { ok: false, reason: 'notfound' };
    const booking = JSON.parse(raw);
    if (booking.pin_hash) {
      if (!pin) return { ok: false, reason: 'pin' };
      const h = await hashPin(pin);
      if (h !== booking.pin_hash) return { ok: false, reason: 'pin' };
    }
    localStorage.removeItem(key);
    return { ok: true };
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
    const timeout = setTimeout(() => controller.abort(), 8000);
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
    const keys  = [];
    const index = [];
    for (const room of cfg.rooms) {
      for (const slot of slots) {
        keys.push(buildKey(date, room.id, slot));
        index.push(`${room.id}:${slot}`);
      }
    }
    const [res] = await this._pipeline([['MGET', ...keys]]);
    const values = res.result; // array, same length as keys
    const result = {};
    values.forEach((v, i) => {
      result[index[i]] = v ? JSON.parse(v) : null;
    });
    return result;
  }

  async book(date, roomId, slot, booking) {
    const key   = buildKey(date, roomId, slot);
    const value = JSON.stringify(booking);
    const ttl   = String(secondsUntilEndOfDay());
    const [res] = await this._pipeline([['SET', key, value, 'NX', 'EX', ttl]]);
    if (res.result === 'OK')   return { ok: true };
    if (res.result === null)   return { ok: false, reason: 'conflict' };
    throw new Error('Unexpected SET NX result: ' + res.result);
  }

  async cancel(date, roomId, slot, pin) {
    const key = buildKey(date, roomId, slot);
    const [getRes] = await this._pipeline([['GET', key]]);
    if (getRes.result === null) return { ok: false, reason: 'notfound' };
    const booking = JSON.parse(getRes.result);
    if (booking.pin_hash) {
      if (!pin) return { ok: false, reason: 'pin' };
      const h = await hashPin(pin);
      if (h !== booking.pin_hash) return { ok: false, reason: 'pin' };
    }
    const [delRes] = await this._pipeline([['DEL', key]]);
    return { ok: delRes.result >= 1 };
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
