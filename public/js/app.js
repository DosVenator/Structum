// app.js — UI/логика экранов (API-store async)

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

// toast
const toastEl = document.getElementById('toast');
function appToast(msg){
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2200);
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
// ================================
// Modals: history
// ================================
const historyModal = document.getElementById('historyModal');
const hTitle = document.getElementById('hTitle');
const hBody  = document.getElementById('hBody');
const hClose = document.getElementById('hClose');

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

  // UI фильтр в модалке
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
                <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
                  <div><b>${sign}${o.qty}</b> <span class="muted">| ${escapeHtml(o.from)}</span></div>
                  <div class="muted">${typeLabel}</div>
                </div>
                <div class="muted" style="font-size:13px">${escapeHtml(o.time)}</div>
              </div>
            `;
          }).join('')
        : `<div class="muted">Нет операций за выбранный период</div>`;
    } catch (e) {
      console.error(e);
      hList.innerHTML = `<div class="muted">Ошибка загрузки истории</div>`;
    }
  }

  // кнопка применить
  const hApply = document.getElementById('hApply');
  if (hApply) hApply.onclick = load;

  // автозагрузка дефолта
  await load();
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
// Transfers UI (ВКЛЮЧЕНО)
// ================================
const transferModal = document.getElementById('transferModal');
const incomingModal = document.getElementById('incomingModal');
const incomingClose = document.getElementById('incomingClose');
const cancelTransfer  = document.getElementById('cancelTransfer');

const transferTo = document.getElementById('transferTo');
const transferQty = document.getElementById('transferQty');
const transferError = document.getElementById('transferError');
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
    // показываем общий pending, чтобы отправитель тоже видел
    transferBadge.textContent = String(nTotal);
    transferBadge.classList.remove('hidden');

    // подсказка на hover (полезно)
    transferBadge.title = `Входящие: ${nIn}, Исходящие: ${nOut}`;
  } else {
    transferBadge.classList.add('hidden');
  }
}

async function openTransferModal(itemId){
  const u = await store.currentUserObj();
  if (!u || u.role !== 'user') return;

  if (!store.createTransfer) {
    appToast('Передачи ещё не подключены в store.js');
    return;
  }

  transferItemId = itemId;
  const item = store.getItem(itemId);
  if (!item) return;

  transferError.textContent = '';
  transferQty.value = '';
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
      const r = await store.createTransfer({ itemId: item.id, toObjectId, qty });
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

  // --- INCOMING ---
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

          <div style="display:flex;gap:10px;margin-top:6px;flex-wrap:wrap">
            <button class="btn btn-primary" data-accept="${t.id}">✅ Принять</button>
            <button class="btn btn-danger" data-reject="${t.id}">✖ Отклонить</button>
          </div>
        </div>
      `;
      incomingList.appendChild(li);
    });
  }

  // divider
  const hr = document.createElement('li');
  hr.innerHTML = `<div style="height:1px;background:rgba(255,255,255,.08);margin:6px 0"></div>`;
  incomingList.appendChild(hr);

  // --- OUTGOING ---
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
          <div class="muted">Статус: <b>ожидает</b></div>
        </div>
      `;
      incomingList.appendChild(li);
    });
  }

  // bind actions incoming accept/reject
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
// Admin panel (CRUD пока выключен)
// ================================
const objectsList = document.getElementById('objectsList');
const usersList   = document.getElementById('usersList');

const addObjectModal = document.getElementById('addObjectModal');
const openAddObject  = document.getElementById('openAddObject');
const objName  = document.getElementById('objName');
const objError = document.getElementById('objError');
const objSave  = document.getElementById('objSave');
const objCancel= document.getElementById('objCancel');

if (openAddObject) openAddObject.onclick = () => soon('Создание объекта — скоро');
if (objCancel) objCancel.onclick = () => addObjectModal?.classList.add('hidden');
if (objSave) objSave.onclick = () => soon('Создание объекта — скоро');

// Confirm modal (для удаления) — пока deleteItem заглушка
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
  if (typeof confirmAction === 'function') confirmAction();
  closeConfirm();
};

// add user (пока выключено)
const addUserModal = document.getElementById('addUserModal');
const openAddUser  = document.getElementById('openAddUser');
const uLogin = document.getElementById('uLogin');
const uObject= document.getElementById('uObject');
const uPass  = document.getElementById('uPass');
const uError = document.getElementById('uError');
const uSave  = document.getElementById('uSave');
const uCancel= document.getElementById('uCancel');

if (openAddUser) openAddUser.onclick = () => soon('Создание пользователя — скоро');
if (uCancel) uCancel.onclick = () => addUserModal?.classList.add('hidden');
if (uSave) uSave.onclick = () => soon('Создание пользователя — скоро');

// ================================
// Password change modal (пока выключено)
// ================================
const pwdModal = document.getElementById('pwdModal');
const p1 = document.getElementById('p1');
const p2 = document.getElementById('p2');
const pError = document.getElementById('pError');
const pSave  = document.getElementById('pSave');

function openPwdModal(){
  p1.value = '';
  p2.value = '';
  pError.textContent = '';
  pwdModal.classList.remove('hidden');
}
function closePwdModal(){
  pwdModal.classList.add('hidden');
}
if (pSave) {
  pSave.onclick = () => {
    soon('Смена пароля — скоро');
    closePwdModal();
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

// ✅ ВАЖНО: оставляем ОДИН обработчик (без дублей onchange ниже)
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

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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

// ❌ УБРАНО: старые rModeAll.onchange / rModeOne.onchange, потому что они дублируют обработчик выше
// if (rModeAll) rModeAll.onchange = ...
// if (rModeOne) rModeOne.onchange = ...

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
                  <td>${escapeHtml(r.time)}</td>
                  <td>${escapeHtml(r.objectName)}</td>
                  <td>${escapeHtml(r.itemName)}</td>
                  <td>${typeLabel}</td>
                  <td><b>${sign}${r.qty}</b></td>
                  <td>${escapeHtml(r.from)}</td>
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
    openPwdModal();
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
    if (transferBtn) transferBtn.classList.add('hidden');

    await initAdminObjectSelect();
  } else {
    userControls.classList.remove('hidden');
    adminPanel.classList.add('hidden');
    if (transferBtn) transferBtn.classList.remove('hidden');
  }

  await updateTransferBadge();
  // авто-обновление бейджа каждые 20 сек (pending вход/выход)
if (window.__transferBadgeTimer) clearInterval(window.__transferBadgeTimer);
window.__transferBadgeTimer = setInterval(() => {
  updateTransferBadge().catch(() => {});
}, 20000);
  await renderList(searchInput.value);
  renderAdmin();
}

function renderAdmin(){
  objectsList.innerHTML = '';
  if (!objectsList || !usersList) return;

  const list = [];
  if (adminObjectSelect && adminObjectSelect.options.length) {
    for (const opt of adminObjectSelect.options) {
      if (!opt.value || opt.value === 'all') continue;
      list.push({ id: opt.value, name: opt.textContent });
    }
  }

  list.forEach(o => {
    const li = document.createElement('li');
    li.innerHTML = `<span>📦 ${escapeHtml(o.name)}</span><span class="muted">id: ${String(o.id).slice(0,6)}…</span>`;
    objectsList.appendChild(li);
  });

  usersList.innerHTML = `<li><span class="muted">Пользователи (API) — скоро</span></li>`;
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

  // bind actions
  listEl.querySelectorAll('[data-h]').forEach(btn =>
    btn.onclick = async () => await openHistory(btn.getAttribute('data-h'))
  );
  listEl.querySelectorAll('[data-w]').forEach(btn =>
    btn.onclick = () => openWriteoff(btn.getAttribute('data-w'))
  );
  listEl.querySelectorAll('[data-t]').forEach(btn =>
    btn.onclick = async () => await openTransferModal(btn.getAttribute('data-t'))
  );

  // delete пока нет API
  listEl.querySelectorAll('[data-d]').forEach(btn => btn.onclick = () => {
    const id = btn.getAttribute('data-d');
    const item = store.getItem(id);
    if (!item) return;

    openConfirm({
      title: 'Удалить позицию?',
      text: `Удаление через API будет позже. Сейчас нельзя удалить: "${item.name}"`,
      yesText: 'Ок',
      onYes: () => {}
    });
  });

  listEl.querySelectorAll('[data-plus]').forEach(btn => btn.onclick = () => {
    const id = btn.getAttribute('data-plus');
    window.intakeApi?.openForExistingItem(id);
  });
}

window.renderList = renderList;

// search
searchInput.addEventListener('input', async (e) => {
  await renderList(e.target.value);
});

// ================================
// Auto-login if session exists
// ================================
(async function boot(){
  try {
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
      openPwdModal();
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