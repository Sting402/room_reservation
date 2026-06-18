'use strict';
/* kv.js — KV adapter layer (LocalStorage + Upstash Redis REST) v5
   A1: TTL computed from booking date, not today.
   A2: Multi-slot writes are atomic via Lua EVAL (all-or-nothing, NX on every slot).
   A3: Edit is an atomic replace — no cancel-first; _replace_id never persisted. */

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

// A1 fix: TTL to 23:59:59 of the booking's own date (Asia/Taipei = UTC+8)
function secondsUntilEndOfDate(dateStr) {
  const endOfDay = new Date(dateStr + 'T23:59:59+08:00');
  return Math.max(60, Math.floor((endOfDay - Date.now()) / 1000));
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

  // opts: { replaceId?: string, oldKeys?: string[] }
  async book(date, roomId, slot, booking, opts = {}) {
    const cfg          = window.APP_CONFIG;
    const gran         = cfg.schedule.granularityMinutes;
    const durationSlots = booking.duration_slots || 1;
    const newKeys      = occupiedSlotKeys(date, roomId, slot, durationSlots, gran);
    const replaceId    = opts.replaceId || null;

    // A2+A3: check every target key is free (or belongs to booking being replaced)
    for (const key of newKeys) {
      const existing = localStorage.getItem(key);
      if (existing !== null) {
        const parsed = JSON.parse(existing);
        if (replaceId && parsed.id === replaceId) continue;
        return { ok: false, reason: 'conflict' };
      }
    }

    // A3: atomically remove old keys before writing new ones
    if (opts.oldKeys && opts.oldKeys.length > 0) {
      opts.oldKeys.forEach(k => localStorage.removeItem(k));
    }

    localStorage.setItem(newKeys[0], JSON.stringify(booking));
    const cont = {
      _continuation: true, _primary_slot: slot,
      id: booking.id,
      owner: booking.owner || booking.booker,
      booker: booking.booker || booking.owner,
      dept: booking.dept || booking.department,
      department: booking.department || booking.dept
    };
    for (let i = 1; i < newKeys.length; i++) {
      localStorage.setItem(newKeys[i], JSON.stringify(cont));
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

// A2+A3: Lua script for atomic multi-slot book / atomic replace.
// ARGV layout (all strings, numkeys=0):
//   [1]  replace_id  — booking id being replaced, or "" for new booking
//   [2]  ttl         — seconds (string)
//   [3]  num_old     — number of old keys to delete (0 for new booking)
//   [4 .. 3+num_old] — old keys
//   [4+num_old]      — num_new  (number of new keys)
//   [5+num_old .. 4+num_old+num_new]          — new keys
//   [5+num_old+num_new .. 4+num_old+2*num_new] — new values (one per new key)
//
// Returns "ok" or "conflict".
const BOOK_LUA = `
local replace_id = ARGV[1]
local ttl        = tonumber(ARGV[2])
local num_old    = tonumber(ARGV[3])
local old_keys   = {}
for i = 1, num_old do old_keys[i] = ARGV[3 + i] end
local base_new   = 3 + num_old
local num_new    = tonumber(ARGV[base_new + 1])
local new_keys   = {}
local new_vals   = {}
for i = 1, num_new do
  new_keys[i] = ARGV[base_new + 1 + i]
  new_vals[i] = ARGV[base_new + 1 + num_new + i]
end
for i = 1, num_new do
  local v = redis.call('GET', new_keys[i])
  if v then
    if replace_id == '' then return 'conflict' end
    local ok, parsed = pcall(cjson.decode, v)
    if ok and parsed and parsed.id == replace_id then
      -- belongs to booking being replaced; treat as free
    else
      return 'conflict'
    end
  end
end
for i = 1, num_old do redis.call('DEL', old_keys[i]) end
for i = 1, num_new do
  redis.call('SET', new_keys[i], new_vals[i], 'EX', ttl)
end
return 'ok'
`.trim();

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

  async _eval(script, args) {
    const [res] = await this._pipeline([['EVAL', script, 0, ...args]]);
    if (res.error) throw new Error('Upstash EVAL error: ' + res.error);
    return res.result;
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

  // A1+A2+A3: single atomic Lua write; opts = { replaceId?, oldKeys? }
  async book(date, roomId, slot, booking, opts = {}) {
    const cfg           = window.APP_CONFIG;
    const gran          = cfg.schedule.granularityMinutes;
    const durationSlots = booking.duration_slots || 1;
    const ttl           = String(secondsUntilEndOfDate(date)); // A1 fix
    const newKeys       = occupiedSlotKeys(date, roomId, slot, durationSlots, gran);
    const replaceId     = opts.replaceId || '';
    const oldKeys       = opts.oldKeys   || [];

    const primaryVal = JSON.stringify(booking);
    const contVal    = JSON.stringify({
      _continuation: true, _primary_slot: slot, id: booking.id,
      owner: booking.owner || booking.booker,
      booker: booking.booker || booking.owner,
      dept: booking.dept || booking.department,
      department: booking.department || booking.dept
    });
    const newVals = newKeys.map((_, i) => i === 0 ? primaryVal : contVal);

    const args = [
      replaceId, ttl, String(oldKeys.length), ...oldKeys,
      String(newKeys.length), ...newKeys, ...newVals
    ];

    const result = await this._eval(BOOK_LUA, args);
    if (result === 'ok')       return { ok: true };
    if (result === 'conflict') return { ok: false, reason: 'conflict' };
    throw new Error('Unexpected EVAL result: ' + result);
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
