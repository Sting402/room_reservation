'use strict';
/* app.js — Meeting Room Scheduler v6
   Supports: variable duration, first-name identity, department + project/region,
   range-based conflict, door-card detail view, cancel-with-reason, CSV export */

// ─── Constants ────────────────────────────────────────────────────────────
// Department options — edit in config.identity.deptOptions or here
const DEPT_OPTIONS = ['設計部', '業務部', '品保部', '財務部', '倉管部', '主管會議', '其他'];

// Duration options — value, label, and how to resolve start/end
// For fixed half-day/full-day, fixedStart overrides the clicked slot.
// NOTE: 下午半天 spec is 13:30–18:00 but with 60-min granularity the
//       nearest whole-hour start is 13:00. Documented limitation.
// NOTE: 全天 spec is 08:30–18:00 but first slot is 08:00. Using 08:00.
const DURATION_OPTIONS = [
  { value: '1h',             label: '1 小時',   slots: 1 },
  { value: '2h',             label: '2 小時',   slots: 2 },
  { value: '3h',             label: '3 小時',   slots: 3 },
  { value: '4h',             label: '4 小時',   slots: 4 },
  { value: 'morning_half',   label: '上午半天', slots: 4,  fixedStart: '0800', fixedEnd: '12:00' },
  { value: 'afternoon_half', label: '下午半天', slots: 5,  fixedStart: '1300', fixedEnd: '18:00' },
  { value: 'full_day',       label: '全天',     slots: 10, fixedStart: '0800', fixedEnd: '18:00' },
];

// ─── Identity / name normalization ───────────────────────────────────────
/**
 * Normalize a name input to a lookup key.
 * - English: lowercase + remove all spaces (so "Alex C" = "AlexC" = "alexc")
 * - Chinese / non-ASCII: trim + collapse spaces, keep exact characters
 */
function normalizeName(raw) {
  if (!raw) return '';
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (/[^\x00-\x7F]/.test(trimmed)) return trimmed; // Chinese: exact after trim
  return trimmed.toLowerCase().replace(/\s/g, '');   // English: lowercase + no spaces
}

/**
 * Resolve user's typed name to the canonical displayName from config.
 * Falls back to cleaned input if no alias matches.
 */
function resolveDisplayName(input) {
  const cleaned = (input || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  const key = normalizeName(cleaned);
  const id  = window.APP_CONFIG?.identity;
  if (id?.aliasesEnabled && Array.isArray(id.aliases)) {
    for (const entry of id.aliases) {
      const aliasArr = Array.isArray(entry.aliases) ? entry.aliases
                     : (entry.keys ? entry.keys : []);
      for (const alias of aliasArr) {
        if (normalizeName(alias) === key) return entry.displayName;
      }
    }
  }
  return cleaned; // unknown name: use cleaned input as-is
}

/**
 * Validate identity config for duplicate normalized keys (warn, don't crash).
 */
function validateIdentityConfig() {
  const id = window.APP_CONFIG?.identity;
  if (!id?.aliasesEnabled || !Array.isArray(id.aliases)) return;
  const seen = {};
  for (const entry of id.aliases) {
    const aliasArr = Array.isArray(entry.aliases) ? entry.aliases
                   : (entry.keys ? entry.keys : []);
    for (const alias of aliasArr) {
      const key = normalizeName(alias);
      if (seen[key] && seen[key] !== entry.displayName) {
        console.warn(`[identity] Duplicate normalized key "${key}": "${seen[key]}" and "${entry.displayName}"`);
      }
      seen[key] = entry.displayName;
    }
  }
}

// ─── State ────────────────────────────────────────────────────────────────
let adapter      = null;
let slots        = [];       // ["0800","0900",...] from config
let todayDate    = '';
let selectedDate = '';
let dayData      = {};       // {"glass1:0900": booking|null, ...}
let pollTimer    = null;
let clockTimer   = null;
let nowLineTimer = null;
let currentView  = 'dashboard';
let syncState    = 'syncing';
let isLoading    = false;
let pendingBook  = null;     // {roomId, slot, editing?:{originalSlot, originalBooking}}
let pendingCancel = null;    // {roomId, slot, booking}
let kioskRoomId  = null;

// ─── Bootstrap ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

function init() {
  if (window.__configMissing || !window.APP_CONFIG) { showConfigError(); return; }
  try {
    adapter      = createAdapter();
    slots        = generateSlots(window.APP_CONFIG);
    todayDate    = getTaipeiDate();
    selectedDate = todayDate;
    validateIdentityConfig();
  } catch (e) { showFatalError(e.message); return; }

  const params    = new URLSearchParams(location.search);
  const roomParam = params.get('room');
  const isKiosk   = params.get('kiosk') === '1';

  if (isKiosk && roomParam) initKiosk(roomParam);
  else                      initApp(roomParam);
}

// ─── Date helpers ─────────────────────────────────────────────────────────
function getCurrentYearRange() {
  const year = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }).slice(0,4);
  return { min: `${year}-01-01`, max: `${year}-12-31`, year };
}
function isValidDateInCurrentYear(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const { min, max } = getCurrentYearRange();
  return d >= min && d <= max;
}
function compareDateToToday(dateStr) {
  if (dateStr < todayDate) return 'past';
  if (dateStr > todayDate) return 'future';
  return 'today';
}
function isSlotPast(slot) {
  const rel = compareDateToToday(selectedDate);
  if (rel === 'past')   return true;
  if (rel === 'future') return false;
  const gran = window.APP_CONFIG.schedule.granularityMinutes;
  return (slotToMins(slot) + gran) <= getTaipeiNowMins();
}
function loadSavedDate() {
  try { const s = localStorage.getItem('mrs:selectedDate'); return s && isValidDateInCurrentYear(s) ? s : null; } catch { return null; }
}
function saveSelectedDate(d) { try { localStorage.setItem('mrs:selectedDate', d); } catch {} }
function getTomorrowDate() {
  const d = new Date(todayDate + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
}
function normalizeDateInput(str) {
  if (!str) return '';
  const m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (!m) return str;
  return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
}
function isSelectedDateToday()  { return compareDateToToday(selectedDate) === 'today'; }
function isSelectedDatePast()   { return compareDateToToday(selectedDate) === 'past'; }
function isSelectedDateFuture() { return compareDateToToday(selectedDate) === 'future'; }

// Get dates for current week (Mon–Sun containing today)
function getThisWeekDates() {
  const tai  = getTaipeiDate();
  const base = new Date(tai + 'T00:00:00+08:00');
  const dow  = base.getDay(); // 0=Sun,1=Mon,...
  const mon  = new Date(base);
  mon.setDate(base.getDate() - (dow === 0 ? 6 : dow - 1));
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    dates.push(d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }));
  }
  return dates;
}

// ─── Booking range helpers ─────────────────────────────────────────────────
function getDurationOption(value) {
  return DURATION_OPTIONS.find(o => o.value === value) || DURATION_OPTIONS[0];
}

// Compute {startSlot, endTime, durationSlots, durationType, startTime}
function computeRange(clickedSlot, durationValue) {
  const cfg  = window.APP_CONFIG;
  const gran = cfg.schedule.granularityMinutes;
  const opt  = getDurationOption(durationValue);

  const startSlot  = opt.fixedStart || clickedSlot;
  const numSlots   = opt.slots;
  const startMins  = slotToMins(startSlot);
  const endMins    = opt.fixedEnd
    ? (parseInt(opt.fixedEnd.split(':')[0]) * 60 + parseInt(opt.fixedEnd.split(':')[1]))
    : startMins + numSlots * gran;
  const endTime    = `${String(Math.floor(endMins/60)).padStart(2,'0')}:${String(endMins%60).padStart(2,'0')}`;
  const startTime  = `${startSlot.slice(0,2)}:${startSlot.slice(2)}`;
  return { startSlot, startTime, endTime, durationSlots: numSlots, durationType: durationValue };
}

// ─── Conflict + warning engine ────────────────────────────────────────────
// Returns true if same-room overlap exists (hard block)
function hasConflict(roomId, startSlot, durationSlots, excludeSlot = null) {
  const gran     = window.APP_CONFIG.schedule.granularityMinutes;
  const newStart = slotToMins(startSlot);
  const newEnd   = newStart + durationSlots * gran;
  for (const slot of slots) {
    if (slot === excludeSlot) continue;
    const b = dayData[`${roomId}:${slot}`];
    if (!b || b._continuation) continue;
    const bStart = slotToMins(slot);
    const bEnd   = bStart + (b.duration_slots || 1) * gran;
    if (newStart < bEnd && newEnd > bStart) return true;
  }
  return false;
}

// Returns array of warning strings (non-blocking)
function collectWarnings(roomId, startSlot, durationSlots, booker, dept, people) {
  const cfg      = window.APP_CONFIG;
  const gran     = cfg.schedule.granularityMinutes;
  const room     = cfg.rooms.find(r => r.id === roomId);
  const newStart = slotToMins(startSlot);
  const newEnd   = newStart + durationSlots * gran;
  const warnings = [];

  // Capacity
  if (room?.capacity && people > 0 && people > room.capacity) {
    warnings.push(`⚠ 人數（${people}）超過會議室容量（${room.capacity} 人）`);
  }
  // Buffer for 展間會議室
  if (roomId === 'showroom') {
    warnings.push('⚠ 展間會議室建議預留佈置準備時間');
  }
  // Lunch crossing
  const lunchStart = 12 * 60, lunchEnd = 13 * 60 + 30;
  if (newStart < lunchEnd && newEnd > lunchStart) {
    warnings.push('⚠ 此預約包含午休時段（12:00–13:30）');
  }
  // Same booker / same dept overlap in different room
  const bookerKey = normalizeName(booker);
  for (const otherRoom of cfg.rooms) {
    if (otherRoom.id === roomId) continue;
    for (const slot of slots) {
      const b = dayData[`${otherRoom.id}:${slot}`];
      if (!b || b._continuation) continue;
      const bStart = slotToMins(slot);
      const bEnd   = bStart + (b.duration_slots || 1) * gran;
      if (newStart < bEnd && newEnd > bStart) {
        const bBooker = b.booker || b.owner || '';
        const bDept   = getDept(b);
        if (bookerKey && normalizeName(bBooker) === bookerKey) {
          warnings.push(`⚠ ${booker} 同時段在 ${otherRoom.name} 也有預約`);
        }
        if (dept && bDept && bDept === dept) {
          warnings.push(`⚠ ${dept} 同時段在 ${otherRoom.name} 也有預約`);
        }
      }
    }
  }
  return [...new Set(warnings)];
}

// ─── Booking record factory ───────────────────────────────────────────────
function makeBookingRecord({ roomId, startSlot, startTime, endTime, durationSlots, durationType,
                              title, booker, department, project_region, people, notes, pinHash }) {
  const cfg  = window.APP_CONFIG;
  const room = cfg.rooms.find(r => r.id === roomId);
  return {
    id:             crypto.randomUUID ? crypto.randomUUID() : `b-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    room_id:        roomId,
    room_name:      room?.name || roomId,
    date:           selectedDate,
    start_time:     startTime,
    end_time:       endTime,
    start_slot:     startSlot,
    duration_type:  durationType,
    duration_slots: durationSlots,
    title:          title || '',
    booker:         booker,
    owner:          booker,          // backward compat alias
    department:     department || '',
    dept:           department || '', // backward compat alias
    project_region: project_region || '',
    people:         people || 0,
    notes:          notes || '',
    purpose:        title || '',     // backward compat alias
    status:         'active',
    created_at:     new Date().toISOString(),
    updated_at:     null,
    cancelled_at:   null,
    cancelled_by:   null,
    cancel_reason:  null,
    is_override:    false,
    override_reason: null,
    pin_hash:       pinHash || null,
    schema_v:       3
  };
}

// Backward compat: get endTime from old-schema bookings (schema_v 1 or missing)
function getEndTime(slot, booking) {
  if (booking.end_time) return booking.end_time;
  if (booking.slot_end) return booking.slot_end;
  // Fallback: slot + 1 hour
  const gran = window.APP_CONFIG.schedule.granularityMinutes;
  const m = slotToMins(slot) + (booking.duration_slots || 1) * gran;
  return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}
function getDurationSlots(booking) { return booking.duration_slots || 1; }
function getBooker(booking)        { return booking.booker || booking.owner || ''; }
function getDept(booking)          { return booking.department || booking.dept || ''; }
function getProjectRegion(booking) { return booking.project_region || ''; }
function getTitle(booking)         { return booking.title || booking.purpose || ''; }

// ─── Kiosk mode ───────────────────────────────────────────────────────────
function initKiosk(roomId) {
  kioskRoomId = roomId;
  document.getElementById('kiosk-view').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  startClock('kiosk-clock');
  loadAndRenderKiosk();
  pollTimer = setInterval(loadAndRenderKiosk, (window.APP_CONFIG.pollIntervalSeconds || 10) * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInterval(pollTimer);
    else { loadAndRenderKiosk(); pollTimer = setInterval(loadAndRenderKiosk, (window.APP_CONFIG.pollIntervalSeconds || 10) * 1000); }
  });
}
async function loadAndRenderKiosk() {
  document.getElementById('kiosk-sync').textContent = '正在同步…';
  try {
    const kioskDate = getTaipeiDate();
    dayData = await adapter.getDay(kioskDate);
    renderKiosk(kioskDate);
    document.getElementById('kiosk-sync').textContent = '已同步 · ' + new Date().toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
  } catch {
    document.getElementById('kiosk-sync').textContent = '目前無法同步';
  }
}
function renderKiosk(kioskDate) {
  const cfg  = window.APP_CONFIG;
  const room = cfg.rooms.find(r => r.id === kioskRoomId);
  if (!room) return;
  const savedSel = selectedDate;
  selectedDate = kioskDate || getTaipeiDate();
  const status = getRoomStatus(kioskRoomId);
  selectedDate = savedSel;
  document.getElementById('kiosk-room-name').textContent   = room.name;
  document.getElementById('kiosk-icon').textContent        = status.icon;
  document.getElementById('kiosk-status-text').textContent = status.text;
  let infoText = '', nextText = '';
  if (status.state === 'busy' && status.booking) {
    infoText = '會議進行中';
  }
  if (status.nextSlot) {
    nextText = `下一場：${slotLabel(status.nextSlot)}`;
  }
  document.getElementById('kiosk-booking-info').textContent = infoText;
  document.getElementById('kiosk-next').textContent         = nextText;
  document.querySelector('.kiosk-inner').className          = `kiosk-inner state-${status.state}`;
}

// ─── Normal app init ──────────────────────────────────────────────────────
function initApp(roomParam) {
  startClock('live-clock');
  bindViewNav();
  initDatePicker();
  populateDeptDropdown();
  bindBookForm();
  bindDetailModal();
  renderDashboard();
  renderManage();
  wireOffline();
  if (roomParam) highlightRoom(roomParam);
  load();
  startPolling();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopPolling();
    else { load(); startPolling(); }
  });
  document.getElementById('manage-refresh-btn').addEventListener('click', load);
  document.getElementById('sync-pill').addEventListener('click', () => {
    if (syncState === 'failed') load();
  });
  // CSV export buttons
  document.getElementById('export-today-btn')?.addEventListener('click', () => exportCSV('today'));
  document.getElementById('export-week-btn')?.addEventListener('click',  () => exportCSV('week'));
}


// ─── Dept dropdown ────────────────────────────────────────────────────────
function populateDeptDropdown() {
  const sel = document.getElementById('f-dept');
  if (!sel || sel.tagName !== 'SELECT') return;
  const opts = window.APP_CONFIG?.identity?.deptOptions || DEPT_OPTIONS;
  sel.innerHTML = '<option value="">請選擇部門</option>';
  opts.forEach(d => {
    const o = document.createElement('option');
    o.value = d; o.textContent = d;
    sel.appendChild(o);
  });
}

// ─── Date picker ──────────────────────────────────────────────────────────
function initDatePicker() {
  const { min, max } = getCurrentYearRange();
  const input = document.getElementById('date-input');
  input.min = min; input.max = max; input.value = selectedDate;
  updateDateDisplay();
  input.addEventListener('change', () => {
    const v = input.value;
    if (!v) return;
    if (!isValidDateInCurrentYear(v)) {
      showToast('超出營業時間範圍，請選擇本年度日期', 'error');
      input.value = selectedDate; return;
    }
    onDateChange(v);
  });
  document.getElementById('btn-today').addEventListener('click',    () => onDateChange(todayDate));
  document.getElementById('btn-tomorrow').addEventListener('click', () => {
    const tm = getTomorrowDate();
    if (!isValidDateInCurrentYear(tm)) { showToast('已是本年最後一天', 'warn'); return; }
    onDateChange(tm);
  });
}

function onDateChange(newDate) {
  const normalized = normalizeDateInput(newDate);
  if (!isValidDateInCurrentYear(normalized)) { showToast('請選擇本年度日期', 'error'); return; }
  selectedDate = normalized;
  saveSelectedDate(normalized);
  document.getElementById('date-input').value = normalized;
  updateDateDisplay();
  dayData = {};
  isLoading = false;
  renderDashboard();
  load();
}

function updateDateDisplay() {
  const label        = document.getElementById('date-label');
  const rel          = compareDateToToday(selectedDate);
  const dateFormatted = new Date(selectedDate + 'T12:00:00+08:00')
    .toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  const todayBtn    = document.getElementById('btn-today');
  const tomorrowBtn = document.getElementById('btn-tomorrow');
  todayBtn.classList.toggle('active',    selectedDate === todayDate);
  tomorrowBtn.classList.toggle('active', selectedDate === getTomorrowDate());
  if (rel === 'today')        { label.textContent = `📅 ${dateFormatted}（今天）`;           label.className = 'date-label is-today'; }
  else if (rel === 'future')  { label.textContent = `📅 ${dateFormatted}`;                   label.className = 'date-label is-future'; }
  else                        { label.textContent = `📋 ${dateFormatted}（過去記錄，僅供查閱）`; label.className = 'date-label is-past'; }
  // Update schedule section heading
  const heading = document.querySelector('#today-schedule-section .section-heading');
  if (heading) heading.textContent = rel === 'today' ? '今日時段表' : '時段表';
}

// ─── Clock ────────────────────────────────────────────────────────────────
function startClock(elId) {
  function tick() {
    const el = document.getElementById(elId);
    if (el) el.textContent = new Date().toLocaleTimeString('zh-TW',
      { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  tick(); clockTimer = setInterval(tick, 1000);
}

// ─── Sync pill ────────────────────────────────────────────────────────────
const SYNC_LABELS = { synced: '已同步', syncing: '同步中…', failed: '同步失敗，點此重試' };
function setSyncState(state) {
  syncState = state;
  const pill = document.getElementById('sync-pill');
  pill.className = `sync-pill sync-${state}`;
  pill.querySelector('.sync-label').textContent = SYNC_LABELS[state];
}

// ─── View navigation ──────────────────────────────────────────────────────
function bindViewNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}
function switchView(view) {
  currentView = view;
  document.querySelectorAll('.nav-btn').forEach(b => {
    const active = b.dataset.view === view;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
  });
  ['dashboard','manage','week'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) { el.classList.toggle('active', v === view); el.classList.toggle('hidden', v !== view); }
  });
  if (view === 'manage') renderManage();
  if (view === 'week')   renderWeekList();
}

// ─── Room status ──────────────────────────────────────────────────────────
function getRoomStatus(roomId) {
  const cfg      = window.APP_CONFIG;
  const gran     = cfg.schedule.granularityMinutes;
  const [oh, om] = cfg.schedule.open.split(':').map(Number);
  const [ch, cm] = cfg.schedule.close.split(':').map(Number);
  const openMins = oh * 60 + om, closeMins = ch * 60 + cm;
  const rel      = compareDateToToday(selectedDate);

  if (rel === 'past') {
    const cnt = slots.filter(s => { const b = dayData[`${roomId}:${s}`]; return b && !b._continuation; }).length;
    return { state: 'closed', icon: '–', text: '過去日期，僅供查閱', sub: cnt ? `${cnt} 筆預約記錄` : '無預約記錄' };
  }
  if (rel === 'future') {
    // Count free primary slots (not covered by any booking)
    const covered = new Set();
    slots.forEach(s => {
      const b = dayData[`${roomId}:${s}`];
      if (!b || b._continuation) return;
      const ds = getDurationSlots(b);
      for (let i = 0; i < ds; i++) {
        const sm = slotToMins(s) + i * gran;
        const ss = `${String(Math.floor(sm/60)).padStart(2,'0')}${String(sm%60).padStart(2,'0')}`;
        covered.add(ss);
      }
    });
    const free = slots.filter(s => !covered.has(s)).length;
    if (free === 0) return { state: 'busy', icon: '✕', text: '全天已滿', sub: '無空檔', nextSlot: null };
    return { state: 'available', icon: '●', text: '可預約', sub: `${free} 個空檔`, nextSlot: null };
  }

  // Today
  const nowMins = getTaipeiNowMins();
  if (nowMins < openMins || nowMins >= closeMins) {
    return { state: 'closed', icon: '–', text: nowMins < openMins ? '尚未開放' : '今日已結束', sub: '超出營業時間' };
  }
  // Currently in a booked slot? (handles continuation slots by following to primary)
  for (const slot of slots) {
    const sm = slotToMins(slot);
    if (nowMins >= sm && nowMins < sm + gran) {
      let b = dayData[`${roomId}:${slot}`];
      let primarySlot = slot;
      if (b && b._continuation && b._primary_slot) {
        primarySlot = b._primary_slot;
        b = dayData[`${roomId}:${primarySlot}`] || null;
      }
      if (b && !b._continuation) {
        const endT = getEndTime(primarySlot, b);
        const nextFree = slots.find(s => slotToMins(s) >= slotToMins(primarySlot) + getDurationSlots(b) * gran && !dayData[`${roomId}:${s}`]);
        return { state: 'busy', icon: '✕', text: `使用中，到 ${endT}`, sub: '會議進行中', booking: b, slot: primarySlot, nextFreeSlot: nextFree };
      }
    }
  }
  // Soon (next booking within 30 min)
  for (const slot of slots) {
    const sm = slotToMins(slot);
    if (sm > nowMins && sm <= nowMins + 30) {
      const b = dayData[`${roomId}:${slot}`];
      if (b && !b._continuation) {
        return { state: 'soon', icon: '▲', text: `${slotLabel(slot)} 即將開始`, sub: '即將開始', booking: b, slot };
      }
    }
  }
  // Available
  const freeCount  = slots.filter(s => slotToMins(s) >= nowMins && slotToMins(s) < closeMins && !dayData[`${roomId}:${s}`]).length;
  const nextBooked = slots.find(s => slotToMins(s) > nowMins && dayData[`${roomId}:${s}`] && !dayData[`${roomId}:${s}`]?._continuation) || null;
  return { state: 'available', icon: '●', text: '可使用', sub: freeCount > 0 ? `今天還有 ${freeCount} 個空檔` : '今天空檔已滿', nextSlot: nextBooked };
}

function findNextBooked(roomId, afterMins) {
  return slots.find(s => slotToMins(s) > afterMins && dayData[`${roomId}:${s}`] && !dayData[`${roomId}:${s}`]?._continuation) || null;
}

// ─── Dashboard ────────────────────────────────────────────────────────────
function renderDashboard() {
  renderRoomCards();
  renderTimeline();
  updateNowLine();
  if (nowLineTimer) clearInterval(nowLineTimer);
  nowLineTimer = setInterval(updateNowLine, 30000);
}

function renderRoomCards() {
  const cfg  = window.APP_CONFIG;
  const grid = document.getElementById('room-status-grid');
  grid.innerHTML = '';
  cfg.rooms.forEach(room => grid.appendChild(buildRoomCard(room, getRoomStatus(room.id))));
}

function buildRoomCard(room, status) {
  const rel = compareDateToToday(selectedDate);
  const el  = document.createElement('div');
  el.className = `room-card state-${status.state}`;
  el.id = `card-${room.id}`;
  const dateStr = new Date(selectedDate + 'T12:00:00+08:00')
    .toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', weekday: 'short' });
  const actions = getCardActions(room.id, status, rel);
  const cap = window.APP_CONFIG.rooms.find(r => r.id === room.id)?.capacity;
  const capStr = cap ? ` · 容量 ${cap} 人` : '';

  el.innerHTML = `
    <div class="room-card-stripe" aria-hidden="true"></div>
    <div class="room-card-body">
      <div class="room-card-top">
        <div>
          <div class="room-card-name">${escHtml(room.name)}</div>
          <div class="room-card-date">${escHtml(dateStr)}${escHtml(capStr)}</div>
        </div>
        <div class="status-badge">
          <span class="status-icon" aria-hidden="true">${status.icon}</span>
          <span>${statusLabel(status.state)}</span>
        </div>
      </div>
      <div class="room-card-status-text">${escHtml(status.text)}</div>
      <div class="room-card-sub">${escHtml(status.sub || '')}</div>
      <div class="room-card-actions" id="actions-${room.id}"></div>
    </div>`;

  const actionsEl = el.querySelector(`#actions-${room.id}`);
  actions.forEach(({ label, cls, handler }) => {
    const btn = document.createElement('button');
    btn.className = `btn btn-sm ${cls}`;
    btn.textContent = label;
    btn.addEventListener('click', handler);
    actionsEl.appendChild(btn);
  });
  return el;
}

function statusLabel(state) {
  return { available: '可使用', busy: '使用中', soon: '即將開始', closed: '已關閉' }[state] || state;
}

function getCardActions(roomId, status, rel) {
  if (rel === 'past') return [];
  const actions = [];
  if (status.state === 'available') {
    actions.push({ label: '立即預約', cls: 'btn-primary', handler: () => openBookModalForRoom(roomId) });
    actions.push({ label: '查看時段', cls: 'btn-ghost',   handler: scrollToTimeline });
  } else if (status.state === 'busy') {
    actions.push({ label: '查看時段', cls: 'btn-ghost', handler: scrollToTimeline });
    if (status.nextFreeSlot) {
      actions.push({ label: '預約下一個空檔', cls: 'btn-secondary', handler: () => openBookModal(roomId, status.nextFreeSlot) });
    }
  } else if (status.state === 'soon') {
    if (status.booking && status.slot) {
      actions.push({ label: '查看詳情',     cls: 'btn-ghost',     handler: () => openDetailModal(roomId, status.slot, status.booking) });
    }
    actions.push({ label: '改約其他時段', cls: 'btn-secondary', handler: () => openBookModalForRoom(roomId) });
  }
  return actions;
}

function scrollToTimeline() {
  document.getElementById('today-schedule-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Timeline ─────────────────────────────────────────────────────────────
function renderTimeline() {
  const cfg  = window.APP_CONFIG;
  const rel  = compareDateToToday(selectedDate);
  const gran = cfg.schedule.granularityMinutes;
  const nowM = getTaipeiNowMins();

  // Head
  const thead = document.getElementById('timeline-head');
  thead.innerHTML = '';
  const hrow = document.createElement('tr');
  const thTime = document.createElement('th'); thTime.textContent = '時間';
  hrow.appendChild(thTime);
  cfg.rooms.forEach(room => { const th = document.createElement('th'); th.textContent = room.name; hrow.appendChild(th); });
  thead.appendChild(hrow);

  // Body
  const tbody = document.getElementById('timeline-body');
  tbody.innerHTML = '';

  slots.forEach(slot => {
    const sm   = slotToMins(slot);
    const past = isSlotPast(slot);

    // Today: hide fully-passed slots
    if (rel === 'today' && past) return;

    const isCurrent = rel === 'today' && sm <= nowM && nowM < sm + gran;
    const tr = document.createElement('tr');
    if (isCurrent) tr.classList.add('row-now');

    const tdTime = document.createElement('td');
    tdTime.textContent = slotLabel(slot);
    // Annotate special time ranges
    if (slot === '0800') tdTime.title = '早會時段';
    if (slot === '1200' || slot === '1300') tdTime.title = '午休時段';
    tr.appendChild(tdTime);

    cfg.rooms.forEach(room => {
      const td  = document.createElement('td');
      const raw = dayData[`${room.id}:${slot}`] || null;
      const btn = document.createElement('button');
      btn.className = 'slot-cell';

      if (past) {
        btn.disabled = true;
        if (raw && !raw._continuation) {
          btn.classList.add('slot-booked', 'slot-past');
          btn.textContent = '已預約';
          btn.title = `${slotLabel(slot)}–${getEndTime(slot, raw)}`;
          if (rel === 'past') { btn.disabled = false; btn.addEventListener('click', () => openDetailModal(room.id, slot, raw)); }
        } else if (raw && raw._continuation) {
          btn.classList.add('slot-continuation', 'slot-past');
          btn.textContent = '已預約';
        } else {
          btn.classList.add(rel === 'past' ? 'slot-past-date' : 'slot-past');
          btn.textContent = rel === 'past' ? '–' : '已過';
        }
      } else if (raw && raw._continuation) {
        // Continuation slot — public view shows 已預約 only
        const primaryBooking = dayData[`${room.id}:${raw._primary_slot}`];
        btn.classList.add('slot-continuation');
        if (isCurrent) btn.classList.add('slot-now');
        btn.textContent = '已預約';
        btn.title = `${slotLabel(slot)} 已預約`;
        if (primaryBooking) {
          btn.addEventListener('click', () => openDetailModal(room.id, raw._primary_slot, primaryBooking));
        }
      } else if (!raw) {
        btn.classList.add('slot-free');
        if (isCurrent) btn.classList.add('slot-now');
        btn.textContent = '可預約';
        btn.addEventListener('click', () => openBookModal(room.id, slot));
      } else {
        // Primary booked slot — public view shows 已預約 only
        btn.classList.add('slot-booked');
        if (isCurrent) btn.classList.add('slot-now');
        const endT = getEndTime(slot, raw);
        btn.textContent = '已預約';
        btn.title = `${slotLabel(slot)}–${endT} 已預約`;
        btn.addEventListener('click', () => openDetailModal(room.id, slot, raw));
      }

      td.appendChild(btn);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function updateNowLine() {
  const line = document.getElementById('now-line');
  if (!line) return;
  if (compareDateToToday(selectedDate) !== 'today') { line.classList.add('hidden'); return; }
  const cfg = window.APP_CONFIG;
  const [oh, om] = cfg.schedule.open.split(':').map(Number);
  const [ch, cm] = cfg.schedule.close.split(':').map(Number);
  const openMins = oh * 60 + om, closeMins = ch * 60 + cm;
  const nowMins  = getTaipeiNowMins();
  if (nowMins <= openMins || nowMins >= closeMins) { line.classList.add('hidden'); return; }
  line.classList.remove('hidden');
  const pct   = (nowMins - openMins) / (closeMins - openMins);
  const tbody = document.getElementById('timeline-body');
  if (tbody) line.style.top = (tbody.offsetTop + pct * tbody.offsetHeight) + 'px';
}

function highlightRoom(roomId) {
  const card = document.getElementById(`card-${roomId}`);
  if (!card) return;
  setTimeout(() => {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.style.outline = '3px solid var(--blue)'; card.style.outlineOffset = '2px';
    setTimeout(() => { card.style.outline = ''; card.style.outlineOffset = ''; }, 2500);
  }, 300);
}

// ─── Manage view ──────────────────────────────────────────────────────────
function renderManage() {
  const cfg     = window.APP_CONFIG;
  const list    = document.getElementById('manage-list');
  const rel     = compareDateToToday(selectedDate);
  const gran    = cfg.schedule.granularityMinutes;
  const nowMins = getTaipeiNowMins();
  list.innerHTML = '';

  const bookings = [];
  slots.forEach(slot => {
    cfg.rooms.forEach(room => {
      const b = dayData[`${room.id}:${slot}`];
      if (b && !b._continuation) bookings.push({ room, slot, booking: b });
    });
  });

  if (bookings.length === 0) {
    const dateStr = new Date(selectedDate + 'T12:00:00+08:00')
      .toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'long', day: 'numeric' });
    list.innerHTML = `<div class="manage-empty"><div class="manage-empty-icon">📭</div>
      <div class="manage-empty-text">${escHtml(dateStr)}<br>今天還沒有預約。</div></div>`;
    return;
  }

  bookings.forEach(({ room, slot, booking }) => {
    const sm     = slotToMins(slot);
    const ds     = getDurationSlots(booking);
    const isPast = rel === 'past' || (rel === 'today' && (sm + ds * gran) <= nowMins);
    const item   = document.createElement('div');
    item.className = 'booking-item' + (isPast ? ' booking-past' : '');
    const endT  = getEndTime(slot, booking);
    const title = getTitle(booking);

    item.innerHTML = `
      <div class="booking-item-left">
        <span class="booking-room-tag">${escHtml(room.name)}</span>
        <div class="booking-time">${slotLabel(slot)} – ${escHtml(endT)}</div>
        <div class="booking-owner">${escHtml(getBooker(booking))} · ${escHtml(getDept(booking) || '–')}</div>
        ${getProjectRegion(booking) ? `<div class="booking-purpose">📍 ${escHtml(getProjectRegion(booking))}</div>` : ''}
        ${title ? `<div class="booking-purpose">${escHtml(title)}</div>` : ''}
        ${booking.people > 0 ? `<div class="booking-purpose">人數：${booking.people}</div>` : ''}
      </div>`;

    if (!isPast && rel !== 'past') {
      const btnWrap = document.createElement('div');
      btnWrap.style.display = 'flex'; btnWrap.style.gap = '6px'; btnWrap.style.flexShrink = '0';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sm btn-secondary';
      editBtn.textContent = '編輯';
      editBtn.addEventListener('click', () => openEditModal(room.id, slot, booking));

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-sm btn-danger';
      cancelBtn.textContent = '取消';
      cancelBtn.addEventListener('click', () => openDetailModal(room.id, slot, booking));

      btnWrap.appendChild(editBtn);
      btnWrap.appendChild(cancelBtn);
      item.appendChild(btnWrap);
    }
    list.appendChild(item);
  });
}

// ─── This-week list ───────────────────────────────────────────────────────
async function renderWeekList() {
  const container = document.getElementById('week-list');
  if (!container) return;
  container.innerHTML = '<div class="manage-empty"><div class="manage-empty-icon">🔄</div><div>載入中…</div></div>';

  try {
    const dates   = getThisWeekDates();
    const weekData = await adapter.getMultipleDays(dates);
    const cfg      = window.APP_CONFIG;
    container.innerHTML = '';

    let hasAny = false;
    dates.forEach(date => {
      const data = weekData[date] || {};
      const dayBookings = [];
      slots.forEach(slot => {
        cfg.rooms.forEach(room => {
          const b = data[`${room.id}:${slot}`];
          if (b && !b._continuation) dayBookings.push({ room, slot, booking: b, date });
        });
      });
      if (dayBookings.length === 0) return;
      hasAny = true;

      const heading = document.createElement('div');
      heading.className = 'week-day-heading';
      const d = new Date(date + 'T12:00:00+08:00');
      heading.textContent = d.toLocaleDateString('zh-TW', {
        timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', weekday: 'short'
      }) + (date === todayDate ? '（今天）' : '');
      container.appendChild(heading);

      dayBookings.forEach(({ room, slot, booking }) => {
        const item = document.createElement('div');
        item.className = 'booking-item';
        const endT  = getEndTime(slot, booking);
        const title = getTitle(booking);
        item.innerHTML = `
          <div class="booking-item-left">
            <span class="booking-room-tag">${escHtml(room.name)}</span>
            <div class="booking-time">${slotLabel(slot)} – ${escHtml(endT)}</div>
            <div class="booking-owner">${escHtml(getBooker(booking))} · ${escHtml(getDept(booking) || '–')}</div>
            ${getProjectRegion(booking) ? `<div class="booking-purpose">📍 ${escHtml(getProjectRegion(booking))}</div>` : ''}
            ${title ? `<div class="booking-purpose">${escHtml(title)}</div>` : ''}
          </div>`;
        container.appendChild(item);
      });
    });

    if (!hasAny) {
      container.innerHTML = '<div class="manage-empty"><div class="manage-empty-icon">📭</div><div class="manage-empty-text">本週暫無預約</div></div>';
    }
  } catch (e) {
    container.innerHTML = `<div class="manage-empty"><div class="manage-empty-icon">⚠️</div><div>載入失敗：${escHtml(e.message)}</div></div>`;
  }
}

// ─── CSV export ───────────────────────────────────────────────────────────
async function exportCSV(mode) {
  const cfg  = window.APP_CONFIG;
  const rows = [['日期', '會議室', '開始時間', '結束時間', '預約人', '部門', '區域/專案', '事由', '人數', '備註', '狀態']];

  async function addDayRows(date, data) {
    slots.forEach(slot => {
      cfg.rooms.forEach(room => {
        const b = data[`${room.id}:${slot}`];
        if (!b || b._continuation) return;
        rows.push([
          date, room.name, slotLabel(slot), getEndTime(slot, b),
          getBooker(b), getDept(b), getProjectRegion(b), getTitle(b),
          b.people || 0, b.notes || '', b.status || 'active'
        ]);
      });
    });
  }

  try {
    if (mode === 'today') {
      await addDayRows(selectedDate, dayData);
    } else {
      const dates    = getThisWeekDates();
      const weekData = await adapter.getMultipleDays(dates);
      for (const date of dates) { await addDayRows(date, weekData[date] || {}); }
    }

    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `reservations_${mode === 'today' ? selectedDate : 'this_week'}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`CSV 匯出完成（${rows.length - 1} 筆）`, 'success');
  } catch (e) {
    showToast('匯出失敗：' + e.message, 'error');
  }
}

// ─── Data loading & polling ───────────────────────────────────────────────
async function load() {
  if (isLoading) return;
  isLoading = true;
  setSyncState('syncing');
  todayDate = getTaipeiDate();
  try {
    dayData = await adapter.getDay(selectedDate);
    setSyncState('synced');
    renderDashboard();
    updateDateDisplay();
    if (currentView === 'manage') renderManage();
  } catch (e) {
    setSyncState('failed');
    showToast('目前無法同步雲端資料，請稍後再試。', 'error');
  } finally {
    isLoading = false;
  }
}
function startPolling() {
  stopPolling();
  pollTimer = setInterval(load, (window.APP_CONFIG?.pollIntervalSeconds || 10) * 1000);
}
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

// ─── Booking modal ────────────────────────────────────────────────────────
function openBookModalForRoom(roomId) {
  if (compareDateToToday(selectedDate) === 'past') { showToast('過去的日期無法預約', 'error'); return; }
  const slot = slots.find(s => !isSlotPast(s) && !dayData[`${roomId}:${s}`] && !dayData[`${roomId}:${s}`]?._continuation)
             || slots.find(s => !dayData[`${roomId}:${s}`]);
  if (!slot) { showToast('今天所有時段都已滿，請換其他會議室。', 'warn'); return; }
  openBookModal(roomId, slot);
}

function openBookModal(roomId, slot, editingData = null) {
  if (compareDateToToday(selectedDate) === 'past') { showToast('過去的日期無法預約', 'error'); return; }
  if (!editingData && isSlotPast(slot)) { showToast('這個時段已過，無法預約', 'error'); return; }

  const cfg  = window.APP_CONFIG;
  const room = cfg.rooms.find(r => r.id === roomId);
  pendingBook = { roomId, slot, editing: editingData };

  document.getElementById('book-title').textContent = editingData
    ? `編輯預約 · ${room.name}`
    : `預約 · ${room.name}`;

  // Populate form
  const id = getSavedIdentity();
  const bk = editingData?.booking || null;

  document.getElementById('f-owner').value   = bk ? getBooker(bk)        : (id.owner || '');
  const deptSel = document.getElementById('f-dept');
  if (deptSel) deptSel.value                 = bk ? getDept(bk)          : (id.dept  || '');
  document.getElementById('f-project').value = bk ? getProjectRegion(bk) : (id.project_region || '');
  document.getElementById('f-title').value   = bk ? getTitle(bk)         : '';
  document.getElementById('f-people').value  = bk ? (bk.people || '') : '';
  document.getElementById('f-notes').value   = bk ? (bk.notes || '') : '';
  document.getElementById('f-pin').value     = '';

  // Duration
  const durSel = document.getElementById('f-duration');
  durSel.value = bk ? (bk.duration_type || '1h') : '1h';

  // Pin field
  document.getElementById('pin-field').className = 'field' + (cfg.enablePin ? '' : ' hidden');

  updateBookSlotInfo();
  showOverlay('book-overlay');
  setTimeout(() => document.getElementById('f-owner').focus(), 100);
}

function updateBookSlotInfo() {
  if (!pendingBook) return;
  const { roomId, slot } = pendingBook;
  const durVal = document.getElementById('f-duration').value;
  const range  = computeRange(slot, durVal);
  const dateStr = new Date(selectedDate + 'T12:00:00+08:00')
    .toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', month: 'long', day: 'numeric', weekday: 'short' });
  document.getElementById('book-slot-info').textContent =
    `預約時間：${range.startTime} – ${range.endTime} · ${dateStr}`;
}

function openEditModal(roomId, slot, booking) {
  openBookModal(roomId, slot, { slot, booking });
}

function bindBookForm() {
  document.getElementById('book-close-x').addEventListener('click',   () => hideOverlay('book-overlay'));
  document.getElementById('book-cancel-btn').addEventListener('click',() => hideOverlay('book-overlay'));
  document.getElementById('book-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) hideOverlay('book-overlay');
  });
  document.getElementById('f-duration').addEventListener('change', updateBookSlotInfo);
  document.getElementById('clear-identity-btn').addEventListener('click', () => {
    localStorage.removeItem('mrs:identity');
    document.getElementById('f-owner').value   = '';
    const deptSel = document.getElementById('f-dept');
    if (deptSel) deptSel.value                 = '';
    const projEl = document.getElementById('f-project');
    if (projEl) projEl.value                   = '';
    showToast('已清除記住的資料', 'info');
  });
  document.getElementById('book-form').addEventListener('submit', e => { e.preventDefault(); submitBook(); });
}

async function submitBook() {
  if (!pendingBook) return;
  const rawName = document.getElementById('f-owner').value.trim();
  const title   = document.getElementById('f-title').value.trim();
  const people  = parseInt(document.getElementById('f-people').value) || 0;
  const notes   = document.getElementById('f-notes').value.trim();
  const pinRaw  = document.getElementById('f-pin').value.trim();
  const durVal  = document.getElementById('f-duration').value;
  const cfg     = window.APP_CONFIG;

  const dept          = (document.getElementById('f-dept')?.value    || '').trim();
  const project_region= (document.getElementById('f-project')?.value || '').trim();

  if (!rawName)        { showToast('請填寫姓名', 'error'); return; }
  if (!dept)           { showToast('請選擇部門', 'error'); return; }
  if (!project_region) { showToast('請填寫區域 / 專案', 'error'); return; }
  if (pinRaw && !/^\d{4}$/.test(pinRaw)) { showToast('PIN 須為 4 位數字', 'error'); return; }

  // Resolve canonical name from aliases; falls back to cleaned input
  const booker = resolveDisplayName(rawName);
  if (!isValidDateInCurrentYear(selectedDate)) { showToast('請選擇本年度日期', 'error'); return; }
  if (compareDateToToday(selectedDate) === 'past') { showToast('過去的日期無法預約', 'error'); return; }

  const { roomId, slot: clickedSlot, editing } = pendingBook;
  const range = computeRange(clickedSlot, durVal);
  const { startSlot, startTime, endTime, durationSlots, durationType } = range;

  // Validate end time
  const [ch, cm] = cfg.schedule.close.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (eh * 60 + em > ch * 60 + cm) {
    showToast(`選擇的時長會超過閉館時間（${cfg.schedule.close}）`, 'error'); return;
  }

  // If today, start slot cannot be in the past
  if (compareDateToToday(selectedDate) === 'today' && isSlotPast(startSlot) && !editing) {
    showToast('起始時段已過，請選擇未來時段', 'error'); return;
  }

  // Hard conflict check (skip self when editing)
  const excludeSlot = editing ? editing.slot : null;
  if (hasConflict(roomId, startSlot, durationSlots, excludeSlot)) {
    showToast('此時段與現有預約衝突，無法預約', 'error'); return;
  }

  // Collect warnings (non-blocking)
  const warnings = collectWarnings(roomId, startSlot, durationSlots, booker, dept, people);
  if (warnings.length > 0) {
    warnings.forEach(w => showToast(w, 'warn'));
  }

  const pinHash = pinRaw ? await hashPin(pinRaw) : null;
  const booking = makeBookingRecord({ roomId, startSlot, startTime, endTime, durationSlots, durationType, title, booker, department: dept, project_region, people, notes, pinHash });

  // A3: compute old keys for atomic replace (replaceId passed separately, never persisted)
  const gran = cfg.schedule.granularityMinutes;
  const bookOpts = editing ? {
    replaceId: editing.booking.id,
    oldKeys:   occupiedSlotKeys(selectedDate, roomId, editing.slot, getDurationSlots(editing.booking), gran)
  } : {};

  const submitBtn = document.getElementById('book-submit-btn');
  submitBtn.disabled = true; submitBtn.textContent = '送出中…';

  try {
    // Optimistically clear old slots from local dayData if editing
    if (editing) {
      let cur = editing.slot;
      dayData[`${roomId}:${cur}`] = null;
      for (let i = 1; i < getDurationSlots(editing.booking); i++) {
        cur = slotPlusGranApp(cur, gran);
        dayData[`${roomId}:${cur}`] = null;
      }
    }

    const result = await adapter.book(selectedDate, roomId, startSlot, booking, bookOpts);

    if (result.ok) {
      saveIdentity(booker, dept, project_region);
      // Optimistic update
      dayData[`${roomId}:${startSlot}`] = booking;
      const cont = { _continuation: true, _primary_slot: startSlot, id: booking.id, booker, owner: booker, department: dept, dept };
      let cur = startSlot;
      for (let i = 1; i < durationSlots; i++) {
        cur = slotPlusGranApp(cur, gran);
        dayData[`${roomId}:${cur}`] = cont;
      }

      hideOverlay('book-overlay');
      const roomName = cfg.rooms.find(r => r.id === roomId)?.name;
      showToast(`預約成功。\n${roomName} ${startTime}–${endTime}`, 'success');
      renderDashboard();
      if (currentView === 'manage') renderManage();
      adapter.appendLog(selectedDate, {
        ts: booking.created_at, date: selectedDate,
        action: editing ? 'edit' : 'book',
        room_id: roomId, slot: startSlot,
        start_time: startTime, end_time: endTime,
        booker, department: dept, project_region, title
      });
    } else if (result.reason === 'conflict') {
      showToast('這個時段剛被別人訂走了，請重新選擇', 'error');
      hideOverlay('book-overlay'); load();
    } else {
      showToast(`預約失敗：${result.reason}`, 'error');
    }
  } catch (e) {
    showToast('目前無法同步雲端資料，請稍後再試。', 'error');
  } finally {
    submitBtn.disabled = false; submitBtn.textContent = '確認預約';
  }
}

// app.js internal slot advance (mirrors kv.js slotPlusGran)
function slotPlusGranApp(slot, gran) {
  const m = slotToMins(slot) + gran;
  return `${String(Math.floor(m/60)).padStart(2,'0')}${String(m%60).padStart(2,'0')}`;
}

// ─── Detail / Cancel modal ────────────────────────────────────────────────
function openDetailModal(roomId, slot, booking) {
  if (booking?._continuation) {
    const primary = dayData[`${roomId}:${booking._primary_slot}`];
    if (primary) { openDetailModal(roomId, booking._primary_slot, primary); return; }
    return;
  }
  const room = window.APP_CONFIG.rooms.find(r => r.id === roomId);
  const rel  = compareDateToToday(selectedDate);
  pendingCancel = { roomId, slot, booking };

  document.getElementById('detail-title').textContent = `預約詳情 · ${room.name}`;
  const dl = document.getElementById('detail-info');
  dl.innerHTML = '';
  const dateStr = new Date(selectedDate + 'T12:00:00+08:00')
    .toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'long', day: 'numeric' });
  const endT = getEndTime(slot, booking);
  const dept = getDept(booking);
  const proj = getProjectRegion(booking);

  // ── Door-card: show for active (non-past) bookings ──
  const card = document.getElementById('meeting-card');
  if (card) {
    const isActive = rel !== 'past';
    card.classList.toggle('hidden', !isActive);
    if (isActive) {
      document.getElementById('mc-dept').textContent    = dept || '未填寫';
      document.getElementById('mc-date').textContent    = dateStr;
      document.getElementById('mc-time').textContent    = `${slotLabel(slot)} – ${endT}`;
      document.getElementById('mc-project').textContent = proj || '未填寫';
    }
  }

  // ── Standard DL ──
  const rows = [
    ['日期',   dateStr],
    ['時段',   `${slotLabel(slot)} – ${endT}`],
    ['預約人', getBooker(booking)],
    ['部門',   dept || '未填寫'],
    ['區域/專案', proj || '未填寫'],
  ];
  if (getTitle(booking)) rows.push(['事由', getTitle(booking)]);
  if (booking.people > 0) rows.push(['人數', String(booking.people)]);
  if (booking.notes) rows.push(['備註', booking.notes]);
  rows.push(['預約時間', new Date(booking.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })]);
  rows.forEach(([label, val]) => {
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd'); dd.textContent = val;
    dl.appendChild(dt); dl.appendChild(dd);
  });

  const cancelBtn = document.getElementById('detail-cancel-btn');
  const editBtnD  = document.getElementById('detail-edit-btn');
  const pinSec    = document.getElementById('cancel-pin-section');
  const reasonSec = document.getElementById('cancel-reason-section');

  cancelBtn.hidden = rel === 'past';
  if (editBtnD) editBtnD.hidden = rel === 'past';
  if (editBtnD) {
    editBtnD.onclick = () => { hideOverlay('detail-overlay'); openEditModal(roomId, slot, booking); };
  }

  if (booking.pin_hash && rel !== 'past') {
    pinSec.classList.remove('hidden');
    document.getElementById('cancel-pin-input').value = '';
  } else {
    pinSec.classList.add('hidden');
  }
  if (reasonSec) {
    reasonSec.classList.remove('hidden');
    document.getElementById('cancel-reason-input').value = '';
  }
  showOverlay('detail-overlay');
}

function bindDetailModal() {
  document.getElementById('detail-close-x').addEventListener('click',   () => hideOverlay('detail-overlay'));
  document.getElementById('detail-close-btn').addEventListener('click', () => hideOverlay('detail-overlay'));
  document.getElementById('detail-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) hideOverlay('detail-overlay');
  });
  document.getElementById('detail-cancel-btn').addEventListener('click', submitCancel);
}

async function submitCancel() {
  if (!pendingCancel) return;
  const { roomId, slot, booking } = pendingCancel;
  if (compareDateToToday(selectedDate) === 'past') { showToast('過去的預約無法取消', 'error'); return; }

  const reason = document.getElementById('cancel-reason-input')?.value.trim() || '';
  if (!reason) { showToast('請填寫取消原因', 'error'); return; }

  let pin = null;
  if (booking.pin_hash) {
    pin = document.getElementById('cancel-pin-input').value.trim();
    if (!pin) { showToast('PIN 不正確，無法取消', 'error'); return; }
  }

  const btn = document.getElementById('detail-cancel-btn');
  btn.disabled = true; btn.textContent = '取消中…';

  try {
    const result = await adapter.cancel(selectedDate, roomId, slot, pin);
    if (result.ok) {
      // Optimistic update: clear primary + continuations
      const cfg  = window.APP_CONFIG;
      const gran = cfg.schedule.granularityMinutes;
      const ds   = getDurationSlots(booking);
      dayData[`${roomId}:${slot}`] = null;
      let cur = slot;
      for (let i = 1; i < ds; i++) { cur = slotPlusGranApp(cur, gran); dayData[`${roomId}:${cur}`] = null; }
      hideOverlay('detail-overlay');
      showToast('已取消預約', 'success');
      renderDashboard();
      if (currentView === 'manage') renderManage();
      adapter.appendLog(selectedDate, {
        ts: new Date().toISOString(), date: selectedDate,
        action: 'cancel', room_id: roomId, slot,
        booker: getBooker(booking), department: getDept(booking),
        project_region: getProjectRegion(booking),
        cancel_reason: reason,
        cancelled_at: new Date().toISOString()
      });
    } else if (result.reason === 'pin') {
      showToast('PIN 不正確，無法取消', 'error');
    } else if (result.reason === 'notfound') {
      showToast('該預約已不存在', 'warn'); hideOverlay('detail-overlay'); load();
    } else {
      showToast(`取消失敗：${result.reason}`, 'error');
    }
  } catch {
    showToast('目前無法同步雲端資料，請稍後再試。', 'error');
  } finally {
    btn.disabled = false; btn.textContent = '取消預約';
  }
}

// ─── Offline banner ───────────────────────────────────────────────────────
function wireOffline() {
  let banner = null;
  const show = () => {
    if (banner) return;
    banner = document.createElement('div');
    banner.style.cssText = 'background:#92400e;color:#fef3c7;text-align:center;font-size:.8rem;padding:6px;font-weight:600;';
    banner.textContent = '⚠ 目前離線，資料可能未同步';
    document.getElementById('header').after(banner);
  };
  const hide = () => { if (banner) { banner.remove(); banner = null; } };
  if (!navigator.onLine) show();
  window.addEventListener('online', hide);
  window.addEventListener('offline', show);
}

// ─── Identity persistence ─────────────────────────────────────────────────
function getSavedIdentity() {
  try { return JSON.parse(localStorage.getItem('mrs:identity') || '{}'); } catch { return {}; }
}
function saveIdentity(owner, dept, project_region) {
  localStorage.setItem('mrs:identity', JSON.stringify({ owner, dept: dept || '', project_region: project_region || '' }));
}

// ─── Overlay helpers ──────────────────────────────────────────────────────
function showOverlay(id) { document.getElementById(id).classList.remove('hidden'); document.body.classList.add('modal-open'); }
function hideOverlay(id) {
  document.getElementById(id).classList.add('hidden');
  document.body.classList.remove('modal-open');
  pendingBook = null; pendingCancel = null;
}

// ─── Toast ────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className  = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => {
    t.classList.remove('show');
    t.addEventListener('transitionend', () => t.remove(), { once: true });
    setTimeout(() => t.remove(), 500);
  }, 5000);
}

// ─── Utilities ────────────────────────────────────────────────────────────
function getTaipeiDate()     { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }); }
function getTaipeiNowMins() {
  const s = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit' });
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}
function slotToMins(slot)   { return parseInt(slot.slice(0,2)) * 60 + parseInt(slot.slice(2)); }
function slotLabel(slot)    { return `${slot.slice(0,2)}:${slot.slice(2)}`; }
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showConfigError() {
  document.body.innerHTML = `<div class="config-error"><h2>⚙️ 尚未設定 config.js</h2><p>請複製 <code>templates/config.example.js</code> 為根目錄的 <code>config.js</code>，填入 Upstash 連線資訊後重新整理頁面。</p></div>`;
}
function showFatalError(msg) {
  document.body.innerHTML = `<div class="config-error"><h2>⚠️ 初始化失敗</h2><p>${escHtml(msg)}</p></div>`;
}
