import './store.js';
import './scanner.js';

const store = window.store;
// DOM
const loginBox = document.getElementById('loginBox');
const appBox   = document.getElementById('appBox');
const loginInput = document.getElementById('loginInput');
const passInput  = document.getElementById('passInput');
const loginBtn   = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');

const logoutBtn  = document.getElementById('logoutBtn');
const currentObjectSpan = document.getElementById('currentObject');
const userChip = document.getElementById('userChip');

const listEl = document.getElementById('list');
const searchInput = document.getElementById('search');

const userControls = document.getElementById('userControls');
const adminPanel = document.getElementById('adminPanel');

const transferBtn = document.getElementById('transferBtn');
const transferBadge = document.getElementById('transferBadge');
let lastTransferUpdateTs = Number(localStorage.getItem('lastTransferUpdateTs') || 0);

const netChip = document.getElementById('netChip');
const queueChip = document.getElementById('queueChip');

function setNetStatus() {
  const on = navigator.onLine === true;
  if (!netChip) return;
  netChip.textContent = on ? '🟢 Online' : '🔴 Offline';
  netChip.style.opacity = on ? '1' : '0.95';
}

async function refreshQueueChip() {
  if (!queueChip || !store.queueCount) return;
  try {
    const n = await store.queueCount();
    if (n > 0) {
      queueChip.textContent = `⏳ ${n}`;
      queueChip.classList.remove('hidden');
    } else {
      queueChip.classList.add('hidden');
    }
  } catch {}
}

// toast
// toast
const toastEl = document.getElementById('toast');

let toastTimer = null;

// === PUSH visibility fix (для слабых Android PWA) ===
let needRefreshAfterPush = false;

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && needRefreshAfterPush) {
    needRefreshAfterPush = false;

    // обновляем данные только когда вкладка снова активна
    updateTransferBadge().catch(() => {});
    pollTransferUpdates().catch(() => {});
  }
});

function hideToast(){
  if (!toastEl) return;
  toastEl.classList.add('hidden');
  toastEl.innerHTML = '';
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
}

function appToast(msg, opts = {}) {
  if (!toastEl) return;

  const {
    sticky = false,      // если true — не закрываем автоматически
    timeout = 2200       // время автозакрытия для не-sticky
  } = opts || {};

  // очистим предыдущий таймер
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  // строим DOM безопасно (без innerHTML с пользовательским текстом)
  toastEl.innerHTML = '';
  toastEl.classList.remove('hidden');

  toastEl.style.display = 'flex';
  toastEl.style.alignItems = 'center';
  toastEl.style.justifyContent = 'space-between';
  toastEl.style.gap = '10px';

  const text = document.createElement('div');
  text.textContent = String(msg || '');

  toastEl.appendChild(text);

  if (sticky) {
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.title = 'Закрыть';
    closeBtn.style.border = 'none';
    closeBtn.style.background = 'transparent';
    closeBtn.style.color = 'inherit';
    closeBtn.style.fontSize = '16px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '2px 6px';
    closeBtn.onclick = hideToast;

    toastEl.appendChild(closeBtn);

    // опционально: закрывать по клику на само уведомление
    // toastEl.onclick = hideToast;

  } else {
    toastTimer = setTimeout(hideToast, Number(timeout) || 2200);
  }
}

window.appToast = appToast;

function soon(msg = 'Скоро будет ✅') {
  appToast(msg);
}

/* ================= Splash Logic ================= */

function splashSetText(text){
  const el = document.getElementById('splashText');
  if (el) el.textContent = text;
}

function splashSetProgress(p){
  const bar = document.getElementById('splashBar');
  if (bar) bar.style.width = `${Math.min(100, Math.max(0, p))}%`;
}

function splashHide(){
  const el = document.getElementById('appSplash');
  if (!el) return;
  el.classList.add('hide');
  setTimeout(() => el.remove(), 400);
}

/* страховка — если что-то зависло */
setTimeout(() => splashHide(), 8000);

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* ===========================
   ✅ Helpers: safe DOM remove
   =========================== */
function removeListRowByDataset(listNode, datasetKey, id) {
  if (!listNode || !id) return false;
  const rows = listNode.querySelectorAll('li');
  for (const li of rows) {
    if (li?.dataset?.[datasetKey] === id) {
      li.remove();
      return true;
    }
  }
  return false;
}

// ================================
// Modals: history
// ================================
const historyModal = document.getElementById('historyModal');
const hTitle = document.getElementById('hTitle');
const hBody  = document.getElementById('hBody');
const hClose = document.getElementById('hClose');

const trInfoModal = document.getElementById('trInfoModal');
const trInfoTitle = document.getElementById('trInfoTitle');
const trInfoBody  = document.getElementById('trInfoBody');
const trInfoClose = document.getElementById('trInfoClose');

function closeTrInfo(){
  trInfoModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

if (trInfoClose) trInfoClose.onclick = closeTrInfo;

// закрытие по клику на фон (как в reportModal)
if (trInfoModal) {
  trInfoModal.addEventListener('click', (e) => {
    if (e.target === trInfoModal) closeTrInfo();
  });
}

hClose.onclick = () => historyModal.classList.add('hidden');

function ymdLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function ymdToStartTs(ymd){
  const [y,m,d] = ymd.split('-').map(Number);
  return new Date(y, m-1, d, 0,0,0,0).getTime();
}
function ymdToEndTs(ymd){
  const [y,m,d] = ymd.split('-').map(Number);
  return new Date(y, m-1, d, 23,59,59,999).getTime();
}

async function openHistory(itemId){
  const item = store.getItem(itemId);
  if (!item) return;

  hTitle.textContent = `📜 История — ${item.name}`;

  // ✅ дефолт: 7 дней
  const to = new Date();
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  hBody.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:10px">
      <div style="flex:1;min-width:140px">
        <label style="margin:0 0 6px">С</label>
        <input id="hFrom" type="date" value="${ymdLocal(from)}">
      </div>
      <div style="flex:1;min-width:140px">
        <label style="margin:0 0 6px">По</label>
        <input id="hTo" type="date" value="${ymdLocal(to)}">
      </div>
      <div style="min-width:160px">
        <button class="btn btn-secondary w100" id="hApply">Показать</button>
      </div>
    </div>

    <div class="history-body" id="hList">
      <div class="muted">Загрузка…</div>
    </div>
  `;

  historyModal.classList.remove('hidden');

  async function load(){
    const hFrom = document.getElementById('hFrom');
    const hTo = document.getElementById('hTo');
    const hList = document.getElementById('hList');

    const fromYmd = hFrom?.value;
    const toYmd = hTo?.value;

    if (!fromYmd || !toYmd) {
      hList.innerHTML = `<div class="muted">Выберите даты</div>`;
      return;
    }

    const fromTs = ymdToStartTs(fromYmd);
    const toTs = ymdToEndTs(toYmd);
    if (toTs < fromTs) {
      hList.innerHTML = `<div class="muted">Конечная дата меньше начальной</div>`;
      return;
    }

    hList.innerHTML = `<div class="muted">Загрузка…</div>`;

    try {
      const ops = await store.getHistory(itemId, { fromTs, toTs });

      hList.innerHTML = ops.length
        ? ops.map(o => {
            const sign = o.type === 'in' ? '+' : '-';
            const typeLabel = o.type === 'in' ? 'Приход' : 'Расход';
            return `
  <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08)">
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
      <div>
        <b>${sign}${o.qty}</b>
        <span class="muted">| ${escapeHtml(o.from)}</span>
      </div>

      <div style="display:flex;gap:10px;align-items:center">
        ${o.damaged ? `<span title="Повреждено" style="font-size:14px">🔷</span>` : ''}
        ${o.hasComment && o.transferId ? `<button class="btn btn-secondary" style="padding:6px 10px" data-trc="${o.transferId}" title="Открыть комментарий">💬</button>` : ''}
        <div class="muted">${typeLabel}</div>
      </div>
    </div>

    <div class="muted" style="font-size:13px">${escapeHtml(o.time)}</div>
  </div>
`;
          }).join('')
        : `<div class="muted">Нет операций за выбранный период</div>`;
    hList.querySelectorAll('[data-trc]').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const id = btn.getAttribute('data-trc');
    await openTransferInfo(id);
  });
});
    
      } catch (e) {
      console.error(e);
      hList.innerHTML = `<div class="muted">Ошибка загрузки истории</div>`;
    }
  }

  const hApply = document.getElementById('hApply');
  if (hApply) hApply.onclick = load;

  await load();
}
async function openTransferInfo(transferId){
  if (!transferId) return;

  trInfoTitle.textContent = '💬 Детали передачи';
  trInfoBody.innerHTML = `<div class="muted">Загрузка…</div>`;

  // ✅ важно для корректного отображения поверх
  document.body.classList.add('modal-open');
  trInfoModal.classList.remove('hidden');

  try {
    const r = await store.getTransferDetails(transferId);
    if (!r.ok) {
      trInfoBody.innerHTML = `<div class="muted">Ошибка: ${escapeHtml(r.error || 'server')}</div>`;
      return;
    }

    const t = r.transfer;

    trInfoBody.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div><b>${escapeHtml(t.name)}</b> <span class="muted">(${escapeHtml(t.code)})</span></div>
        <div class="muted">Кол-во: <b>${t.qty}</b></div>
        <div class="muted">Откуда: <b>${escapeHtml(t.fromObjectName)}</b></div>
        <div class="muted">Куда: <b>${escapeHtml(t.toObjectName)}</b></div>
        <div class="muted">Когда: <b>${escapeHtml(t.time)}</b></div>
        <div class="muted">Статус: <b>${escapeHtml(String(t.status || ''))}</b></div>
        ${t.damaged ? `<div class="muted">⚠️ <b>Повреждено</b></div>` : ''}
        ${t.comment
          ? `<div style="margin-top:6px">
               <div class="muted">Комментарий:</div>
               <div><b>${escapeHtml(t.comment)}</b></div>
             </div>`
          : `<div class="muted">Комментария нет</div>`}
      </div>
    `;
  } catch (e) {
    console.error(e);
    trInfoBody.innerHTML = `<div class="muted">Ошибка загрузки</div>`;
  }
}
async function pollTransferUpdates() {
  const u = await store.currentUserObj();
  if (!u || u.role !== 'user') return;

  // получаем обновления по передачам, где я ОТПРАВИТЕЛЬ
  const r = await store.getTransferUpdates(lastTransferUpdateTs);
  if (!r.ok) return;

  const updates = r.updates || [];
  if (!updates.length) return;

  for (const t of updates) {
    if (t.status === 'REJECTED') {
      // ✅ главное уведомление
      appToast(`⛔ ${t.toObjectName} отказался принять: ${t.name} ×${t.qty}. Баланс не изменился.`, { sticky: true });
    } else if (t.status === 'ACCEPTED') {
      // опционально — уведомление о принятии
      appToast(`✅ ${t.toObjectName} принял: ${t.name} ×${t.qty}.`);
    }
  }

  // обновляем sinceTs на максимальный actedTs
  const maxTs = updates.reduce((m, x) => Math.max(m, Number(x.actedTs || 0)), lastTransferUpdateTs);
  lastTransferUpdateTs = maxTs;
  localStorage.setItem('lastTransferUpdateTs', String(lastTransferUpdateTs));

  // чтобы badge/списки обновлялись
  await updateTransferBadge();
   // ✅ подтягиваем актуальные остатки и перерисовываем список отправителя
  await store.getItems();                 // для user возьмёт его склад
  await renderList(searchInput.value);    // обновит UI сразу
  // await renderList(document.getElementById('search')?.value || '');
}

// ================================
// PUSH client (SW + subscribe)
// ================================
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(ch => ch.charCodeAt(0)));
}

// простой "пик" для онлайн-режима (когда вкладка видима)
function playOnlineBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);

    o.type = 'sine';
    o.frequency.value = 880;

    // чуть громче, но не режет уши
    g.gain.value = 0.12;

    o.start();

    // 1) первый бип 260мс
    setTimeout(() => {
      // 2) пауза 120мс и второй бип 260мс (меняем частоту)
      o.frequency.value = 660;
    }, 260);

    setTimeout(() => {
      o.stop();
      ctx.close().catch(() => {});
    }, 260 + 120 + 260);

  } catch {}
}
function playOnlineVibrate() {
  try {
    if (navigator.vibrate) navigator.vibrate([60, 30, 120]);
  } catch {}
}

async function initPushIfPossible() {
  try {
    const u = await store.currentUserObj();
    if (!u) return;
    // можно включать только для user-ролей (как тебе надо)
    if (u.role !== 'user') return;

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    // регистрируем SW
    const reg = await navigator.serviceWorker.register('/sw.js');

    // слушаем сообщения от SW (когда приложение видно)
    navigator.serviceWorker.addEventListener('message', (event) => {
      const msg = event.data || {};
      if (msg.type === 'PUSH_EVENT') {
        const p = msg.payload || {};
        // показываем toast + звук внутри страницы
        if (p?.body) appToast(p.body);
        else if (p?.title) appToast(p.title);

        playOnlineBeep();
  playOnlineVibrate();

        
        needRefreshAfterPush = true;
         // ✅ если страница прямо сейчас видима — обновим сразу, без ожидания смены вкладки
        if (document.visibilityState === 'visible') {
          pollTransferUpdates().catch(() => {});
        }
      }
      if (msg.type === 'OPEN_URL' && msg.url) {
        // если надо — можно роутить, но у нас одна страница
      }
    });

    // если уже разрешено — подписываемся молча
    if (Notification.permission === 'granted') {
      const pk = await store.getPushPublicKey();
      if (!pk.ok) return;

      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await store.pushSubscribe(existing);
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pk.publicKey)
      });

      await store.pushSubscribe(sub);
      return;
    }

    // если пользователь еще не дал разрешение — попросим один раз (после логина)
    if (Notification.permission === 'default') {
      // можно мягко: через confirm
      openConfirm({
        title: 'Уведомления',
        text: 'Разрешить уведомления о передачах? Тогда вы увидите их даже на заблокированном экране.',
        yesText: 'Разрешить',
        onYes: async () => {
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') {
            appToast('Уведомления не разрешены');
            return;
          }
          const pk = await store.getPushPublicKey();
          if (!pk.ok) return;

          const existing = await reg.pushManager.getSubscription();
          if (existing) {
            await store.pushSubscribe(existing);
            appToast('✅ Уведомления включены');
            return;
          }

          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(pk.publicKey)
          });

          await store.pushSubscribe(sub);
          appToast('✅ Уведомления включены');
        }
      });
    }
  } catch (e) {
    console.log('initPushIfPossible error', e);
  }
}
// ================================
// Modals: writeoff
// ================================
const writeoffModal = document.getElementById('writeoffModal');
const wTitle = document.getElementById('wTitle');
const wQty = document.getElementById('wQty');
const wTo  = document.getElementById('wTo');
const wError = document.getElementById('wError');
const wSave = document.getElementById('wSave');
const wCancel = document.getElementById('wCancel');
let writeoffItemId = null;

wCancel.onclick = () => writeoffModal.classList.add('hidden');

function openWriteoff(itemId){
  const item = store.getItem(itemId);
  if (!item) return;

  writeoffItemId = itemId;
  wTitle.textContent = `${item.name} (доступно: ${item.quantity})`;
  wQty.value = '';
  wTo.value  = '';
  wError.textContent = '';
  writeoffModal.classList.remove('hidden');
}

wSave.onclick = async () => {
  const item = store.getItem(writeoffItemId);
  if (!item) return;

  const n = Number(wQty.value);
  if (!Number.isFinite(n) || n <= 0) { wError.textContent = 'Количество должно быть числом > 0'; return; }
  if (n > item.quantity) { wError.textContent = 'Недостаточно остатка'; return; }

  const to = (wTo.value || 'Списание').trim();

  wSave.disabled = true;
  try {
    const res = await store.addOperation({
      code: item.code,
      name: item.name,
      qty: n,
      from: to,
      type: 'out'
    });

    if (!res.ok) { wError.textContent = `Ошибка списания: ${res.error || 'server'}`; return; }

    writeoffModal.classList.add('hidden');
    await renderList(searchInput.value);
    appToast('✅ Списано');
  } finally {
    wSave.disabled = false;
  }
};

// ================================
// Transfers UI
// ================================
const transferModal = document.getElementById('transferModal');
const incomingModal = document.getElementById('incomingModal');
const incomingClose = document.getElementById('incomingClose');
const cancelTransfer  = document.getElementById('cancelTransfer');

const transferTo = document.getElementById('transferTo');
const transferQty = document.getElementById('transferQty');
const transferError = document.getElementById('transferError');
const transferDamaged = document.getElementById('transferDamaged');
const transferComment = document.getElementById('transferComment');
const confirmTransfer = document.getElementById('confirmTransfer');
const transferItemName = document.getElementById('transferItemName');
const incomingList = document.getElementById('incomingList');

let transferItemId = null;

if (cancelTransfer) cancelTransfer.onclick = () => {
  transferModal?.classList.add('hidden');
  document.body.classList.remove('modal-open');
};
if (incomingClose) incomingClose.onclick = () => {
  incomingModal?.classList.add('hidden');
  document.body.classList.remove('modal-open');
};

async function updateTransferBadge(){
  const u = await store.currentUserObj();
  if (!u || u.role !== 'user') {
    if (transferBadge) transferBadge.classList.add('hidden');
    return;
  }

  if (!store.getIncomingTransfers || !store.getOutgoingTransfers) {
    if (transferBadge) transferBadge.classList.add('hidden');
    return;
  }

  const [inc, out] = await Promise.all([
    store.getIncomingTransfers(),
    store.getOutgoingTransfers()
  ]);

  const nIn = inc.ok ? (inc.transfers?.length || 0) : 0;
  const nOut = out.ok ? (out.transfers?.length || 0) : 0;

  const nTotal = nIn + nOut;

  if (!transferBadge) return;
  if (nTotal > 0) {
    transferBadge.textContent = String(nTotal);
    transferBadge.classList.remove('hidden');
    transferBadge.title = `Входящие: ${nIn}, Исходящие: ${nOut}`;
  } else {
    transferBadge.classList.add('hidden');
  }
}

async function openTransferModal(itemId){
  const u = await store.currentUserObj();
  if (!u || u.role !== 'user') return;

  transferItemId = itemId;
  const item = store.getItem(itemId);
  if (!item) return;

  transferError.textContent = '';
  transferQty.value = '';
   if (transferDamaged) transferDamaged.checked = false;
  if (transferComment) transferComment.value = '';
  transferItemName.textContent = `Товар: ${item.name} (доступно: ${item.quantity})`;

  const objs = await store.getObjects();

  const options = objs
    .filter(o => o.id !== u.objectId)
    .map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`)
    .join('');

  transferTo.innerHTML = options || `<option value="">Нет доступных объектов</option>`;

  document.body.classList.add('modal-open');
  transferModal.classList.remove('hidden');
}

async function closeTransferModal(){
  transferModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
  transferItemId = null;
}

if (confirmTransfer) {
  confirmTransfer.onclick = async () => {
    transferError.textContent = '';

    const u = await store.currentUserObj();
    if (!u || u.role !== 'user') { transferError.textContent = 'Нет доступа'; return; }

    const item = store.getItem(transferItemId);
    if (!item) { transferError.textContent = 'Товар не найден'; return; }

    const toObjectId = transferTo.value;
    const qty = Number(transferQty.value);

    if (!toObjectId) { transferError.textContent = 'Выберите объект'; return; }
    if (!Number.isFinite(qty) || qty <= 0) { transferError.textContent = 'Количество должно быть > 0'; return; }
    if (qty > item.quantity) { transferError.textContent = 'Недостаточно остатка'; return; }

    confirmTransfer.disabled = true;
    try {
      const damaged = !!transferDamaged?.checked;
    const comment = String(transferComment?.value || '').trim();

    const r = await store.createTransfer({ itemId: item.id, toObjectId, qty, damaged, comment });
      if (!r.ok) {
        const msg =
          r.error === 'not-enough' ? 'Недостаточно остатка' :
          r.error === 'same-object' ? 'Нельзя передать на тот же объект' :
          `Ошибка: ${r.status || ''} ${r.error || 'server'}`;
        transferError.textContent = msg;
        return;
      }

      await closeTransferModal();
      await renderList(searchInput.value);
      await updateTransferBadge();
      appToast('📤 Передача создана');
    } finally {
      confirmTransfer.disabled = false;
    }
  };
}

async function openIncomingTransfers() {
  const u = await store.currentUserObj();
  if (!u || u.role !== 'user') return;

  if (!incomingList || !incomingModal) return;

  incomingList.innerHTML = `<li><span class="muted">Загрузка…</span></li>`;
  incomingModal.classList.remove('hidden');
  document.body.classList.add('modal-open');

  const [inc, out] = await Promise.all([
    store.getIncomingTransfers(),
    store.getOutgoingTransfers()
  ]);

  if (!inc.ok && !out.ok) {
    incomingList.innerHTML =
      `<li><span class="muted">Ошибка: ${inc.status || out.status || ''} ${inc.error || out.error || ''}</span></li>`;
    return;
  }

  const incoming = inc.ok ? (inc.transfers || []) : [];
  const outgoing = out.ok ? (out.transfers || []) : [];

  incomingList.innerHTML = '';

  const headIn = document.createElement('li');
  headIn.innerHTML = `<b>📥 Входящие (ожидают)</b>`;
  incomingList.appendChild(headIn);

  if (!incoming.length) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="muted">Нет входящих передач</span>`;
    incomingList.appendChild(li);
  } else {
    incoming.forEach(t => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:6px;width:100%">
          <div><b>${escapeHtml(t.name)}</b> <span class="muted">(${escapeHtml(t.code)})</span></div>
          <div class="muted">Откуда: <b>${escapeHtml(t.fromObjectName || '—')}</b></div>
          <div class="muted">Кол-во: <b>${t.qty}</b></div>
          <div class="muted">${escapeHtml(t.time || '')}</div>
           ${t.damaged ? `<div class="muted">⚠️ <b>Повреждено</b></div>` : ''}
          ${t.comment ? `<div class="muted">💬 ${escapeHtml(t.comment)}</div>` : ''}

          <div style="display:flex;gap:10px;margin-top:6px;flex-wrap:wrap">
            <button class="btn btn-primary" data-accept="${t.id}">✅ Принять</button>
            <button class="btn btn-danger" data-reject="${t.id}">✖ Отклонить</button>
          </div>
        </div>
      `;
      incomingList.appendChild(li);
    });
  }

  const hr = document.createElement('li');
  hr.innerHTML = `<div style="height:1px;background:rgba(255,255,255,.08);margin:6px 0"></div>`;
  incomingList.appendChild(hr);

  const headOut = document.createElement('li');
  headOut.innerHTML = `<b>📤 Исходящие (ожидают подтверждения)</b>`;
  incomingList.appendChild(headOut);

  if (!outgoing.length) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="muted">Нет исходящих ожиданий</span>`;
    incomingList.appendChild(li);
  } else {
    outgoing.forEach(t => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:6px;width:100%">
          <div><b>${escapeHtml(t.name)}</b> <span class="muted">(${escapeHtml(t.code)})</span></div>
          <div class="muted">Куда: <b>${escapeHtml(t.toObjectName || '—')}</b></div>
          <div class="muted">Кол-во: <b>${t.qty}</b></div>
          <div class="muted">${escapeHtml(t.time || '')}</div>
          ${t.damaged ? `<div class="muted">⚠️ <b>Повреждено</b></div>` : ''}
          ${t.comment ? `<div class="muted">💬 ${escapeHtml(t.comment)}</div>` : ''}
          <div class="muted">Статус: <b>ожидает</b></div>
        </div>
      `;
      incomingList.appendChild(li);
    });
  }

  incomingList.querySelectorAll('[data-accept]').forEach(btn => {
    btn.onclick = async () => {
      btn.disabled = true;
      const id = btn.getAttribute('data-accept');
      const r = await store.acceptTransfer(id);
      if (!r.ok) {
        window.appToast?.(`Ошибка: ${r.status || ''} ${r.error || ''}`.trim());
        btn.disabled = false;
        return;
      }
      window.appToast?.('✅ Принято');
      await renderList(document.getElementById('search')?.value || '');
      await updateTransferBadge();
      await openIncomingTransfers();
    };
  });

  incomingList.querySelectorAll('[data-reject]').forEach(btn => {
    btn.onclick = async () => {
      btn.disabled = true;
      const id = btn.getAttribute('data-reject');
      const r = await store.rejectTransfer(id);
      if (!r.ok) {
        window.appToast?.(`Ошибка: ${r.status || ''} ${r.error || ''}`.trim());
        btn.disabled = false;
        return;
      }
      window.appToast?.('⛔ Отклонено');
      await updateTransferBadge();
      await openIncomingTransfers();
    };
  });
}
if (transferBtn) {
  transferBtn.onclick = async () => {
    await openIncomingTransfers();
  };
}

// ================================
// Admin panel (CRUD включаем)
// ================================
const objectsList = document.getElementById('objectsList');
const usersList   = document.getElementById('usersList');
// ✅ EVENT DELEGATION: удаление объектов (всегда работает, даже после перерендера)
if (objectsList) {
  objectsList.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-del-obj]');
    if (!btn) return;

    const id = btn.getAttribute('data-del-obj');
    const name = store.getObjectById(id)?.name || 'Склад';

    openConfirm({
      title: 'Удалить склад?',
      text: `Склад "${name}" будет деактивирован (и все пользователи этого склада тоже). Продолжить?`,
      yesText: 'Да',
      onYes: () => {
        openConfirm({
          title: 'Точно удалить?',
          text: `Подтвердите удаление склада "${name}".`,
          yesText: 'Удалить',
          onYes: async () => {
            // ✅ UX: сразу убираем из UI
            const li = btn.closest('li');
            if (li) li.remove();

            const r = await store.adminDeleteObject(id);
            if (!r.ok) {
              appToast(`Ошибка: ${r.status || ''} ${r.error || ''}`.trim());
              // откатимся к актуальному состоянию
              await store.getObjects();
              await initAdminObjectSelect();
              renderAdmin();
              await renderAdminUsers();
              return;
            }

            appToast('✅ Склад удалён');
            await store.getObjects();
            await initAdminObjectSelect();
            renderAdmin();
            await renderAdminUsers();
          }
        });
      }
    });
  });
}

// ✅ EVENT DELEGATION: удаление пользователей (всегда работает, даже после перерендера)
if (usersList) {
  usersList.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-del-user]');
    if (!btn) return;

    const id = btn.getAttribute('data-del-user');

    openConfirm({
      title: 'Удалить пользователя?',
      text: 'Пользователь будет деактивирован и не сможет войти. Продолжить?',
      yesText: 'Да',
      onYes: () => {
        openConfirm({
          title: 'Точно удалить?',
          text: 'Подтвердите удаление пользователя.',
          yesText: 'Удалить',
          onYes: async () => {
            // ✅ UX: сразу убираем из UI
            const li = btn.closest('li');
            if (li) li.remove();

            const r = await store.adminDeleteUser(id);
            if (!r.ok) {
              const msg =
                r.error === 'cannot-delete-self'
                  ? 'Нельзя удалить себя'
                  : `Ошибка: ${r.status || ''} ${r.error || ''}`;
              appToast(msg.trim());

              await renderAdminUsers();
              return;
            }

            appToast('✅ Пользователь удалён');
            await renderAdminUsers();
          }
        });
      }
    });
  });
}

const addObjectModal = document.getElementById('addObjectModal');
const openAddObject  = document.getElementById('openAddObject');
const objName  = document.getElementById('objName');
const objError = document.getElementById('objError');
const objSave  = document.getElementById('objSave');
const objCancel= document.getElementById('objCancel');

const addUserModal = document.getElementById('addUserModal');
const openAddUser  = document.getElementById('openAddUser');
const uLogin = document.getElementById('uLogin');
const uObject= document.getElementById('uObject');
const uPass  = document.getElementById('uPass');
const uError = document.getElementById('uError');
const uSave  = document.getElementById('uSave');
const uCancel= document.getElementById('uCancel');

async function renderAdminUsers(){
  if (!usersList) return;

  const me = await store.currentUserObj();

  const r = await store.getUsers();
  if (!r.ok) {
    usersList.innerHTML = `<li><span class="muted">Ошибка загрузки пользователей</span></li>`;
    return;
  }

  // сервер уже отдаёт только active=true и без меня,
  // но оставим фильтры как “страховку”
  const users = (r.users || [])
    .filter(u => u && u.active)
    .filter(u => u.id !== me?.id);

  if (!users.length) {
    usersList.innerHTML = `<li><span class="muted">Пользователей нет</span></li>`;
    return;
  }

  usersList.innerHTML = '';

  users.forEach(u => {
    const li = document.createElement('li');
    li.dataset.userId = u.id;

    li.innerHTML = `
      <span>👤 ${escapeHtml(u.login)} <span class="muted">(${escapeHtml(u.role)})</span></span>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="muted">${escapeHtml(u.objectName || '—')}</span>
        <button class="btn btn-danger" style="padding:8px 10px" data-del-user="${u.id}">🗑</button>
      </div>
    `;

    usersList.appendChild(li);
  });

  // usersList.querySelectorAll('[data-del-user]').forEach(btn => {
  //   btn.onclick = async () => {
  //     const id = btn.getAttribute('data-del-user');

  //     openConfirm({
  //       title: 'Удалить пользователя?',
  //       text: `Пользователь будет деактивирован и не сможет войти. Продолжить?`,
  //       yesText: 'Да',
  //       onYes: () => {
  //         openConfirm({
  //           title: 'Точно удалить?',
  //           text: `Подтвердите удаление пользователя.`,
  //           yesText: 'Удалить',
  //           onYes: async () => {
  //             // ✅ моментально убираем из списка (без CSS.escape, чтобы нигде не падало)
  //             removeListRowByDataset(usersList, 'userId', id);

  //             const resp = await store.adminDeleteUser(id);
  //             if (!resp.ok) {
  //               const msg =
  //                 resp.error === 'cannot-delete-self'
  //                   ? 'Нельзя удалить себя'
  //                   : `Ошибка: ${resp.status || ''} ${resp.error || ''}`;
  //               appToast(msg.trim());

  //               // ✅ откат/синхронизация
  //               await renderAdminUsers();
  //               return;
  //             }

  //             appToast('✅ Пользователь удалён');
  //             await renderAdminUsers(); // ✅ финальная синхронизация
  //           }
  //         });
  //       }
  //     });
  //   };
  // });
}

// --- Object modal ---
if (openAddObject) openAddObject.onclick = async () => {
  if (!addObjectModal) return;
  objName.value = '';
  objError.textContent = '';
  addObjectModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
};

if (objCancel) objCancel.onclick = () => {
  addObjectModal?.classList.add('hidden');
  document.body.classList.remove('modal-open');
};

if (objSave) objSave.onclick = async () => {
  objError.textContent = '';
  const name = (objName.value || '').trim();
  if (!name) { objError.textContent = 'Введите название'; return; }

  objSave.disabled = true;
  try {
    const r = await store.adminCreateObject({ name });
    if (!r.ok) {
      const msg =
        r.error === 'object-exists' ? 'Такой склад уже существует' :
        r.error === 'name-required' ? 'Название обязательно' :
        `Ошибка: ${r.status || ''} ${r.error || ''}`;
      objError.textContent = msg.trim();
      return;
    }

    addObjectModal.classList.add('hidden');
    document.body.classList.remove('modal-open');

    await store.getObjects();
    await initAdminObjectSelect();
    renderAdmin();
    appToast('✅ Склад создан');
  } finally {
    objSave.disabled = false;
  }
};

// --- User modal ---
if (openAddUser) openAddUser.onclick = async () => {
  if (!addUserModal) return;

  uLogin.value = '';
  uPass.value = '';
  uError.textContent = '';

  const objs = await store.getObjects();
  if (uObject) {
    uObject.innerHTML =
      `<option value="">Выберите склад</option>` +
      (objs || []).map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');
  }

  addUserModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
};

if (uCancel) uCancel.onclick = () => {
  addUserModal?.classList.add('hidden');
  document.body.classList.remove('modal-open');
};

if (uSave) uSave.onclick = async () => {
  uError.textContent = '';

  const login = (uLogin.value || '').trim();
  const password = String(uPass.value || '');
  const objectId = uObject?.value || '';

  if (!login) { uError.textContent = 'Введите логин'; return; }
  if (!password || password.length < 4) { uError.textContent = 'Пароль минимум 4 символа'; return; }
  if (!objectId) { uError.textContent = 'Выберите склад'; return; }

  uSave.disabled = true;
  try {
    const r = await store.adminCreateUser({ login, password, role: 'user', objectId });
    if (!r.ok) {
      const msg =
        r.error === 'login-exists' ? 'Логин уже занят' :
        r.error === 'object-not-found' ? 'Склад не найден' :
        r.error === 'weak-password' ? 'Слишком простой пароль' :
        `Ошибка: ${r.status || ''} ${r.error || ''}`;
      uError.textContent = msg.trim();
      return;
    }

    addUserModal.classList.add('hidden');
    document.body.classList.remove('modal-open');

    appToast('✅ Пользователь создан (попросит смену пароля)');
    await renderAdminUsers();
  } finally {
    uSave.disabled = false;
  }
};

// Confirm modal
const confirmModal = document.getElementById('confirmModal');
const cTitle = document.getElementById('cTitle');
const cText  = document.getElementById('cText');
const cYes   = document.getElementById('cYes');
const cNo    = document.getElementById('cNo');

let confirmAction = null;

function openConfirm({ title='Подтверждение', text='', onYes=null, yesText='Ок' }) {
  cTitle.textContent = title;
  cText.textContent  = text;
  cYes.textContent   = yesText;
  confirmAction = onYes;
  confirmModal.classList.remove('hidden');
}
function closeConfirm() {
  confirmModal.classList.add('hidden');
  confirmAction = null;
}
if (cNo) cNo.onclick = closeConfirm;
if (cYes) cYes.onclick = () => {
  const action = confirmAction;   // сохраняем
  closeConfirm();                 // ✅ закрываем СНАЧАЛА

  // ✅ потом выполняем (чтобы вложенный openConfirm не закрывался)
  if (typeof action === 'function') {
    setTimeout(() => action(), 0);
  }
};

// ================================
// Password change modal
// ================================
const pwdModal = document.getElementById('pwdModal');
const pOld = document.getElementById('pOld');
const pOldLabel = document.getElementById('pOldLabel');
const p1 = document.getElementById('p1');
const p2 = document.getElementById('p2');
const pError = document.getElementById('pError');
const pSave  = document.getElementById('pSave');

let pwdRequireOld = false;

function openPwdModal({ requireOld = false } = {}){
  pwdRequireOld = !!requireOld;

  if (pOld) pOld.value = '';
  p1.value = '';
  p2.value = '';
  pError.textContent = '';

  // показываем/скрываем поле старого пароля
  if (pOld && pOldLabel) {
    if (pwdRequireOld) {
      pOld.classList.remove('hidden');
      pOldLabel.classList.remove('hidden');
    } else {
      pOld.classList.add('hidden');
      pOldLabel.classList.add('hidden');
    }
  }

  pwdModal.classList.remove('hidden');
}
function closePwdModal(){
  pwdModal.classList.add('hidden');
}
if (pSave) {
  pSave.onclick = async () => {
    pError.textContent = '';
    const a = String(p1.value || '');
    const b = String(p2.value || '');

    if (!a || a.length < 4) { pError.textContent = 'Пароль минимум 4 символа'; return; }
    if (a !== b) { pError.textContent = 'Пароли не совпадают'; return; }

    pSave.disabled = true;
    try {
      const old = pwdRequireOld ? String(pOld?.value || '') : '';
const r = await store.changePassword(a, old);
      if (!r.ok) {
        const msg =
  r.error === 'weak-password' ? 'Слишком простой пароль' :
  r.error === 'inactive' ? 'Аккаунт деактивирован' :
  r.error === 'old-required' ? 'Введите старый пароль' :
  r.error === 'old-invalid' ? 'Старый пароль неверный' :
  `Ошибка: ${r.status || ''} ${r.error || ''}`;
pError.textContent = msg.trim();
return;
      }

      closePwdModal();
      appToast('✅ Пароль изменён');
      await afterLogin();
    } finally {
      pSave.disabled = false;
    }
  };
}

// ================================
// Admin: object selector + reports
// ================================
const adminObjectSelect = document.getElementById('adminObjectSelect');
const adminReportBtn = document.getElementById('adminReportBtn');

let adminSelectedObjectId = 'all';

async function initAdminObjectSelect(){
  const u = await store.currentUserObj();
  if (!u || u.role !== 'admin') return;

  const objs = await store.getObjects();

  adminObjectSelect.innerHTML =
    `<option value="all">Все объекты</option>` +
    objs.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');

  if (adminSelectedObjectId !== 'all' && !objs.some(o => o.id === adminSelectedObjectId)) {
    adminSelectedObjectId = 'all';
  }
  adminObjectSelect.value = adminSelectedObjectId;

  adminObjectSelect.onchange = async () => {
    adminSelectedObjectId = adminObjectSelect.value;

    currentObjectSpan.textContent =
      adminSelectedObjectId === 'all'
        ? 'Все склады'
        : (store.getObjectById(adminSelectedObjectId)?.name || 'Склад');

    await renderList(searchInput.value);
    await fillReportItemSelect();
  };
}

// report modal
const reportModal = document.getElementById('reportModal');
const rClose = document.getElementById('rClose');
const rObject = document.getElementById('rObject');
const rFrom = document.getElementById('rFrom');
const rTo = document.getElementById('rTo');
const rModeAll = document.getElementById('rModeAll');
const rModeOne = document.getElementById('rModeOne');
const rItemWrap = document.getElementById('rItemWrap');
const rItem = document.getElementById('rItem');
const rType = document.getElementById('rType');
const rBuild = document.getElementById('rBuild');
const rError = document.getElementById('rError');
const rTableWrap = document.getElementById('rTableWrap');

// ✅ один обработчик radio
document.querySelectorAll('input[name="rMode"]').forEach(el => {
  el.addEventListener('change', () => {
    if (rModeOne.checked) rItemWrap.classList.remove('hidden');
    else rItemWrap.classList.add('hidden');
  });
});

function ymdToday(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function dateStartTs(ymd){
  const [y,m,d] = ymd.split('-').map(Number);
  return new Date(y, (m-1), d, 0,0,0,0).getTime();
}
function dateEndTs(ymd){
  const [y,m,d] = ymd.split('-').map(Number);
  return new Date(y, (m-1), d, 23,59,59,999).getTime();
}

async function openReportModal(){
  const u = await store.currentUserObj();
  if (!u || u.role !== 'admin') return;

  const objs = await store.getObjects();
  rObject.innerHTML =
    `<option value="all">Все объекты</option>` +
    objs.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join('');

  rObject.value = adminSelectedObjectId || 'all';
  rFrom.value = ymdToday();
  rTo.value = ymdToday();

  rModeAll.checked = true;
  if (rType) rType.value = 'all';
  rItemWrap.classList.add('hidden');
  rError.textContent = '';
  rTableWrap.innerHTML = '';

  document.body.classList.add('modal-open');
  reportModal.classList.remove('hidden');

  await fillReportItemSelect();
}

function closeReportModal(){
  reportModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

async function fillReportItemSelect(){
  const objectId = rObject.value || 'all';
  const items = await store.getItems({ objectId });

  const map = new Map();
  for (const it of (items || [])) {
    if (!it?.code) continue;
    if (!map.has(it.code)) map.set(it.code, it.name || it.code);
  }

  const arr = Array.from(map.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a,b) => String(a.name).localeCompare(String(b.name), 'ru'));

  rItem.innerHTML =
    `<option value="">Выберите товар</option>` +
    arr.map(x => `<option value="${escapeHtml(x.code)}">${escapeHtml(x.name)}</option>`).join('');
}

if (rObject) rObject.onchange = async () => { await fillReportItemSelect(); };

if (rClose) rClose.onclick = closeReportModal;
if (reportModal) {
  reportModal.addEventListener('click', (e) => {
    if (e.target === reportModal) closeReportModal();
  });
}

if (rBuild) {
  rBuild.onclick = async () => {
    rError.textContent = '';
    rTableWrap.innerHTML = '';

    const objectId = rObject.value || 'all';
    const fromYmd = rFrom.value;
    const toYmd   = rTo.value;

    if (!fromYmd || !toYmd) { rError.textContent = 'Выберите период'; return; }

    const fromTs = dateStartTs(fromYmd);
    const toTs   = dateEndTs(toYmd);
    if (toTs < fromTs) { rError.textContent = 'Конечная дата меньше начальной'; return; }

    const itemCode = rModeOne.checked ? (rItem.value || '') : '';
    const type = rType ? (rType.value || 'all') : 'all';

    const res = await store.adminGetReport({ objectId, fromTs, toTs, itemCode, type });
    if (!res.ok) { rError.textContent = `Ошибка формирования отчёта: ${res.error || 'server'}`; return; }

    const rows = res.rows || [];

    const objLabel =
      objectId === 'all'
        ? 'Все объекты'
        : (store.getObjectById(objectId)?.name || 'Объект');

    const head = `
      <div class="report-head">
        <div><b>Отчёт:</b> ${escapeHtml(objLabel)}</div>
        <div class="muted">Период: ${escapeHtml(fromYmd)} — ${escapeHtml(toYmd)}</div>
        <div class="muted">Записей: ${rows.length}</div>
      </div>
    `;

    if (!rows.length) {
      rTableWrap.innerHTML = head + `<div class="muted" style="padding:10px 0">Нет операций за выбранный период</div>`;
      return;
    }

    const table = `
      ${head}
      <div class="table-wrap">
        <table class="report-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Объект</th>
              <th>Товар</th>
              <th>Тип</th>
              <th>Кол-во</th>
              <th>Откуда/Куда</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => {
              const typeLabel = r.type === 'in' ? 'Приход' : 'Расход';
              const sign = r.type === 'in' ? '+' : '-';
              return `
                <tr>
                  <td data-label="Дата">${escapeHtml(r.time)}</td>
                  <td data-label="Объект">${escapeHtml(r.objectName)}</td>
                  <td data-label="Товар">${escapeHtml(r.itemName)}</td>
                  <td data-label="Тип">${typeLabel}</td>
                  <td data-label="Кол-во"><b>${sign}${r.qty}</b></td>
                  <td data-label="Откуда/Куда">${escapeHtml(r.from)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    rTableWrap.innerHTML = table;
  };
}

if (adminReportBtn) adminReportBtn.onclick = openReportModal;

// ================================
// login/logout
// ================================
loginBtn.onclick = async () => {
  const res = await store.loginUser(loginInput.value.trim(), passInput.value.trim());
  if (!res.ok) {
    loginError.textContent = `❌ Ошибка входа: ${res.status || ''} ${res.error || ''}`.trim();
    setTimeout(() => (loginError.textContent=''), 4000);
    return;
  }

  loginBox.classList.add('hidden');
  appBox.classList.remove('hidden');

  const u = await store.currentUserObj();
  if (u?.mustChangePassword) {
    openPwdModal({ requireOld: false });
    return;
  }

  await afterLogin();
};

logoutBtn.onclick = async () => {
  try { await window.scannerApi?.stopScanner(); } catch {}
  await store.logout();

  appBox.classList.add('hidden');
  loginBox.classList.remove('hidden');
  loginInput.value = '';
  passInput.value = '';
  loginError.textContent = '';
  listEl.innerHTML = '';
  appToast('Вы вышли');
};

async function afterLogin(){
  await store.getObjects();
  const u = await store.currentUserObj();
  if (!u) return;

  if (u.role === 'admin') {
    currentObjectSpan.textContent = 'Все склады';
  } else {
    currentObjectSpan.textContent = store.getObjectById(u.objectId)?.name || 'Склад';
  }

  userChip.textContent = `👤 ${u.login}`;

  if (u.role === 'admin') {
    userControls.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    // ✅ кнопка смены пароля админа (показываем один раз)
let btn = document.getElementById('adminChangePwdBtn');
if (!btn) {
  btn = document.createElement('button');
  btn.id = 'adminChangePwdBtn';
  btn.className = 'btn btn-secondary';
  btn.textContent = '🔑 Сменить пароль';
  btn.style.marginTop = '12px';

  btn.onclick = () => {
    // админ меняет пароль добровольно -> нужен старый пароль
    openPwdModal({ requireOld: true });
  };

  adminPanel.appendChild(btn);
}
    if (transferBtn) transferBtn.classList.add('hidden');

    await initAdminObjectSelect();
    await renderAdminUsers();
  } else {
    userControls.classList.remove('hidden');
    adminPanel.classList.add('hidden');
    if (transferBtn) transferBtn.classList.remove('hidden');
  }

  await updateTransferBadge();
await pollTransferUpdates();

  if (window.__transferBadgeTimer) clearInterval(window.__transferBadgeTimer);
window.__transferBadgeTimer = setInterval(() => {
  updateTransferBadge().catch(() => {});
  
  pollTransferUpdates().catch(() => {});
}, 8000); // можно 8-10 сек

  await renderList(searchInput.value);
  await initPushIfPossible();
  // показать очередь (если есть)
try {
  const n = await store.queueCount?.();
  if (n > 0) appToast(`⏳ Офлайн-очередь: ${n} действий (отправится при появлении сети)`, { sticky: true });
} catch {}
  renderAdmin();
  setNetStatus();
await refreshQueueChip();

// периодически обновляем очередь (дешево)
if (window.__queueChipTimer) clearInterval(window.__queueChipTimer);
window.__queueChipTimer = setInterval(() => refreshQueueChip().catch(()=>{}), 6000);
}

function renderAdmin(){
  if (!objectsList || !usersList) return;

  objectsList.innerHTML = '';

  const list = [];
  if (adminObjectSelect && adminObjectSelect.options.length) {
    for (const opt of adminObjectSelect.options) {
      if (!opt.value || opt.value === 'all') continue;
      list.push({ id: opt.value, name: opt.textContent });
    }
  }

  if (!list.length) {
    objectsList.innerHTML = `<li><span class="muted">Складов нет</span></li>`;
    return;
  }

  list.forEach(o => {
    const li = document.createElement('li');
    li.dataset.objectId = o.id;

    li.innerHTML = `
      <span>📦 ${escapeHtml(o.name)}</span>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-danger" style="padding:8px 10px" data-del-obj="${o.id}">🗑</button>
      </div>
    `;
    objectsList.appendChild(li);
  });

  // objectsList.querySelectorAll('[data-del-obj]').forEach(btn => {
  //   btn.onclick = async () => {
  //     const id = btn.getAttribute('data-del-obj');
  //     const name = store.getObjectById(id)?.name || 'Склад';

  //     openConfirm({
  //       title: 'Удалить склад?',
  //       text: `Склад "${name}" будет деактивирован (и все пользователи этого склада тоже). Продолжить?`,
  //       yesText: 'Да',
  //       onYes: () => {
  //         openConfirm({
  //           title: 'Точно удалить?',
  //           text: `Подтвердите удаление склада "${name}".`,
  //           yesText: 'Удалить',
  //           onYes: async () => {
  //             // ✅ моментально убираем из списка (UX)
  //             removeListRowByDataset(objectsList, 'objectId', id);

  //             const r = await store.adminDeleteObject(id);
  //             if (!r.ok) {
  //               appToast(`Ошибка: ${r.status || ''} ${r.error || ''}`.trim());

  //               // ✅ откат/синхронизация
  //               await store.getObjects();
  //               await initAdminObjectSelect();
  //               renderAdmin();
  //               await renderAdminUsers();
  //               return;
  //             }

  //             appToast('✅ Склад удалён');

  //             await store.getObjects();
  //             await initAdminObjectSelect();
  //             renderAdmin();
  //             await renderAdminUsers();
  //           }
  //         });
  //       }
  //     });
  //   };
  // });
}

// ================================
// List render
// ================================
async function renderList(filter=''){
  const u = await store.currentUserObj();
  if (!u) return;

  listEl.innerHTML = `<li><span class="muted">Загрузка…</span></li>`;

  const objectIdForAdmin = (u.role === 'admin') ? adminSelectedObjectId : 'all';
  const itemsFromApi = await store.getItems({ objectId: objectIdForAdmin });
  let items = Array.isArray(itemsFromApi) ? itemsFromApi : [];

  listEl.innerHTML = '';

  items = items
    .filter(i => (i.name || '').toLowerCase().includes((filter||'').toLowerCase()))
    .sort((a,b) => String(a.name||'').localeCompare(String(b.name||''),'ru'));

  if (!items.length) {
    listEl.innerHTML = `<li><span class="muted">Ничего не найдено</span></li>`;
    return;
  }

  items.forEach(item => {
    const li = document.createElement('li');

    const objName = store.getObjectById(item.objectId)?.name || '';
    const objLine = (u.role === 'admin')
      ? `<div class="muted" style="font-size:13px">📍 ${escapeHtml(objName)}</div>`
      : '';

    const actions = (u.role === 'user')
      ? `
        <div class="item-actions">
          <button title="История" data-h="${item.id}">📜</button>
          <button title="Быстрый приход" data-plus="${item.id}">➕</button>
          <button title="Списание" data-w="${item.id}">➖</button>
          <button title="Передача" data-t="${item.id}">📤</button>
          <button title="Удалить" data-d="${item.id}">🗑</button>
        </div>
      `
      : `
        <div class="item-actions">
          <button title="История" data-h="${item.id}">📜</button>
        </div>
      `;

    li.innerHTML = `
      <div class="item-main">
        <strong>${escapeHtml(item.name)}</strong>
        ${objLine}
        <div class="muted">Всего: <b>${item.quantity}</b></div>
      </div>
      ${actions}
    `;

    listEl.appendChild(li);
  });

  listEl.querySelectorAll('[data-h]').forEach(btn =>
    btn.onclick = async () => await openHistory(btn.getAttribute('data-h'))
  );
  listEl.querySelectorAll('[data-w]').forEach(btn =>
    btn.onclick = () => openWriteoff(btn.getAttribute('data-w'))
  );
  listEl.querySelectorAll('[data-t]').forEach(btn =>
    btn.onclick = async () => await openTransferModal(btn.getAttribute('data-t'))
  );

  listEl.querySelectorAll('[data-d]').forEach(btn => btn.onclick = () => {
  const id = btn.getAttribute('data-d');
  const item = store.getItem(id);
  if (!item) return;

  openConfirm({
    title: 'Удалить позицию?',
    text: `Удалить "${item.name}" со склада? (История операций сохранится)`,
    yesText: 'Удалить',
    onYes: async () => {
      const r = await store.deleteItem(id);
      if (!r.ok) {
        appToast(`Ошибка: ${r.status || ''} ${r.error || ''}`.trim());
        return;
      }
      appToast('✅ Удалено');
      await renderList(searchInput.value);
    }
  });
});

  listEl.querySelectorAll('[data-plus]').forEach(btn => btn.onclick = () => {
    const id = btn.getAttribute('data-plus');
    window.intakeApi?.openForExistingItem(id);
  });
}

window.renderList = renderList;

searchInput.addEventListener('input', async (e) => {
  await renderList(e.target.value);
});

// ================================
// Auto-login if session exists
// ================================
(async function boot(){
  try {
    setNetStatus();
window.addEventListener('online', () => { setNetStatus(); refreshQueueChip(); });
window.addEventListener('offline', () => setNetStatus());
    splashSetText("Проверяем сессию…");
    splashSetProgress(20);

    const u = await store.currentUserObj();

    if (!u) {
      splashSetProgress(100);
      splashHide();
      return;
    }

    splashSetText("Загружаем данные…");
    splashSetProgress(50);

    loginBox.classList.add('hidden');
    appBox.classList.remove('hidden');

    if (u.mustChangePassword) {
      openPwdModal({ requireOld: false });
      splashSetProgress(100);
      splashHide();
      return;
    }

    await afterLogin();

    splashSetProgress(100);
    setTimeout(() => splashHide(), 300);

  } catch (e) {
    console.log('boot error', e);
    splashHide();
  }
})();