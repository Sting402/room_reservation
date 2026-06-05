'use strict';
/* app.js — Meeting Room Scheduler, main application */

// ─── State ────────────────────────────────────────────────────────────────
let adapter      = null;
let slots        = [];        // ["0900","0930",...,"1730"]
let todayDate    = '';        // "2026-06-05"
let dayData      = {};        // {"glass1:0900": booking|null, ...}
let pollTimer    = null;
let activeRoomIdx = 0;
let pendingBook  = null;      // {roomId, slot}
let pendingCancel = null;     // {roomId, slot, booking}
let isLoading    = false;

// ─── Bootstrap ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

function init() {
  if (window.__configMissing || !window.APP_CONFIG) {
    showConfigError();
    return;
  }

  try {
    adapter   = createAdapter();
    slots     = generateSlots(window.APP_CONFIG);
    todayDate = getTaipeiDate();
  } catch (e) {
    showFatalError(e.message);
    return;
  }

  renderHeader();
  renderTabs();
  renderPanels();
  bindBookForm();
  bindDetailModal();
  wireOfflineBanner();

  load();
  startPolling();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopPolling();
    else { load(); startPolling(); }
  });

  document.getElementById('refresh-btn').addEventListener('click', () => load());
}

// ─── Error screens ────────────────────────────────────────────────────────
function showConfigError() {
  document.getElementById('app').innerHTML = `
    <div class="config-error">
      <h2>⚙️ 尚未設定 config.js</h2>
      <p>請複製 <code>templates/config.example.js</code> 為根目錄的 <code>config.js</code>，
      填入 Upstash 連線資訊後重新整理頁面。</p>
    </div>`;
}

function showFatalError(msg) {
  document.getElementById('app').innerHTML = `
    <div class="config-error">
      <h2>⚠️ 初始化失敗</h2>
      <p>${escHtml(msg)}</p>
    </div>`;
}

// ─── Date / Time helpers ─────────────────────────────────────────────────
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

function slotToMins(slot) { return parseInt(slot.slice(0,2)) * 60 + parseInt(slot.slice(2)); }

function slotLabel(slot) { return `${slot.slice(0,2)}:${slot.slice(2)}`; }

function slotEndLabel(slot) {
  const m = slotToMins(slot) + (window.APP_CONFIG?.schedule?.granularityMinutes || 30);
  return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}

function slotRange(slot) { return `${slotLabel(slot)}–${slotEndLabel(slot)}`; }

// ─── Header ───────────────────────────────────────────────────────────────
function renderHeader() {
  const formatted = new Date().toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
  });
  document.getElementById('date-line').textContent = formatted;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────
function renderTabs() {
  const cfg       = window.APP_CONFIG;
  const container = document.getElementById('room-tabs');
  container.innerHTML = '';
  cfg.rooms.forEach((room, i) => {
    const btn = document.createElement('button');
    btn.className = 'room-tab' + (i === activeRoomIdx ? ' active' : '');
    btn.textContent = room.name;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', String(i === activeRoomIdx));
    btn.setAttribute('aria-controls', `panel-${room.id}`);
    btn.addEventListener('click', () => {
      activeRoomIdx = i;
      renderTabs();
      updatePanelVisibility();
    });
    container.appendChild(btn);
  });
}

function updatePanelVisibility() {
  const cfg = window.APP_CONFIG;
  cfg.rooms.forEach((room, i) => {
    const el = document.getElementById(`panel-${room.id}`);
    if (el) el.classList.toggle('active', i === activeRoomIdx);
  });
}

// ─── Panels ───────────────────────────────────────────────────────────────
function renderPanels() {
  const cfg       = window.APP_CONFIG;
  const container = document.getElementById('room-panels');
  container.innerHTML = '';

  cfg.rooms.forEach((room, i) => {
    const section = document.createElement('section');
    section.id = `panel-${room.id}`;
    section.className = 'room-panel' + (i === activeRoomIdx ? ' active' : '');
    section.setAttribute('role', 'tabpanel');

    const h2 = document.createElement('h2');
    h2.className = 'room-name';
    h2.textContent = room.name;
    section.appendChild(h2);

    const grid = document.createElement('div');
    grid.className = 'slot-grid';
    grid.id = `grid-${room.id}`;
    section.appendChild(grid);

    container.appendChild(section);
  });

  updateSlotGrids();
}

// ─── Slot rendering ───────────────────────────────────────────────────────
function updateSlotGrids() {
  const cfg    = window.APP_CONFIG;
  const nowMin = getTaipeiNowMins();
  const gran   = cfg.schedule.granularityMinutes;

  cfg.rooms.forEach(room => {
    const grid = document.getElementById(`grid-${room.id}`);
    if (!grid) return;
    grid.innerHTML = '';

    slots.forEach(slot => {
      const booking  = dayData[`${room.id}:${slot}`] || null;
      const isPast   = (slotToMins(slot) + gran) <= nowMin;

      const row     = document.createElement('div');
      row.className = 'slot-row';

      const timeEl  = document.createElement('span');
      timeEl.className = 'slot-time';
      timeEl.textContent = slotRange(slot);
      row.appendChild(timeEl);

      const btn = document.createElement('button');
      btn.className = 'slot-btn';

      if (isPast) {
        btn.disabled = true;
        if (booking) {
          btn.classList.add('slot-booked', 'slot-past');
          btn.textContent = `${booking.owner} · ${booking.dept}`;
          btn.title = `${booking.owner}（${booking.dept}）`;
        } else {
          btn.classList.add('slot-past');
          btn.textContent = '已過';
        }
      } else if (!booking) {
        btn.classList.add('slot-free');
        btn.textContent = '可預約';
        btn.addEventListener('click', () => openBookModal(room.id, slot));
      } else {
        btn.classList.add('slot-booked');
        btn.textContent = `${booking.owner} · ${booking.dept}`;
        btn.title = `${booking.owner}（${booking.dept}）— 點擊查看詳情`;
        btn.addEventListener('click', () => openDetailModal(room.id, slot, booking));
      }

      row.appendChild(btn);
      grid.appendChild(row);
    });
  });
}

// ─── Data loading ─────────────────────────────────────────────────────────
async function load() {
  if (isLoading) return;
  isLoading = true;
  setStatus('更新中…');

  // Date rollover check
  const newDate = getTaipeiDate();
  if (newDate !== todayDate) {
    todayDate = newDate;
    dayData   = {};
    renderHeader();
  }

  try {
    dayData = await adapter.getDay(todayDate);
    updateSlotGrids();
    const now = new Date().toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
    setStatus(`上次更新：${now}`);
  } catch (e) {
    const msg = e.name === 'AbortError' ? '請求逾時，請檢查網路' : e.message;
    setStatus(`⚠ 讀取失敗：${msg}`, true);
    showToast(`讀取失敗：${msg}`, 'error');
  } finally {
    isLoading = false;
  }
}

// ─── Polling ──────────────────────────────────────────────────────────────
function startPolling() {
  stopPolling();
  const ms = (window.APP_CONFIG?.pollIntervalSeconds || 10) * 1000;
  pollTimer = setInterval(load, ms);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

// ─── Book Modal ───────────────────────────────────────────────────────────
function openBookModal(roomId, slot) {
  const cfg  = window.APP_CONFIG;
  const room = cfg.rooms.find(r => r.id === roomId);
  pendingBook = { roomId, slot };

  document.getElementById('book-title').textContent = `預約 · ${room.name}`;
  document.getElementById('book-slot-info').textContent = slotRange(slot);

  document.getElementById('pin-field').className =
    'field' + (cfg.enablePin ? '' : ' hidden');

  const id = getSavedIdentity();
  document.getElementById('f-owner').value   = id.owner || '';
  document.getElementById('f-dept').value    = id.dept  || '';
  document.getElementById('f-purpose').value = '';
  document.getElementById('f-pin').value     = '';

  showOverlay('book-overlay');
  document.getElementById('f-owner').focus();
}

function bindBookForm() {
  document.getElementById('book-cancel-btn')
    .addEventListener('click', () => hideOverlay('book-overlay'));

  document.getElementById('book-overlay')
    .addEventListener('click', e => { if (e.target === e.currentTarget) hideOverlay('book-overlay'); });

  document.getElementById('book-form')
    .addEventListener('submit', e => { e.preventDefault(); submitBook(); });
}

async function submitBook() {
  if (!pendingBook) return;

  const owner   = document.getElementById('f-owner').value.trim();
  const dept    = document.getElementById('f-dept').value.trim();
  const purpose = document.getElementById('f-purpose').value.trim();
  const pinRaw  = document.getElementById('f-pin').value.trim();
  const cfg     = window.APP_CONFIG;

  if (!owner)   { showToast('請填寫姓名', 'error'); return; }
  if (!dept)    { showToast('請填寫部門', 'error'); return; }
  if (!purpose) { showToast('請填寫事由', 'error'); return; }
  if (purpose.length > cfg.purposeMaxLength) {
    showToast(`事由上限 ${cfg.purposeMaxLength} 字`, 'error'); return;
  }
  if (pinRaw && !/^\d{4}$/.test(pinRaw)) {
    showToast('PIN 須為 4 位數字', 'error'); return;
  }
  if (!cfg.rooms.find(r => r.id === pendingBook.roomId) || !slots.includes(pendingBook.slot)) {
    showToast('無效的房間或時段', 'error'); return;
  }

  const submitBtn = document.getElementById('book-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = '送出中…';

  try {
    const pin_hash = pinRaw ? await hashPin(pinRaw) : null;
    const { roomId, slot } = pendingBook;
    const gran   = cfg.schedule.granularityMinutes;
    const endMin = slotToMins(slot) + gran;
    const booking = {
      room_id:    roomId,
      slot_start: slotLabel(slot),
      slot_end:   `${String(Math.floor(endMin/60)).padStart(2,'0')}:${String(endMin%60).padStart(2,'0')}`,
      owner, dept, purpose, pin_hash,
      created_at: new Date().toISOString(),
      schema_v:   1
    };

    const result = await adapter.book(todayDate, roomId, slot, booking);

    if (result.ok) {
      saveIdentity(owner, dept);
      dayData[`${roomId}:${slot}`] = booking;
      updateSlotGrids();
      hideOverlay('book-overlay');
      showToast(`✅ 預約成功！${booking.slot_start}–${booking.slot_end}`, 'success');
      adapter.appendLog(todayDate, {
        ts: booking.created_at, action: 'book', room_id: roomId, slot, owner, dept
      });
    } else if (result.reason === 'conflict') {
      showToast('⚠ 這個時段剛被別人訂走了，已重新整理', 'warn');
      hideOverlay('book-overlay');
      load();
    } else {
      showToast(`預約失敗：${result.reason}`, 'error');
    }
  } catch (e) {
    showToast(`預約錯誤：${e.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '確認預約';
  }
}

// ─── Detail / Cancel Modal ────────────────────────────────────────────────
function openDetailModal(roomId, slot, booking) {
  const room = window.APP_CONFIG.rooms.find(r => r.id === roomId);
  pendingCancel = { roomId, slot, booking };

  document.getElementById('detail-title').textContent = `預約詳情 · ${room.name}`;

  const dl = document.getElementById('detail-info');
  dl.innerHTML = '';
  [
    ['時段',   slotRange(slot)],
    ['訂位人', booking.owner],
    ['部門',   booking.dept],
    ['事由',   booking.purpose],
    ['訂位時間', new Date(booking.created_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })]
  ].forEach(([label, val]) => {
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd'); dd.textContent = val;
    dl.appendChild(dt); dl.appendChild(dd);
  });

  const pinSec = document.getElementById('cancel-pin-section');
  if (booking.pin_hash) {
    pinSec.classList.remove('hidden');
    document.getElementById('cancel-pin-input').value = '';
  } else {
    pinSec.classList.add('hidden');
  }

  showOverlay('detail-overlay');
}

function bindDetailModal() {
  document.getElementById('detail-close-btn')
    .addEventListener('click', () => hideOverlay('detail-overlay'));

  document.getElementById('detail-overlay')
    .addEventListener('click', e => { if (e.target === e.currentTarget) hideOverlay('detail-overlay'); });

  document.getElementById('detail-cancel-btn')
    .addEventListener('click', submitCancel);
}

async function submitCancel() {
  if (!pendingCancel) return;
  const { roomId, slot, booking } = pendingCancel;

  let pin = null;
  if (booking.pin_hash) {
    pin = document.getElementById('cancel-pin-input').value.trim();
    if (!pin) { showToast('請輸入 PIN', 'error'); return; }
  }

  const btn = document.getElementById('detail-cancel-btn');
  btn.disabled = true;
  btn.textContent = '取消中…';

  try {
    const result = await adapter.cancel(todayDate, roomId, slot, pin);

    if (result.ok) {
      dayData[`${roomId}:${slot}`] = null;
      updateSlotGrids();
      hideOverlay('detail-overlay');
      showToast('✅ 已取消預約', 'success');
      adapter.appendLog(todayDate, {
        ts: new Date().toISOString(), action: 'cancel',
        room_id: roomId, slot, owner: booking.owner, dept: booking.dept
      });
    } else if (result.reason === 'pin') {
      showToast('PIN 不正確', 'error');
    } else if (result.reason === 'notfound') {
      showToast('該預約已不存在', 'warn');
      hideOverlay('detail-overlay');
      load();
    } else {
      showToast(`取消失敗：${result.reason}`, 'error');
    }
  } catch (e) {
    showToast(`取消錯誤：${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '取消預約';
  }
}

// ─── Offline detection ────────────────────────────────────────────────────
function wireOfflineBanner() {
  let banner = null;

  function showBanner() {
    if (banner) return;
    banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.textContent = '⚠ 目前離線，資料可能未同步';
    document.getElementById('header').after(banner);
  }
  function hideBanner() {
    if (banner) { banner.remove(); banner = null; }
  }

  if (!navigator.onLine) showBanner();
  window.addEventListener('online',  hideBanner);
  window.addEventListener('offline', showBanner);
}

// ─── Identity persistence ─────────────────────────────────────────────────
function getSavedIdentity() {
  try { return JSON.parse(localStorage.getItem('mrs:identity') || '{}'); } catch { return {}; }
}
function saveIdentity(owner, dept) {
  localStorage.setItem('mrs:identity', JSON.stringify({ owner, dept }));
}

// ─── UI helpers ───────────────────────────────────────────────────────────
function showOverlay(id) {
  document.getElementById(id).classList.remove('hidden');
  document.body.classList.add('modal-open');
}
function hideOverlay(id) {
  document.getElementById(id).classList.add('hidden');
  document.body.classList.remove('modal-open');
  pendingBook   = null;
  pendingCancel = null;
}

function setStatus(msg, isError = false) {
  const el = document.getElementById('status-line');
  el.textContent = msg;
  el.className = 'status-line' + (isError ? ' status-error' : '');
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('toast-show'));
  });
  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 500); // fallback
  }, 3500);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
