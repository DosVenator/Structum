// app.js — UI/логика экранов

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

// ================================
// Modals: history
// ================================
const historyModal = document.getElementById('historyModal');
const hTitle = document.getElementById('hTitle');
const hBody  = document.getElementById('hBody');
const hClose = document.getElementById('hClose');

hClose.onclick = () => historyModal.classList.add('hidden');

function openHistory(itemId){
  const item = store.getItem(itemId);
  if (!item) return;

  hTitle.textContent = `📜 История — ${item.name}`;
  const ops = (item.history || []).slice().reverse();

  hBody.innerHTML = ops.length
    ? ops.map(o => {
        const sign = o.type === 'in' ? '+' : '-';
        return `<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08)">
                  <div><b>${sign}${o.qty}</b> <span class="muted">| ${o.from}</span></div>
                  <div class="muted" style="font-size:13px">${o.time}</div>
                </div>`;
      }).join('')
    : `<div class="muted">Пока нет операций</div>`;

  historyModal.classList.remove('hidden');
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

wSave.onclick = () => {
  const item = store.getItem(writeoffItemId);
  if (!item) return;

  const n = Number(wQty.value);
  if (!Number.isFinite(n) || n <= 0) { wError.textContent = 'Количество должно быть числом > 0'; return; }
  if (n > item.quantity) { wError.textContent = 'Недостаточно остатка'; return; }

  const to = (wTo.value || 'Списание').trim();

  const res = store.addOperation({
    code: item.code,
    name: item.name,
    qty: n,
    from: to,
    type: 'out'
  });

  if (!res.ok) { wError.textContent = 'Ошибка списания'; return; }

  writeoffModal.classList.add('hidden');
  renderList(searchInput.value);
  appToast('✅ Списано');
};

// ================================
// Transfers UI
// ================================
const transferModal = document.getElementById('transferModal');
const transferTo = document.getElementById('transferTo');
const transferQty= document.getElementById('transferQty');
const transferItemName = document.getElementById('transferItemName');
const transferError = document.getElementById('transferError');
const confirmTransfer = document.getElementById('confirmTransfer');
const cancelTransfer  = document.getElementById('cancelTransfer');

const incomingModal = document.getElementById('incomingModal');
const incomingList  = document.getElementById('incomingList');
const incomingClose = document.getElementById('incomingClose');

let transferItemId = null;

cancelTransfer.onclick = () => transferModal.classList.add('hidden');
incomingClose.onclick = () => incomingModal.classList.add('hidden');

function updateTransferBadge(){
  const u = store.currentUserObj();
  if (!u || u.role !== 'user') { transferBadge.classList.add('hidden'); return; }
  const incoming = store.getIncomingTransfers();
  if (incoming.length) {
    transferBadge.textContent = incoming.length;
    transferBadge.classList.remove('hidden');
  } else {
    transferBadge.classList.add('hidden');
  }
}

function openTransferModal(itemId){
  const u = store.currentUserObj();
  if (!u || u.role !== 'user') return;

  const item = store.getItem(itemId);
  if (!item) return;

  transferItemId = itemId;
  transferItemName.textContent = item.name;
  transferQty.value = '';
  transferError.textContent = '';

  const objects = store.getObjects().filter(o => o.id !== u.objectId);
  transferTo.innerHTML = `<option value="">Выберите склад</option>` + objects.map(o =>
    `<option value="${o.id}">${o.name}</option>`
  ).join('');

  transferModal.classList.remove('hidden');
}

confirmTransfer.onclick = () => {
  const toObjectId = transferTo.value;
  const qty = Number(transferQty.value);

  if (!toObjectId) { transferError.textContent = 'Выберите склад'; return; }
  if (!Number.isFinite(qty) || qty <= 0) { transferError.textContent = 'Количество должно быть числом > 0'; return; }

  const res = store.createTransfer({ itemId: transferItemId, qty, toObjectId });
  if (!res.ok) {
    transferError.textContent =
      res.error === 'not-enough' ? 'Недостаточно остатка' : 'Ошибка передачи';
    return;
  }

  transferModal.classList.add('hidden');
  updateTransferBadge();
  renderList(searchInput.value);
  appToast('📤 Передача создана (ожидает подтверждения)');
};

function openIncomingTransfers(){
  incomingList.innerHTML = '';
  const incoming = store.getIncomingTransfers();

  if (!incoming.length) {
    incomingList.innerHTML = `<li><span class="muted">Нет входящих передач</span></li>`;
  } else {
    incoming.forEach(t => {
      const fromName = store.getObjectById(t.fromObjectId)?.name || 'Склад';
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <b>${t.name}</b>
          <div class="muted" style="font-size:13px">От: ${fromName} • Кол-во: ${t.qty}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary" data-acc="${t.id}">✅</button>
          <button class="btn btn-secondary" data-rej="${t.id}">❌</button>
        </div>
      `;
      incomingList.appendChild(li);
    });
  }

  incomingModal.classList.remove('hidden');

  incomingList.querySelectorAll('[data-acc]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-acc');
      const res = store.acceptTransfer(id);
      if (!res.ok) appToast('Ошибка принятия');
      updateTransferBadge();
      openIncomingTransfers();
      renderList(searchInput.value);
    };
  });
  incomingList.querySelectorAll('[data-rej]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-rej');
      const res = store.rejectTransfer(id);
      if (!res.ok) appToast('Ошибка отклонения');
      updateTransferBadge();
      openIncomingTransfers();
    };
  });
}

transferBtn.onclick = () => {
  const u = store.currentUserObj();
  if (!u || u.role !== 'user') return;
  openIncomingTransfers();
};

// ================================
// Admin panel
// ================================
const objectsList = document.getElementById('objectsList');
const usersList   = document.getElementById('usersList');

const addObjectModal = document.getElementById('addObjectModal');
const openAddObject  = document.getElementById('openAddObject');
const objName  = document.getElementById('objName');
const objError = document.getElementById('objError');
const objSave  = document.getElementById('objSave');
const objCancel= document.getElementById('objCancel');

openAddObject.onclick = () => {
  objName.value = '';
  objError.textContent = '';
  addObjectModal.classList.remove('hidden');
};
objCancel.onclick = () => addObjectModal.classList.add('hidden');
objSave.onclick = () => {
  const res = store.adminCreateObject(objName.value);
  if (!res.ok) {
    objError.textContent =
      res.error === 'exists' ? 'Объект с таким названием уже есть' : 'Ошибка';
    return;
  }
  addObjectModal.classList.add('hidden');
  renderAdmin();
  // обновим селект объекта для админа
  initAdminObjectSelect();
  appToast('✅ Объект создан');
};

// Confirm modal (для удаления)
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
cNo.onclick = closeConfirm;
cYes.onclick = () => {
  if (typeof confirmAction === 'function') confirmAction();
  closeConfirm();
};

// add user
const addUserModal = document.getElementById('addUserModal');
const openAddUser  = document.getElementById('openAddUser');
const uLogin = document.getElementById('uLogin');
const uObject= document.getElementById('uObject');
const uPass  = document.getElementById('uPass');
const uError = document.getElementById('uError');
const uSave  = document.getElementById('uSave');
const uCancel= document.getElementById('uCancel');

function genTempPassword(){
  return Math.random().toString(36).slice(2, 8) + Math.floor(Math.random()*90+10);
}

openAddUser.onclick = () => {
  uLogin.value = '';
  uError.textContent = '';
  uPass.value = genTempPassword();

  const objs = store.getObjects();
  uObject.innerHTML = objs.map(o => `<option value="${o.id}">${o.name}</option>`).join('');
  addUserModal.classList.remove('hidden');
};
uCancel.onclick = () => addUserModal.classList.add('hidden');
uSave.onclick = () => {
  const res = store.adminCreateUser({
    login: uLogin.value,
    tempPassword: uPass.value,
    objectId: uObject.value
  });

  if (!res.ok) {
    const map = {
      'login':'Введите логин',
      'login-exists':'Логин уже существует',
      'object':'Выберите объект',
      'password':'Введите пароль'
    };
    uError.textContent = map[res.error] || 'Ошибка создания';
    return;
  }

  addUserModal.classList.add('hidden');
  renderAdmin();
  appToast(`✅ Пользователь создан: ${res.user.login} / ${res.user.password}`);
};

// ================================
// Password change modal
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
pSave.onclick = () => {
  const a = String(p1.value||'').trim();
  const b = String(p2.value||'').trim();
  if (a.length < 4) { pError.textContent = 'Минимум 4 символа'; return; }
  if (a !== b) { pError.textContent = 'Пароли не совпадают'; return; }

  const ok = store.changePassword(a);
  if (!ok) { pError.textContent = 'Ошибка смены пароля'; return; }

  closePwdModal();
  appToast('✅ Пароль изменён');
  afterLogin();
};

// ================================
// Admin: object selector + reports
// ================================
const adminObjectSelect = document.getElementById('adminObjectSelect');
const adminReportBtn = document.getElementById('adminReportBtn');

let adminSelectedObjectId = 'all';

function initAdminObjectSelect(){
  const u = store.currentUserObj();
  if (!u || u.role !== 'admin') return;

  const objs = store.getObjects();
  adminObjectSelect.innerHTML =
    `<option value="all">Все объекты</option>` +
    objs.map(o => `<option value="${o.id}">${o.name}</option>`).join('');

  // если раньше был выбран объект — сохраняем если существует
  if (adminSelectedObjectId !== 'all' && !objs.some(o => o.id === adminSelectedObjectId)) {
    adminSelectedObjectId = 'all';
  }
  adminObjectSelect.value = adminSelectedObjectId;

  adminObjectSelect.onchange = () => {
    adminSelectedObjectId = adminObjectSelect.value;
    // обновляем заголовок текущего объекта
    currentObjectSpan.textContent =
      adminSelectedObjectId === 'all'
        ? 'Все склады'
        : (store.getObjectById(adminSelectedObjectId)?.name || 'Склад');

    renderList(searchInput.value);
    // обновим список товаров в отчёте
    fillReportItemSelect();
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
  // yyyy-mm-dd -> local start of day
  const [y,m,d] = ymd.split('-').map(Number);
  return new Date(y, (m-1), d, 0,0,0,0).getTime();
}
function dateEndTs(ymd){
  const [y,m,d] = ymd.split('-').map(Number);
  return new Date(y, (m-1), d, 23,59,59,999).getTime();
}

function openReportModal(){
  const u = store.currentUserObj();
  if (!u || u.role !== 'admin') return;

  const objs = store.getObjects();
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

  document.body.classList.add('modal-open'); // ✅ блокируем фон
  reportModal.classList.remove('hidden');
  fillReportItemSelect();

  reportModal.classList.remove('hidden');
}

function closeReportModal(){
  reportModal.classList.add('hidden');
  document.body.classList.remove('modal-open'); // ✅ возвращаем скролл
  reportModal.classList.add('hidden');
}
function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function fillReportItemSelect(){
  // наполняем список товаров согласно выбранному объекту (в модалке)
  const objectId = rObject.value || 'all';

  let items = store.getItems(); // у админа это все items
  if (objectId !== 'all') {
    items = items.filter(i => i.objectId === objectId);
  }

  // ✅ УНИКАЛЬНО по штрихкоду (code), чтобы "Перчатки" не дублировались по складам
  const map = new Map(); // code -> name
  for (const it of items) {
    if (!it?.code) continue;
    if (!map.has(it.code)) {
      map.set(it.code, it.name || it.code);
    }
  }

  const arr = Array.from(map.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a,b) => String(a.name).localeCompare(String(b.name), 'ru'));

  // value = code (штрихкод) !!
  rItem.innerHTML =
    `<option value="">Выберите товар</option>` +
    arr.map(x => `<option value="${escapeHtml(x.code)}">${escapeHtml(x.name)}</option>`).join('');
}

rObject.onchange = () => {
  fillReportItemSelect();
};

rModeAll.onchange = () => {
  if (rModeAll.checked) rItemWrap.classList.add('hidden');
};
rModeOne.onchange = () => {
  if (rModeOne.checked) rItemWrap.classList.remove('hidden');
};

rClose.onclick = closeReportModal;
reportModal.addEventListener('click', (e) => {
  if (e.target === reportModal) closeReportModal();
});

rBuild.onclick = () => {
  rError.textContent = '';
  rTableWrap.innerHTML = '';

  const objectId = rObject.value || 'all';
  const fromYmd = rFrom.value;
  const toYmd   = rTo.value;

  if (!fromYmd || !toYmd) {
    rError.textContent = 'Выберите период';
    return;
  }

  const fromTs = dateStartTs(fromYmd);
  const toTs   = dateEndTs(toYmd);

  if (toTs < fromTs) {
    rError.textContent = 'Конечная дата меньше начальной';
    return;
  }

  const itemCode = rModeOne.checked ? (rItem.value || '') : '';
  const res = store.adminGetReport({ objectId, fromTs, toTs, itemCode });
  if (!res.ok) {
    rError.textContent = 'Ошибка формирования отчёта';
    return;
  }

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
                <td>${r.time}</td>
                <td>${r.objectName}</td>
                <td>${r.itemName}</td>
                <td>${typeLabel}</td>
                <td><b>${sign}${r.qty}</b></td>
                <td>${r.from}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  rTableWrap.innerHTML = table;
};

adminReportBtn.onclick = openReportModal;

// ================================
// login/logout
// ================================
loginBtn.onclick = () => {
  const ok = store.loginUser(loginInput.value.trim(), passInput.value.trim());
  if (!ok) {
    loginError.textContent = '❌ Неверный логин или пароль';
    setTimeout(() => (loginError.textContent=''), 2500);
    return;
  }

  const u = store.currentUserObj();
  loginBox.classList.add('hidden');
  appBox.classList.remove('hidden');

  if (u?.mustChangePassword) {
    openPwdModal();
    return;
  }
  afterLogin();
};

logoutBtn.onclick = async () => {
  try { await window.scannerApi?.stopScanner(); } catch {}
  store.logout();

  appBox.classList.add('hidden');
  loginBox.classList.remove('hidden');
  loginInput.value = '';
  passInput.value = '';
  loginError.textContent = '';
  listEl.innerHTML = '';
  appToast('Вы вышли');
};

function afterLogin(){
  const u = store.currentUserObj();
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
    transferBtn.classList.add('hidden');

    initAdminObjectSelect();
  } else {
    userControls.classList.remove('hidden');
    adminPanel.classList.add('hidden');
    transferBtn.classList.remove('hidden');
  }

  updateTransferBadge();
  renderList(searchInput.value);
  renderAdmin();
}

function renderAdmin(){
  const u = store.currentUserObj();
  if (!u || u.role !== 'admin') return;

  const objs = store.getObjects();
  objectsList.innerHTML = '';
  objs.forEach(o => {
    const li = document.createElement('li');
    li.innerHTML = `<span>📦 ${o.name}</span><span class="muted">id: ${o.id.slice(0,6)}…</span>`;
    objectsList.appendChild(li);
  });

  const users = store.getUsers();
  usersList.innerHTML = '';
  users.forEach(us => {
    const objName = us.role === 'admin' ? '—' : (store.getObjectById(us.objectId)?.name || '—');
    const li = document.createElement('li');
    li.innerHTML = `
      <span>👤 ${us.login} <span class="muted">(${us.role})</span></span>
      <span class="muted">${objName}</span>
    `;
    usersList.appendChild(li);
  });
}

// ================================
// List render
// ================================
function renderList(filter=''){
  const u = store.currentUserObj();
  if (!u) return;

  listEl.innerHTML = '';

  let items = store.getItems();

  // ✅ admin: фильтр по выбранному объекту
  if (u.role === 'admin' && adminSelectedObjectId !== 'all') {
    items = items.filter(i => i.objectId === adminSelectedObjectId);
  }

  items = items
    .filter(i => i.name.toLowerCase().includes((filter||'').toLowerCase()))
    .sort((a,b) => a.name.localeCompare(b.name,'ru'));

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
  listEl.querySelectorAll('[data-h]').forEach(btn => btn.onclick = () => openHistory(btn.getAttribute('data-h')));
  listEl.querySelectorAll('[data-w]').forEach(btn => btn.onclick = () => openWriteoff(btn.getAttribute('data-w')));
  listEl.querySelectorAll('[data-t]').forEach(btn => btn.onclick = () => openTransferModal(btn.getAttribute('data-t')));
  listEl.querySelectorAll('[data-d]').forEach(btn => btn.onclick = () => {
    const id = btn.getAttribute('data-d');
    const item = store.getItem(id);
    if (!item) return;

    openConfirm({
      title: 'Удалить позицию?',
      text: `Вы действительно хотите удалить: "${item.name}"?`,
      yesText: 'Удалить',
      onYes: () => {
        const ok = store.deleteItem(id);
        if (ok) {
          appToast('🗑 Удалено');
          renderList(searchInput.value);
        } else {
          appToast('Ошибка удаления');
        }
      }
    });
  });

  listEl.querySelectorAll('[data-plus]').forEach(btn => btn.onclick = () => {
    const id = btn.getAttribute('data-plus');
    window.intakeApi?.openForExistingItem(id);
  });
}
window.renderList = renderList;

// search
searchInput.addEventListener('input', e => renderList(e.target.value));

// ================================
// Auto-login if session exists
// ================================
(function boot(){
  const u = store.currentUserObj();
  if (!u) return;
  loginBox.classList.add('hidden');
  appBox.classList.remove('hidden');

  if (u.mustChangePassword) {
    openPwdModal();
    return;
  }
  afterLogin();
})();