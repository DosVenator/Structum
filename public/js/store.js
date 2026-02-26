// store.js — LocalStorage store (v2) + transfers + admin reporting

// ================================
// LocalStorage keys (v2)
// ================================
const KEY_OBJECTS   = 'inv_objects_v2';
const KEY_USERS     = 'inv_users_v2';
const KEY_ITEMS     = 'inv_items_v2';
const KEY_TRANSFERS = 'inv_transfers_v2';
const KEY_SESSION   = 'inv_session_v2';

// ================================
// helpers
// ================================
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// безопасный timestamp
function opTs(op) {
  if (typeof op?.ts === 'number') return op.ts;
  const parsed = Date.parse(op?.time || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

// ================================
// seed data (first run)
// ================================
(function initSeed(){
  if (!localStorage.getItem(KEY_OBJECTS)) {
    const objects = [
      { id: uid(), name: 'Склад 1', active: true },
      { id: uid(), name: 'Склад 2', active: true }
    ];
    save(KEY_OBJECTS, objects);

    const users = [
      { login:'ivan',  password:'1234', role:'user',  objectId: objects[0].id, mustChangePassword:false },
      { login:'anna',  password:'abcd', role:'user',  objectId: objects[1].id, mustChangePassword:false },
      { login:'admin', password:'admin', role:'admin', mustChangePassword:false }
    ];
    save(KEY_USERS, users);

    save(KEY_ITEMS, []);
    save(KEY_TRANSFERS, []);
    save(KEY_SESSION, null);
  }
})();

// ================================
// session
// ================================
function getSession() {
  return load(KEY_SESSION, null);
}
function setSession(session) {
  save(KEY_SESSION, session);
}
function clearSession() {
  save(KEY_SESSION, null);
}

// ================================
// objects/users
// ================================
function getObjects() {
  return load(KEY_OBJECTS, []);
}
function getObjectById(id) {
  return getObjects().find(o => o.id === id);
}
function getUsers() {
  return load(KEY_USERS, []);
}
function setUsers(users) {
  save(KEY_USERS, users);
}

// ================================
// current user
// ================================
function currentUserObj() {
  const session = getSession();
  if (!session?.login) return null;
  return getUsers().find(u => u.login === session.login) || null;
}

// ================================
// auth
// ================================
function loginUser(login, password) {
  const users = getUsers();
  const u = users.find(x => x.login === login && x.password === password);
  if (!u) return false;
  setSession({ login: u.login });
  return true;
}
function logout() {
  clearSession();
}
function changePassword(newPassword) {
  const u = currentUserObj();
  if (!u) return false;

  const users = getUsers().map(x => {
    if (x.login !== u.login) return x;
    return { ...x, password: newPassword, mustChangePassword: false };
  });
  setUsers(users);
  return true;
}

// ================================
// items
// structure:
// { id, objectId, code, name, quantity, history:[{type,qty,from,time,ts}] }
// ================================
function getAllItems() {
  return load(KEY_ITEMS, []);
}
function setAllItems(items) {
  save(KEY_ITEMS, items);
}

function getItems() {
  const u = currentUserObj();
  if (!u) return [];
  const items = getAllItems();

  if (u.role === 'admin') return items;
  return items.filter(i => i.objectId === u.objectId);
}

function getItemsByObject(objectId) {
  const items = getAllItems();
  return items.filter(i => i.objectId === objectId);
}

function getItem(id) {
  return getAllItems().find(i => i.id === id) || null;
}

function getItemByCodeForCurrentObject(code) {
  const u = currentUserObj();
  if (!u || u.role !== 'user') return null;
  const clean = String(code).replace(/\s+/g,'');
  return getAllItems().find(i => i.objectId === u.objectId && i.code === clean) || null;
}

// add operation (in/out) — ONLY for role user
function addOperation({ code, name, qty, from, type }) {
  const u = currentUserObj();
  if (!u || u.role !== 'user') return { ok:false, error:'no-permission' };

  const cleanCode = String(code).replace(/\s+/g,'');
  const cleanName = String(name || '').trim();
  const nQty = Number(qty);

  if (!cleanCode) return { ok:false, error:'code' };
  if (!cleanName) return { ok:false, error:'name' };
  if (!Number.isFinite(nQty) || nQty <= 0) return { ok:false, error:'qty' };

  const items = getAllItems();
  let item = items.find(i => i.objectId === u.objectId && i.code === cleanCode) || null;

  const op = {
    type, // in | out
    qty: nQty,
    from: (from || '—').trim(),
    time: new Date().toLocaleString(),
    ts: Date.now()
  };

  if (item) {
    // ВАЖНО: всегда суммируем по (objectId+code) — дублей по коду быть не должно
    item.history = item.history || [];
    item.history.push(op);

    const nextQty = item.quantity + (type === 'in' ? nQty : -nQty);
    item.quantity = Math.max(0, nextQty);
  } else {
    item = {
      id: uid(),
      objectId: u.objectId,
      code: cleanCode,
      name: cleanName,
      quantity: type === 'in' ? nQty : 0,
      history: [op]
    };
    items.push(item);
  }

  setAllItems(items);
  return { ok:true, item };
}

function deleteItem(id) {
  const u = currentUserObj();
  if (!u || u.role !== 'user') return false;
  const items = getAllItems().filter(i => i.id !== id);
  setAllItems(items);
  return true;
}

// ================================
// transfers
// structure:
// { id, fromObjectId, toObjectId, code, name, qty, status, createdAt, createdBy, ts }
// ================================
function getAllTransfers() {
  return load(KEY_TRANSFERS, []);
}
function setAllTransfers(transfers) {
  save(KEY_TRANSFERS, transfers);
}

function createTransfer({ itemId, qty, toObjectId }) {
  const u = currentUserObj();
  if (!u || u.role !== 'user') return { ok:false, error:'no-permission' };

  const nQty = Number(qty);
  if (!Number.isFinite(nQty) || nQty <= 0) return { ok:false, error:'qty' };

  const item = getItem(itemId);
  if (!item || item.objectId !== u.objectId) return { ok:false, error:'item' };
  if (item.quantity < nQty) return { ok:false, error:'not-enough' };

  const tr = {
    id: uid(),
    fromObjectId: u.objectId,
    toObjectId,
    code: item.code,
    name: item.name,
    qty: nQty,
    status: 'pending',
    createdAt: new Date().toLocaleString(),
    createdBy: u.login,
    ts: Date.now()
  };

  const transfers = getAllTransfers();
  transfers.push(tr);
  setAllTransfers(transfers);

  return { ok:true, transfer: tr };
}

function getIncomingTransfers() {
  const u = currentUserObj();
  if (!u || u.role !== 'user') return [];
  return getAllTransfers().filter(t => t.toObjectId === u.objectId && t.status === 'pending');
}

function acceptTransfer(id) {
  const u = currentUserObj();
  if (!u || u.role !== 'user') return { ok:false, error:'no-permission' };

  const transfers = getAllTransfers();
  const tr = transfers.find(t => t.id === id);
  if (!tr || tr.status !== 'pending') return { ok:false, error:'transfer' };
  if (tr.toObjectId !== u.objectId) return { ok:false, error:'wrong-object' };

  const items = getAllItems();
  const fromItem = items.find(i => i.objectId === tr.fromObjectId && i.code === tr.code);
  if (!fromItem || fromItem.quantity < tr.qty) return { ok:false, error:'not-enough' };

  // списать у отправителя
  fromItem.history = fromItem.history || [];
  fromItem.history.push({
    type:'out',
    qty: tr.qty,
    from: `Передача → ${getObjectById(tr.toObjectId)?.name || 'Склад'}`,
    time: new Date().toLocaleString(),
    ts: Date.now()
  });
  fromItem.quantity -= tr.qty;

  // добавить получателю
  let toItem = items.find(i => i.objectId === tr.toObjectId && i.code === tr.code);
  if (!toItem) {
    toItem = {
      id: uid(),
      objectId: tr.toObjectId,
      code: tr.code,
      name: tr.name,
      quantity: 0,
      history: []
    };
    items.push(toItem);
  }
  toItem.history = toItem.history || [];
  toItem.history.push({
    type:'in',
    qty: tr.qty,
    from: `Передача ← ${getObjectById(tr.fromObjectId)?.name || 'Склад'}`,
    time: new Date().toLocaleString(),
    ts: Date.now()
  });
  toItem.quantity += tr.qty;

  tr.status = 'accepted';

  setAllItems(items);
  setAllTransfers(transfers);

  return { ok:true };
}

function rejectTransfer(id) {
  const u = currentUserObj();
  if (!u || u.role !== 'user') return { ok:false, error:'no-permission' };

  const transfers = getAllTransfers();
  const tr = transfers.find(t => t.id === id);
  if (!tr || tr.status !== 'pending') return { ok:false, error:'transfer' };
  if (tr.toObjectId !== u.objectId) return { ok:false, error:'wrong-object' };

  tr.status = 'rejected';
  setAllTransfers(transfers);
  return { ok:true };
}

// ================================
// admin: objects/users management
// ================================
function adminCreateObject(name) {
  const u = currentUserObj();
  if (!u || u.role !== 'admin') return { ok:false, error:'no-permission' };

  const clean = String(name||'').trim();
  if (!clean) return { ok:false, error:'name' };

  const objects = getObjects();
  if (objects.some(o => o.name.toLowerCase() === clean.toLowerCase())) {
    return { ok:false, error:'exists' };
  }
  const obj = { id: uid(), name: clean, active:true };
  objects.push(obj);
  save(KEY_OBJECTS, objects);
  return { ok:true, object: obj };
}

function adminCreateUser({ login, tempPassword, objectId }) {
  const u = currentUserObj();
  if (!u || u.role !== 'admin') return { ok:false, error:'no-permission' };

  const l = String(login||'').trim().toLowerCase();
  if (!l) return { ok:false, error:'login' };

  const users = getUsers();
  if (users.some(x => x.login === l)) return { ok:false, error:'login-exists' };

  const obj = getObjectById(objectId);
  if (!obj) return { ok:false, error:'object' };

  const pass = String(tempPassword||'').trim();
  if (!pass) return { ok:false, error:'password' };

  const nu = {
    login: l,
    password: pass,
    role: 'user',
    objectId: obj.id,
    mustChangePassword: true
  };
  users.push(nu);
  setUsers(users);
  return { ok:true, user: nu };
}

// ================================
// admin: reporting
// ================================
// fromTs/toTs — числа (Date.now style)
// itemId optional
// ================================
// admin: reporting
// ================================
// fromTs/toTs — числа (Date.now style)
// itemCode optional (фильтр по штрихкоду)
function adminGetReport({ objectId='all', fromTs=0, toTs=Date.now(), itemId='', itemCode='' }) {
  const u = currentUserObj();
  if (!u || u.role !== 'admin') return { ok:false, error:'no-permission' };

  const objects = getObjects();
  const objectNameById = new Map(objects.map(o => [o.id, o.name]));

  // берём все items
  let items = getAllItems();
  if (objectId !== 'all') {
    items = items.filter(i => i.objectId === objectId);
  }

  // ✅ совместимость:
  // - если пришёл itemCode → фильтруем по code
  // - если пришёл старый itemId → берём его code и фильтруем по нему
  let codeFilter = '';
  if (itemCode) {
    codeFilter = String(itemCode).trim();
  } else if (itemId) {
    const it = getAllItems().find(x => x.id === itemId);
    if (it?.code) codeFilter = String(it.code).trim();
  }

  if (codeFilter) {
    items = items.filter(i => i.code === codeFilter);
  }

  // собираем историю в плоские строки отчёта
  const rows = [];

  for (const it of items) {
    const objName = objectNameById.get(it.objectId) || 'Объект';

    for (const h of (it.history || [])) {
      // ✅ ВАЖНО: используем надёжный timestamp
      const ts = (typeof h?.ts === 'number' && Number.isFinite(h.ts)) ? h.ts : opTs(h);

      // если ts нормальный — фильтруем по периоду
      if (Number.isFinite(ts) && ts > 0) {
        if (ts < fromTs || ts > toTs) continue;
      }
      // если ts = 0 (совсем старая запись) — не режем по периоду, чтобы не терять историю

      rows.push({
        ts,
        time: h.time || '',
        objectId: it.objectId,
        objectName: objName,
        itemId: it.id,
        itemCode: it.code,
        itemName: it.name,
        type: h.type,
        qty: h.qty,
        from: h.from
      });
    }
  }

  // ✅ сортировка по ts (самое новое сверху)
  rows.sort((a,b) => (b.ts || 0) - (a.ts || 0));

  return { ok:true, rows };
}

// ================================
// export to window
// ================================
window.store = {
  // auth
  loginUser,
  logout,
  currentUserObj,
  changePassword,

  // objects/users
  getObjects,
  getObjectById,
  getUsers,
  adminCreateObject,
  adminCreateUser,

  // items
  getItems,
  getItemsByObject,
  getItem,
  getItemByCodeForCurrentObject,
  addOperation,
  deleteItem,

  // transfers
  createTransfer,
  getIncomingTransfers,
  acceptTransfer,
  rejectTransfer,

  // admin report
  adminGetReport
};