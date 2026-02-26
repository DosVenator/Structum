// public/js/store.js — API store (cookie sessions)

let _me = null;
let _objects = [];
let _items = [];

async function api(path, { method = 'GET', body } = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data?.error || 'api-error');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// --- auth ---
async function loginUser(login, password) {
  try {
    const r = await api('/api/login', { method: 'POST', body: { login, password } });
    _me = r.user;
    return { ok: true, user: _me };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || e.message };
  }
}

async function logout() {
  try { await api('/api/logout', { method: 'POST' }); } catch {}
  _me = null;
  _objects = [];
  _items = [];
}

async function currentUserObj() {
  if (_me) return _me;
  const r = await api('/api/me');
  _me = r.user;
  return _me;
}

// --- objects ---
async function getObjects() {
  const r = await api('/api/objects');
  _objects = r.objects || [];
  return _objects;
}

function getObjectById(id) {
  return _objects.find(o => o.id === id) || null;
}

// --- items ---
async function getItems({ objectId = 'all' } = {}) {
  const me = await currentUserObj();
  const q = me?.role === 'admin' ? `?objectId=${encodeURIComponent(objectId)}` : '';
  const r = await api('/api/items' + q);
  _items = r.items || [];
  return _items;
}

function getItem(id) {
  return _items.find(i => i.id === id) || null;
}

function getItemByCodeForCurrentObject(code) {
  const clean = String(code || '').replace(/\s+/g, '');
  return _items.find(i => i.code === clean) || null;
}

// operations
async function addOperation({ code, name, qty, from, type }) {
  try {
    const r = await api('/api/ops', { method: 'POST', body: { code, name, qty, from, type } });

    const updated = r.item;
    const idx = _items.findIndex(x => x.id === updated.id);
    if (idx >= 0) _items[idx] = updated;
    else _items.unshift(updated);

    return { ok: true, item: updated };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || 'server' };
  }
}

async function getHistory(itemId) {
  const r = await api(`/api/items/${encodeURIComponent(itemId)}/history`);
  return r.history || [];
}

// report
async function adminGetReport({ objectId, fromTs, toTs, itemCode }) {
  try {
    const qs = new URLSearchParams({
      objectId: objectId || 'all',
      fromTs: String(fromTs || 0),
      toTs: String(toTs || Date.now()),
      itemCode: String(itemCode || '')
    });
    const r = await api('/api/report?' + qs.toString());
    return { ok: true, rows: r.rows || [] };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || 'server' };
  }
}

// stubs (пока не реализовано)
function getUsers() { return []; }
async function adminCreateObject() { return { ok: false, error: 'not-implemented' }; }
async function adminCreateUser() { return { ok: false, error: 'not-implemented' }; }
async function changePassword() { return false; }
function getIncomingTransfers() { return []; }
async function createTransfer() { return { ok: false, error: 'not-implemented' }; }
async function acceptTransfer() { return { ok: false, error: 'not-implemented' }; }
async function rejectTransfer() { return { ok: false, error: 'not-implemented' }; }
async function deleteItem() { return false; }

window.store = {
  loginUser,
  logout,
  currentUserObj,

  getObjects,
  getObjectById,

  getItems,
  getItem,
  getItemByCodeForCurrentObject,

  addOperation,
  getHistory,

  adminGetReport,

  getUsers,
  adminCreateObject,
  adminCreateUser,
  changePassword,
  getIncomingTransfers,
  createTransfer,
  acceptTransfer,
  rejectTransfer,
  deleteItem
};