'use strict';
/* app.js — Meeting Room Scheduler v3 (full-year date support) */

// ─── State ────────────────────────────────────────────────────────────────
let adapter       = null;
let slots         = [];          // ["0800","0900",...] from config
let todayDate     = '';          // actual today in Asia/Taipei (never changes at runtime)
let selectedDate  = '';          // currently viewed date (may differ from today)
let dayData       = {};          // {"glass1:0900": booking|null, ...}
let pollTimer     = null;
let clockTimer    = null;
let nowLineTimer  = null;
let currentView   = 'dashboard';
let syncState     = 'syncing';
let isLoading     = false;
let pendingBook   = null;        // {roomId, slot}
let pendingCancel = null;        // {roomId, slot, booking}
let kioskRoomId   = null;

// ─── Bootstrap ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

function init() {
  if (window.__configMissing || !window.APP_CONFIG) { showConfigError(); return; }
  try {
    adapter  = createAdapter();
    slots    = generateSlots(window.APP_CONFIG);
    todayDate = getTaipeiDate();
    selectedDate = loadSavedDate() || todayDate;
  } catch (e) { showFatalError(e.message); return; }

  const params    = new URLSearchParams(location.search);
  const roomParam = params.get('room');
  const isKiosk   = params.get('kiosk') === '1';

  if (isKiosk && roomParam) {
    initKiosk(roomParam);
  } else {
    initApp(roomParam);
  }
}

// ─── Date helpers ─────────────────────────────────────────────────────────
function getCurrentYearRange() {
  const year = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }).slice(0, 4);
  return { min: `${year}-01-01`, max: `${year}-12-31`, year };
}

function isValidDateInCurrentYear(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const { min, max } = getCurrentYearRange();
  return dateStr >= min && dateStr <= max;
}

/** Returns 'past' | 'today' | 'future' relative to actual Taipei today */
function compareDateToToday(dateStr) {
  if (dateStr < todayDate) return 'past';
  if (dateStr > todayDate) return 'future';
  return 'today';
}

/** Is a given slot "past" considering the selectedDate context? */
function isSlotPast(slot) {
  const rel = compareDateToToday(selectedDate);
  if (rel === 'past')   return true;   // all slots on past dates are done
  if (rel === 'future') return false;  // no slots are past on future dates
  // Today: check against current Taipei time
  const gran = window.APP_CONFIG.schedule.granularityMinutes;
  return (slotToMins(slot) + gran) <= getTaipeiNowMins();
}

function loadSavedDate() {
  try {
    const s = localStorage.getItem('mrs:selectedDate');
    return s && isValidDateInCurrentYear(s) ? s : null;
  } catch { return null; }
}
function saveSelectedDate(d) {
  try { localStorage.setItem('mrs:selectedDate', d); } catch {}
}

function getTomorrowDate() {
  const d = new Date(todayDate + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
}

// ─── Kiosk mode (always shows todayDate, ignores selectedDate) ────────────
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
  document.getElementById('kiosk-sync').textContent = '正在同步最新預約狀態…';
  try {
    // Kiosk always reflects today
    const kioskDate = getTaipeiDate();
    dayData = await adapter.getDay(kioskDate);
    renderKiosk(kioskDate);
    document.getElementById('kiosk-sync').textContent = '已同步 · ' + new Date().toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
  } catch {
    document.getElementById('kiosk-sync').textContent = '目前無法同步雲端資料，請稍後再試。';
  }
}

function renderKiosk(kioskDate) {
  const cfg    = window.APP_CONFIG;
  const room   = cfg.rooms.find(r => r.id === kioskRoomId);
  if (!room) return;
  // Use a temp selectedDate context for status calc
  const savedSel = selectedDate;
  selectedDate = kioskDate || getTaipeiDate();
  const status = getRoomStatus(kioskRoomId);
  selectedDate = savedSel;

  const inner = document.querySelector('.kiosk-inner');
  document.getElementById('kiosk-room-name').textContent   = room.name;
  document.getElementById('kiosk-icon').textContent        = status.icon;
  document.getElementById('kiosk-status-text').textContent = status.text;

  let infoText = '', nextText = '';
  if (status.state === 'busy' && status.booking) {
    infoText = `${status.booking.owner} · ${status.booking.dept}`;
  }
  if (status.nextSlot) {
    const b = dayData[`${kioskRoomId}:${status.nextSlot}`];
    nextText = b ? `下一場：${slotLabel(status.nextSlot)} ${b.dept}` : '';
  }
  document.getElementById('kiosk-booking-info').textContent = infoText;
  document.getElementById('kiosk-next').textContent         = nextText;
  inner.className = `kiosk-inner state-${status.state}`;
}

// ─── Normal app init ──────────────────────────────────────────────────────
function initApp(roomParam) {
  startClock('live-clock');
  bindViewNav();
  initDatePicker();
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
}

// ─── Date picker ──────────────────────────────────────────────────────────
function initDatePicker() {
  const { min, max } = getCurrentYearRange();
  const input = document.getElementById('date-input');
  input.min   = min;
  input.max   = max;
  input.value = selectedDate;
  updateDateDisplay();

  input.addEventListener('change', () => {
    const v = input.value;
    if (!v) return;
    if (!isValidDateInCurrentYear(v)) {
      showToast('超出營業時間範圍，請選擇本年度日期', 'error');
      input.value = selectedDate;
      return;
    }
    onDateChange(v);
  });

  document.getElementById('btn-today').addEventListener('click', () => onDateChange(todayDate));
  document.getElementById('btn-tomorrow').addEventListener('click', () => {
    const tm = getTomorrowDate();
    if (!isValidDateInCurrentYear(tm)) { showToast('已是本年最後一天', 'warn'); return; }
    onDateChange(tm);
  });
}

function onDateChange(newDate) {
  if (!isValidDateInCurrentYear(newDate)) {
    showToast('請選擇本年度日期', 'error'); return;
  }
  selectedDate = newDate;
  saveSelectedDate(newDate);
  document.getElementById('date-input').value = newDate;
  updateDateDisplay();
  dayData = {};           // clear stale data
  load();
}

function updateDateDisplay() {
  const label = document.getElementById('date-label');
  const rel   = compareDateToToday(selectedDate);
  const dateFormatted = new Date(selectedDate + 'T12:00:00+08:00').toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
  });

  const todayBtn    = document.getElementById('btn-today');
  const tomorrowBtn = document.getElementById('btn-tomorrow');
  const tomorrowDate = getTomorrowDate();
  todayBtn.classList.toggle('active',    selectedDate === todayDate);
  tomorrowBtn.classList.toggle('active', selectedDate === tomorrowDate);

  if (rel === 'today') {
    label.textContent  = `📅 ${dateFormatted}（今天）`;
    label.className    = 'date-label is-today';
  } else if (rel === 'future') {
    label.textContent  = `📅 ${dateFormatted}`;
    label.className    = 'date-label is-future';
  } else {
    label.textContent  = `📋 ${dateFormatted}（過去記錄，僅供查閱）`;
    label.className    = 'date-label is-past';
  }
}

// ─── Clock ────────────────────────────────────────────────────────────────
function startClock(elId) {
  function tick() {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString('zh-TW', {
      timeZone: 'Asia/Taipei', hour12: false,
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
  tick();
  clockTimer = setInterval(tick, 1000);
}

// ─── Sync pill ────────────────────────────────────────────────────────────
const SYNC_LABELS = { synced: '已同步', syncing: '同步中…', failed: '同步失敗，點此重試' };
function setSyncState(state) {
  syncState = state;
  const pill  = document.getElementById('sync-pill');
  const label = pill.querySelector('.sync-label');
  pill.className    = `sync-pill sync-${state}`;
  label.textContent = SYNC_LABELS[state];
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
  document.getElementById('view-dashboard').classList.toggle('active', view === 'dashboard');
  document.getElementById('view-manage').classList.toggle('active',    view === 'manage');
  document.getElementById('view-dashboard').classList.toggle('hidden', view !== 'dashboard');
  document.getElementById('view-manage').classList.toggle('hidden',    view !== 'manage');
  if (view === 'manage') renderManage();
}

// ─── Room status (time-aware for today, booking-count for other dates) ────
function getRoomStatus(roomId) {
  const cfg       = window.APP_CONFIG;
  const gran      = cfg.schedule.granularityMinutes;
  const [oh, om]  = cfg.schedule.open.split(':').map(Number);
  const [ch, cm]  = cfg.schedule.close.split(':').map(Number);
  const openMins  = oh * 60 + om;
  const closeMins = ch * 60 + cm;
  const rel       = compareDateToToday(selectedDate);

  // ── Past date: read-only summary ──────────────────────────────────────
  if (rel === 'past') {
    const cnt = slots.filter(s => dayData[`${roomId}:${s}`]).length;
    return { state: 'closed', icon: '–', text: '過去日期，僅供查閱', sub: cnt ? `${cnt} 筆預約記錄` : '無預約記錄' };
  }

  // ── Future date: booking-count only ──────────────────────────────────
  if (rel === 'future') {
    const free   = slots.filter(s => !dayData[`${roomId}:${s}`]).length;
    const booked = slots.length - free;
    if (free === 0) return { state: 'busy', icon: '✕', text: '全天已滿', sub: `${booked} 筆預約`, nextSlot: null };
    return { state: 'available', icon: '●', text: '可預約', sub: `${free} 個空檔`, nextSlot: null };
  }

  // ── Today: time-based logic ───────────────────────────────────────────
  const nowMins = getTaipeiNowMins();

  if (nowMins < openMins || nowMins >= closeMins) {
    return { state: 'closed', icon: '–', text: nowMins < openMins ? '尚未開放，09:00 起可預約' : '今日已結束', sub: '超出營業時間' };
  }

  // Currently in a booked slot?
  for (const slot of slots) {
    const sm = slotToMins(slot);
    if (nowMins >= sm && nowMins < sm + gran) {
      const booking = dayData[`${roomId}:${slot}`];
      if (booking) {
        const em   = sm + gran;
        const endT = `${String(Math.floor(em/60)).padStart(2,'0')}:${String(em%60).padStart(2,'0')}`;
        const nextFree = slots.find(s => slotToMins(s) > sm && !dayData[`${roomId}:${s}`] && slotToMins(s) < closeMins);
        return { state: 'busy', icon: '✕', text: `使用中，到 ${endT}`, sub: `${booking.owner} · ${booking.dept}`, booking, slot, nextSlot: findNextBooked(roomId, sm), nextFreeSlot: nextFree };
      }
    }
  }

  // Soon: next booking within 30 min
  for (const slot of slots) {
    const sm = slotToMins(slot);
    if (sm > nowMins && sm <= nowMins + 30) {
      const booking = dayData[`${roomId}:${slot}`];
      if (booking) return { state: 'soon', icon: '▲', text: `${slotLabel(slot)} 即將開始`, sub: `${booking.owner} · ${booking.dept}`, booking, slot };
    }
  }

  // Available
  const freeCount   = slots.filter(s => slotToMins(s) >= nowMins && slotToMins(s) < closeMins && !dayData[`${roomId}:${s}`]).length;
  const nextBooked  = findNextBooked(roomId, nowMins);
  const nextBookedB = nextBooked ? dayData[`${roomId}:${nextBooked}`] : null;
  return { state: 'available', icon: '●', text: '可使用', sub: freeCount > 0 ? `今天還有 ${freeCount} 個空檔` : '今天空檔已滿', nextSlot: nextBooked, nextBooking: nextBookedB ? { slot: nextBooked, booking: nextBookedB } : null };
}

function findNextBooked(roomId, afterMins) {
  return slots.find(s => slotToMins(s) > afterMins && dayData[`${roomId}:${s}`]) || null;
}

// ─── Dashboard ────────────────────────────────────────────────────────────
function renderDashboard() {
  renderRoomCards();
  renderTimeline();
  updateNowLine();
  if (nowLineTimer) clearInterval(nowLineTimer);
  nowLineTimer = setInterval(() => { updateNowLine(); }, 30000);
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

  const actions = getCardActions(room.id, status, rel);

  let subLine = status.sub || '';
  if (status.state === 'available' && status.nextBooking) {
    subLine += ` · 下一場 ${slotLabel(status.nextBooking.slot)}`;
  }

  const dateStr = new Date(selectedDate + 'T12:00:00+08:00').toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', weekday: 'short'
  });

  el.innerHTML = `
    <div class="room-card-stripe" aria-hidden="true"></div>
    <div class="room-card-body">
      <div class="room-card-top">
        <div>
          <div class="room-card-name">${escHtml(room.name)}</div>
          <div class="room-card-date">${escHtml(dateStr)}</div>
        </div>
        <div class="status-badge">
          <span class="status-icon" aria-hidden="true">${status.icon}</span>
          <span>${statusLabel(status.state)}</span>
        </div>
      </div>
      <div class="room-card-status-text">${escHtml(status.text)}</div>
      <div class="room-card-sub">${escHtml(subLine)}</div>
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
  if (rel === 'past') return []; // past dates: view-only, no buttons
  const actions = [];
  if (status.state === 'available') {
    actions.push({ label: '立即預約', cls: 'btn-primary',   handler: () => openBookModalForRoom(roomId) });
    actions.push({ label: '查看今日', cls: 'btn-ghost',     handler: scrollToTimeline });
  } else if (status.state === 'busy') {
    actions.push({ label: '查看時段',       cls: 'btn-ghost',     handler: scrollToTimeline });
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
  const nowM = getTaipeiNowMins();

  // Head
  const thead = document.getElementById('timeline-head');
  thead.innerHTML = '';
  const hrow = document.createElement('tr');
  const thTime = document.createElement('th'); thTime.textContent = '時間';
  hrow.appendChild(thTime);
  cfg.rooms.forEach(room => {
    const th = document.createElement('th'); th.textContent = room.name;
    hrow.appendChild(th);
  });
  thead.appendChild(hrow);

  // Body
  const tbody = document.getElementById('timeline-body');
  tbody.innerHTML = '';

  slots.forEach(slot => {
    const sm        = slotToMins(slot);
    const past      = isSlotPast(slot);

    // Today: skip fully-passed slots — no need to clutter UI with 已過 rows
    if (rel === 'today' && past) return;

    const isCurrent = rel === 'today' && sm <= nowM && nowM < sm + cfg.schedule.granularityMinutes;

    const tr = document.createElement('tr');
    if (isCurrent) tr.classList.add('row-now');

    const tdTime = document.createElement('td');
    tdTime.textContent = slotLabel(slot);
    tr.appendChild(tdTime);

    cfg.rooms.forEach(room => {
      const td      = document.createElement('td');
      const booking = dayData[`${room.id}:${slot}`] || null;
      const btn     = document.createElement('button');
      btn.className = 'slot-cell';

      if (past) {
        btn.disabled = true;
        if (booking) {
          btn.classList.add('slot-booked', 'slot-past');
          btn.textContent = `${booking.owner}`;
          btn.title = `${booking.owner} · ${booking.dept}`;
          // Past date: allow viewing but label shows it
          if (rel === 'past') {
            btn.disabled = false;
            btn.addEventListener('click', () => openDetailModal(room.id, slot, booking));
          }
        } else {
          btn.classList.add(rel === 'past' ? 'slot-past-date' : 'slot-past');
          btn.textContent = rel === 'past' ? '–' : '已過';
        }
      } else if (!booking) {
        btn.classList.add('slot-free');
        if (isCurrent) btn.classList.add('slot-now');
        btn.textContent = '可預約';
        btn.addEventListener('click', () => openBookModal(room.id, slot));
      } else {
        btn.classList.add('slot-booked');
        if (isCurrent) btn.classList.add('slot-now');
        btn.textContent = `${booking.owner} · ${booking.dept}`;
        btn.title = `${booking.owner}（${booking.dept}）`;
        btn.addEventListener('click', () => openDetailModal(room.id, slot, booking));
      }

      td.appendChild(btn);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function updateNowLine() {
  const line    = document.getElementById('now-line');
  const wrapper = document.getElementById('timeline-wrapper');
  if (!line || !wrapper) return;

  // Only show "now" line when viewing today
  if (compareDateToToday(selectedDate) !== 'today') {
    line.classList.add('hidden'); return;
  }

  const cfg       = window.APP_CONFIG;
  const [oh, om]  = cfg.schedule.open.split(':').map(Number);
  const [ch, cm]  = cfg.schedule.close.split(':').map(Number);
  const openMins  = oh * 60 + om;
  const closeMins = ch * 60 + cm;
  const nowMins   = getTaipeiNowMins();

  if (nowMins <= openMins || nowMins >= closeMins) { line.classList.add('hidden'); return; }
  line.classList.remove('hidden');

  const pct   = (nowMins - openMins) / (closeMins - openMins);
  const tbody = document.getElementById('timeline-body');
  if (!tbody) return;
  line.style.top = (tbody.offsetTop + pct * tbody.offsetHeight) + 'px';
}

function highlightRoom(roomId) {
  const card = document.getElementById(`card-${roomId}`);
  if (!card) return;
  setTimeout(() => {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.style.outline = '3px solid var(--blue)';
    card.style.outlineOffset = '2px';
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
      if (b) bookings.push({ room, slot, booking: b });
    });
  });

  if (bookings.length === 0) {
    const dateStr = new Date(selectedDate + 'T12:00:00+08:00').toLocaleDateString('zh-TW', {
      timeZone: 'Asia/Taipei', year: 'numeric', month: 'long', day: 'numeric'
    });
    list.innerHTML = `
      <div class="manage-empty">
        <div class="manage-empty-icon">📭</div>
        <div class="manage-empty-text">${escHtml(dateStr)}<br>今天還沒有預約。<br>空氣很安靜，會議室很自由。</div>
      </div>`;
    return;
  }

  bookings.forEach(({ room, slot, booking }) => {
    const sm     = slotToMins(slot);
    const isPast = rel === 'past' || (rel === 'today' && (sm + gran) <= nowMins);
    const item   = document.createElement('div');
    item.className = 'booking-item' + (isPast ? ' booking-past' : '');

    const em   = sm + gran;
    const endT = `${String(Math.floor(em/60)).padStart(2,'0')}:${String(em%60).padStart(2,'0')}`;

    item.innerHTML = `
      <div class="booking-item-left">
        <span class="booking-room-tag">${escHtml(room.name)}</span>
        <div class="booking-time">${slotLabel(slot)} – ${endT}</div>
        <div class="booking-owner">${escHtml(booking.owner)} · ${escHtml(booking.dept)}</div>
        <div class="booking-purpose">${escHtml(booking.purpose)}</div>
      </div>`;

    // Allow cancel only for today-future or pure-future dates
    if (!isPast && rel !== 'past') {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-sm btn-danger';
      cancelBtn.textContent = '取消';
      cancelBtn.addEventListener('click', () => openDetailModal(room.id, slot, booking));
      item.appendChild(cancelBtn);
    }
    list.appendChild(item);
  });
}

// ─── Data loading & polling ───────────────────────────────────────────────
async function load() {
  if (isLoading) return;
  isLoading = true;
  setSyncState('syncing');

  // Refresh todayDate reference (handles midnight rollover)
  todayDate = getTaipeiDate();

  // If selectedDate was set to a future date that is now today, keep it
  // (user might be viewing "tomorrow" which became today at midnight)

  try {
    dayData = await adapter.getDay(selectedDate);  // ← uses selectedDate, not todayDate
    setSyncState('synced');
    renderDashboard();
    updateDateDisplay();
    if (currentView === 'manage') renderManage();
  } catch (e) {
    const msg = e.name === 'AbortError' ? '請求逾時，請檢查網路' : e.message;
    setSyncState('failed');
    showToast('目前無法同步雲端資料，請稍後再試。', 'error');
  } finally {
    isLoading = false;
  }
}

function startPolling() {
  stopPolling();
  const ms = (window.APP_CONFIG?.pollIntervalSeconds || 10) * 1000;
  pollTimer = setInterval(load, ms);
}
function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

// ─── Booking modal ────────────────────────────────────────────────────────
function openBookModalForRoom(roomId) {
  // Guard: no booking on past dates
  if (compareDateToToday(selectedDate) === 'past') {
    showToast('過去的日期無法預約', 'error'); return;
  }
  const nowM = getTaipeiNowMins();
  const slot = slots.find(s => {
    if (isSlotPast(s)) return false;
    return !dayData[`${roomId}:${s}`];
  }) || slots.find(s => !dayData[`${roomId}:${s}`]);
  if (!slot) { showToast('今天所有時段都已滿，請換其他會議室。', 'warn'); return; }
  openBookModal(roomId, slot);
}

function openBookModal(roomId, slot) {
  // Guard: no booking on past dates or past slots
  if (compareDateToToday(selectedDate) === 'past') {
    showToast('過去的日期無法預約', 'error'); return;
  }
  if (isSlotPast(slot)) {
    showToast('這個時段已過，無法預約', 'error'); return;
  }

  const cfg  = window.APP_CONFIG;
  const room = cfg.rooms.find(r => r.id === roomId);
  pendingBook = { roomId, slot };

  const dateStr = new Date(selectedDate + 'T12:00:00+08:00').toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei', month: 'long', day: 'numeric', weekday: 'short'
  });
  document.getElementById('book-title').textContent     = `預約 · ${room.name}`;
  document.getElementById('book-slot-info').textContent = `${slotLabel(slot)} – ${slotEndLabel(slot)} · ${dateStr}`;

  document.getElementById('pin-field').className = 'field' + (cfg.enablePin ? '' : ' hidden');

  const id = getSavedIdentity();
  document.getElementById('f-owner').value   = id.owner || '';
  document.getElementById('f-dept').value    = id.dept  || '';
  document.getElementById('f-purpose').value = '';
  document.getElementById('f-pin').value     = '';
  document.getElementById('purpose-count').textContent = '0';
  document.getElementById('purpose-count').parentElement.classList.remove('over');

  showOverlay('book-overlay');
  setTimeout(() => document.getElementById('f-owner').focus(), 100);
}

function bindBookForm() {
  document.getElementById('book-close-x').addEventListener('click',    () => hideOverlay('book-overlay'));
  document.getElementById('book-cancel-btn').addEventListener('click', () => hideOverlay('book-overlay'));
  document.getElementById('book-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) hideOverlay('book-overlay');
  });
  document.getElementById('f-purpose').addEventListener('input', e => {
    const len     = e.target.value.length;
    const counter = document.getElementById('purpose-count');
    counter.textContent = len;
    counter.parentElement.classList.toggle('over', len >= 28);
  });
  document.getElementById('clear-identity-btn').addEventListener('click', () => {
    localStorage.removeItem('mrs:identity');
    document.getElementById('f-owner').value = '';
    document.getElementById('f-dept').value  = '';
    showToast('已清除記住的資料', 'info');
  });
  document.getElementById('book-form').addEventListener('submit', e => { e.preventDefault(); submitBook(); });
}

async function submitBook() {
  if (!pendingBook) return;

  const owner   = document.getElementById('f-owner').value.trim();
  const dept    = document.getElementById('f-dept').value.trim();
  const purpose = document.getElementById('f-purpose').value.trim();
  const pinRaw  = document.getElementById('f-pin').value.trim();
  const cfg     = window.APP_CONFIG;

  if (!owner)   { showToast('請填寫使用人姓名', 'error'); return; }
  if (!dept)    { showToast('請填寫部門', 'error'); return; }
  if (!purpose) { showToast('請填寫用途', 'error'); return; }
  if (purpose.length > cfg.purposeMaxLength) { showToast(`用途上限 ${cfg.purposeMaxLength} 字`, 'error'); return; }
  if (pinRaw && !/^\d{4}$/.test(pinRaw)) { showToast('PIN 須為 4 位數字', 'error'); return; }

  // Final guard: date + slot validity
  if (!isValidDateInCurrentYear(selectedDate)) { showToast('請選擇本年度日期', 'error'); return; }
  if (compareDateToToday(selectedDate) === 'past') { showToast('過去的日期無法預約', 'error'); return; }
  if (isSlotPast(pendingBook.slot)) { showToast('這個時段已過，無法預約', 'error'); return; }

  const { roomId, slot } = pendingBook;
  const gran  = cfg.schedule.granularityMinutes;
  const em    = slotToMins(slot) + gran;
  const booking = {
    room_id:    roomId,
    slot_start: slotLabel(slot),
    slot_end:   `${String(Math.floor(em/60)).padStart(2,'0')}:${String(em%60).padStart(2,'0')}`,
    owner, dept, purpose,
    pin_hash:   pinRaw ? await hashPin(pinRaw) : null,
    created_at: new Date().toISOString(),
    schema_v:   1
  };

  const submitBtn = document.getElementById('book-submit-btn');
  submitBtn.disabled = true; submitBtn.textContent = '送出中…';

  try {
    const result = await adapter.book(selectedDate, roomId, slot, booking);  // ← selectedDate

    if (result.ok) {
      saveIdentity(owner, dept);
      dayData[`${roomId}:${slot}`] = booking;
      hideOverlay('book-overlay');
      const roomName = cfg.rooms.find(r => r.id === roomId)?.name;
      showToast(`預約成功。這間房間暫時屬於你。\n${roomName} ${booking.slot_start}–${booking.slot_end}`, 'success');
      renderDashboard();
      if (currentView === 'manage') renderManage();
      adapter.appendLog(selectedDate, {
        ts: booking.created_at, date: selectedDate,
        action: 'book', room_id: roomId, slot, owner, dept
      });
    } else if (result.reason === 'conflict') {
      showToast('這個時段剛被別人訂走了，已重新整理', 'error');
      hideOverlay('book-overlay');
      load();
    } else {
      showToast(`預約失敗：${result.reason}`, 'error');
    }
  } catch (e) {
    showToast('目前無法同步雲端資料，請稍後再試。', 'error');
  } finally {
    submitBtn.disabled = false; submitBtn.textContent = '確認預約';
  }
}

// ─── Detail / Cancel modal ────────────────────────────────────────────────
function openDetailModal(roomId, slot, booking) {
  const room = window.APP_CONFIG.rooms.find(r => r.id === roomId);
  const rel  = compareDateToToday(selectedDate);
  pendingCancel = { roomId, slot, booking };

  document.getElementById('detail-title').textContent = `預約詳情 · ${room.name}`;

  const dl = document.getElementById('detail-info');
  dl.innerHTML = '';
  const dateStr = new Date(selectedDate + 'T12:00:00+08:00').toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: 'long', day: 'numeric'
  });
  [
    ['日期',   dateStr],
    ['時段',   `${slotLabel(slot)} – ${slotEndLabel(slot)}`],
    ['使用人', booking.owner],
    ['部門',   booking.dept],
    ['用途',   booking.purpose],
    ['預約時間', new Date(booking.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })]
  ].forEach(([label, val]) => {
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd'); dd.textContent = val;
    dl.appendChild(dt); dl.appendChild(dd);
  });

  const pinSec   = document.getElementById('cancel-pin-section');
  const cancelBtn = document.getElementById('detail-cancel-btn');

  // No cancel for past dates
  cancelBtn.hidden = rel === 'past';

  if (booking.pin_hash && rel !== 'past') {
    pinSec.classList.remove('hidden');
    document.getElementById('cancel-pin-input').value = '';
  } else {
    pinSec.classList.add('hidden');
  }

  showOverlay('detail-overlay');
}

function bindDetailModal() {
  document.getElementById('detail-close-x').addEventListener('click',    () => hideOverlay('detail-overlay'));
  document.getElementById('detail-close-btn').addEventListener('click',  () => hideOverlay('detail-overlay'));
  document.getElementById('detail-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) hideOverlay('detail-overlay');
  });
  document.getElementById('detail-cancel-btn').addEventListener('click', submitCancel);
}

async function submitCancel() {
  if (!pendingCancel) return;
  const { roomId, slot, booking } = pendingCancel;

  // Guard: no cancel on past dates
  if (compareDateToToday(selectedDate) === 'past') {
    showToast('過去的預約無法取消', 'error'); return;
  }

  let pin = null;
  if (booking.pin_hash) {
    pin = document.getElementById('cancel-pin-input').value.trim();
    if (!pin) { showToast('PIN 不正確，無法修改或取消這筆預約。', 'error'); return; }
  }

  const btn = document.getElementById('detail-cancel-btn');
  btn.disabled = true; btn.textContent = '取消中…';

  try {
    const result = await adapter.cancel(selectedDate, roomId, slot, pin);  // ← selectedDate

    if (result.ok) {
      dayData[`${roomId}:${slot}`] = null;
      hideOverlay('detail-overlay');
      showToast('已取消預約', 'success');
      renderDashboard();
      if (currentView === 'manage') renderManage();
      adapter.appendLog(selectedDate, {
        ts: new Date().toISOString(), date: selectedDate,
        action: 'cancel', room_id: roomId, slot, owner: booking.owner, dept: booking.dept
      });
    } else if (result.reason === 'pin') {
      showToast('PIN 不正確，無法修改或取消這筆預約。', 'error');
    } else if (result.reason === 'notfound') {
      showToast('該預約已不存在', 'warn');
      hideOverlay('detail-overlay'); load();
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
  window.addEventListener('online',  hide);
  window.addEventListener('offline', show);
}

// ─── Identity persistence ─────────────────────────────────────────────────
function getSavedIdentity() {
  try { return JSON.parse(localStorage.getItem('mrs:identity') || '{}'); } catch { return {}; }
}
function saveIdentity(owner, dept) {
  localStorage.setItem('mrs:identity', JSON.stringify({ owner, dept }));
}

// ─── Overlay helpers ──────────────────────────────────────────────────────
function showOverlay(id) {
  document.getElementById(id).classList.remove('hidden');
  document.body.classList.add('modal-open');
}
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
  }, 4000);
}

// ─── Utilities ────────────────────────────────────────────────────────────
function getTaipeiDate() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
}
function getTaipeiNowMins() {
  const s = new Date().toLocaleTimeString('en-US', {
    timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit'
  });
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}
function slotToMins(slot)   { return parseInt(slot.slice(0,2)) * 60 + parseInt(slot.slice(2)); }
function slotLabel(slot)    { return `${slot.slice(0,2)}:${slot.slice(2)}`; }
function slotEndLabel(slot) {
  const m = slotToMins(slot) + (window.APP_CONFIG?.schedule?.granularityMinutes || 60);
  return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}
function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showConfigError() {
  document.body.innerHTML = `<div class="config-error"><h2>⚙️ 尚未設定 config.js</h2><p>請複製 <code>templates/config.example.js</code> 為根目錄的 <code>config.js</code>，填入 Upstash 連線資訊後重新整理頁面。</p></div>`;
}
function showFatalError(msg) {
  document.body.innerHTML = `<div class="config-error"><h2>⚠️ 初始化失敗</h2><p>${escHtml(msg)}</p></div>`;
}
