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

// ================================
// Modals: history
// ================================
const historyModal = document.getElementById('historyModal');
const hTitle = document.getElementById('hTitle');
const hBody  = document.getElementById('hBody');
const hClose = document.getElementById('hClose');

hClose.onclick = () => historyModal.classList.add('hidden');

async function openHistory(itemId){
  const item = store.getItem(itemId);
  if (!item) return;

  hTitle.textContent = `📜 История — ${item.name}`;
  hBody.innerHTML = `<div class="muted">Загрузка…</div>`;
  historyModal.classList.remove('hidden');

  try {
    const ops = await store.getHistory(itemId); // <-- API

    hBody.innerHTML = ops.length
      ? ops.map(o => {
          const sign = o.type === 'in' ? '+' : '-';
          return `<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08)">
                    <div><b>${sign}${o.qty}</b> <span class="muted">| ${o.from}</span></div>
                    <div class="muted" style="font-size:13px">${o.time}</div>
                  </div>`;
        }).join('')
      : `<div class="muted">Пока нет операций</div>`;
  } catch (e) {
    console.error(e);
    hBody.innerHTML = `<div class="muted">Ошибка загрузки истории</div>`;
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

    if (!res.ok) { wError.textContent = 'Ошибка списания'; return; }

    writeoffModal.classList.add('hidden');
    await renderList(searchInput.value);
    appToast('✅ Списано');
  } finally {
    wSave.disabled = false;
  }
};

// ================================
// Transfers UI (пока выключено)
// ================================
const transferModal = document.getElementById('transferModal');
const incomingModal = document.getElementById('incomingModal');
const incomingClose = document.getElementById('incomingClose');
const cancelTransfer  = document.getElementById('cancelTransfer');

if (cancelTransfer) cancelTransfer.onclick = () => transferModal?.classList.add('hidden');
if (incomingClose) incomingClose.onclick = () => incomingModal?.classList.add('hidden');

function updateTransferBadge(){
  // transfers пока не реализованы в API-store
  if (transferBadge) transferBadge.classList.add('hidden');
}

async function openTransferModal(){
  soon('📤 Передачи — скоро');
}

async function openIncomingTransfers(){
  soon('📥 Входящие передачи — скоро');
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

  // objects должны быть загружены
  const objs = await store.getObjects();

  adminObjectSelect.innerHTML =
    `<option value="all">Все объекты</option>` +
    objs.map(o => `<option value="${o.id}">${o.name}</option>`).join('');

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
const rBuild = document.getElementById('rBuild');
const rError = document.getElementById('rError');
const rTableWrap = document.getElementById('rTableWrap');

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
    objs.map(o => `<option value="${o.id}">${o.name}</option>`).join('');

  rObject.value = adminSelectedObjectId || 'all';
  rFrom.value = ymdToday();
  rTo.value = ymdToday();

  rModeAll.checked = true;
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

  // гарантируем свежие items
  await store.getItems({ objectId });

  let items = store.getItems({ objectId }); // <- у API-store getItems async, но кеш уже обновлён выше
  // ВАЖНО: здесь items не используются как промис — поэтому ниже берём из кеша:
  items = (Array.isArray(items) ? items : (store._items || [])); // страховка, если кто-то поменяет store

  // если store.getItems() возвращает промис в твоей реализации — просто используй кеш:
  if (!Array.isArray(items)) items = [];

  // уникально по code
  const map = new Map();
  for (const it of items) {
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
if (rModeAll) rModeAll.onchange = () => { if (rModeAll.checked) rItemWrap.classList.add('hidden'); };
if (rModeOne) rModeOne.onchange = () => { if (rModeOne.checked) rItemWrap.classList.remove('hidden'); };

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
    const res = await store.adminGetReport({ objectId, fromTs, toTs, itemCode });
    if (!res.ok) { rError.textContent = 'Ошибка формирования отчёта'; return; }

    const rows = res.rows || [];

    const objLabel =
      objectId === 'all'
        ? 'Все объекты'
        : (store.getObjectById(objectId)?.name || 'Объект');

    const head = `
      <div class="report-head">
        <div><b>Отчёт:</b> ${objLabel}</div>
        <div class="muted">Период: ${fromYmd} — ${toYmd}</div>
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
    // ✅ теперь видно реальную причину: 401 invalid или 500 server/session/db
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

  updateTransferBadge();
  await renderList(searchInput.value);
  renderAdmin();
}

function renderAdmin(){
  // В API-версии users пока не подтягиваем — просто покажем объекты
  const objs = (store.getObjects && store.getObjects.length === 0) ? [] : (store.getObjects ? null : null);

  // безопасно: берем из кеша store.getObjectById по списку объектов — но список объектов мы уже загрузили
  const list = [];
  // попробуем получить objects косвенно:
  // если store.getObjects() асинхронный - тут не вызываем. Мы уже вызывали getObjects() в afterLogin.
  // Поэтому просто выводим по селектору объекта:
  objectsList.innerHTML = '';
  // адекватно: возьмём ids из селекта админа если он есть
  // но проще — не рисовать users/objects, чтобы не ломать
  if (!objectsList || !usersList) return;

  // попробуем заполнить по dom-селекту adminObjectSelect:
  if (adminObjectSelect && adminObjectSelect.options.length) {
    for (const opt of adminObjectSelect.options) {
      if (!opt.value || opt.value === 'all') continue;
      list.push({ id: opt.value, name: opt.textContent });
    }
  }

  list.forEach(o => {
    const li = document.createElement('li');
    li.innerHTML = `<span>📦 ${o.name}</span><span class="muted">id: ${String(o.id).slice(0,6)}…</span>`;
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

  // обновим items из API
  const objectIdForAdmin = (u.role === 'admin') ? adminSelectedObjectId : 'all';
  await store.getItems({ objectId: objectIdForAdmin });

  // теперь берем из кеша через store.getItems() в твоей старой логике нельзя,
  // поэтому берем items из store.getItems({}) не вызывая (она async).
  // используем store.getItem + перебор кеша невозможно, поэтому делаем так:
  // в API-store я держал _items внутри, но наружу не отдавал.
  // Чтобы не ломать — просто второй раз вызовем getItems и дождёмся массива:
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
      ? `<div class="muted" style="font-size:13px">📍 ${objName}</div>`
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
        <strong>${item.name}</strong>
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
    const u = await store.currentUserObj();
    if (!u) return;

    loginBox.classList.add('hidden');
    appBox.classList.remove('hidden');

    if (u.mustChangePassword) {
      openPwdModal();
      return;
    }

    await afterLogin();
  } catch (e) {
    // если /api/me вернул 401 или сеть — остаёмся на логине
    console.log('boot: no session');
  }
})();