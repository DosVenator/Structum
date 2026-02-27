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

async function changePassword(newPassword, oldPassword = '') {
  try {
    await api('/api/change-password', {
      method: 'POST',
      body: {
        newPassword: String(newPassword || ''),
        oldPassword: String(oldPassword || '')
      }
    });
    if (_me) _me.mustChangePassword = false;
    return { ok: true };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || e.message || 'server' };
  }
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
    return { ok: false, status: e.status, error: e.data?.error || e.message || 'server' };
  }
}

async function getHistory(itemId, { fromTs, toTs } = {}) {
  const qs = new URLSearchParams();
  if (fromTs !== undefined) qs.set('fromTs', String(fromTs));
  if (toTs !== undefined) qs.set('toTs', String(toTs));

  const url =
    `/api/items/${encodeURIComponent(itemId)}/history` +
    (qs.toString() ? `?${qs.toString()}` : '');

  const r = await api(url);
  return r.history || [];
}

// report
async function adminGetReport({ objectId, fromTs, toTs, itemCode, type = 'all' }) {
  try {
    const qs = new URLSearchParams({
      objectId: objectId || 'all',
      fromTs: String(fromTs || 0),
      toTs: String(toTs || Date.now()),
      itemCode: String(itemCode || ''),
      type: String(type || 'all')
    });
    const r = await api('/api/report?' + qs.toString());
    return { ok: true, rows: r.rows || [] };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || e.message || 'server' };
  }
}

/* ===========================
   TRANSFERS
   =========================== */

async function createTransfer({ itemId, toObjectId, qty }) {
  try {
    const r = await api('/api/transfers', {
      method: 'POST',
      body: { itemId, toObjectId, qty: Number(qty) }
    });
    return { ok: true, transfer: r.transfer };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || e.message || 'server' };
  }
}

async function getIncomingTransfers() {
  try {
    const r = await api('/api/transfers/incoming');
    return { ok: true, transfers: r.transfers || [] };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || e.message || 'server' };
  }
}

async function getOutgoingTransfers() {
  try {
    const r = await api('/api/transfers/outgoing');
    return { ok: true, transfers: r.transfers || [] };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || e.message || 'server' };
  }
}

async function acceptTransfer(id) {
  try {
    const r = await api(`/api/transfers/${encodeURIComponent(id)}/accept`, { method: 'POST' });
    return { ok: true, transfer: r.transfer };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || e.message || 'server' };
  }
}

async function rejectTransfer(id) {
  try {
    const r = await api(`/api/transfers/${encodeURIComponent(id)}/reject`, { method: 'POST' });
    return { ok: true, transfer: r.transfer };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || e.message || 'server' };
  }
}

/* ===========================
   ADMIN
   =========================== */

async function getUsers() {
  try {
    const r = await api('/api/admin/users');
    return { ok: true, users: r.users || [] };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || e.message || 'server' };
  }
}

async function adminCreateObject({ name }) {
  try {
    const r = await api('/api/admin/objects', { method: 'POST', body: { name } });
    _objects = [];
    return { ok: true, object: r.object };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || e.message || 'server' };
  }
}

async function adminDeleteObject(id) {
  try {
    await api(`/api/admin/objects/${encodeURIComponent(id)}`, { method: 'DELETE' });
    _objects = [];
    return { ok: true };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || e.message || 'server' };
  }
}

async function adminCreateUser({ login, password, role = 'user', objectId = null }) {
  try {
    const r = await api('/api/admin/users', {
      method: 'POST',
      body: { login, password, role, objectId }
    });
    return { ok: true, user: r.user };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || e.message || 'server' };
  }
}

async function adminDeleteUser(id) {
  try {
    await api(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return { ok: true };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || e.message || 'server' };
  }
}

// stubs
async function deleteItem() { return false; }

window.store = {
  loginUser,
  logout,
  currentUserObj,
  changePassword,

  getObjects,
  getObjectById,

  getItems,
  getItem,
  getItemByCodeForCurrentObject,

  addOperation,
  getHistory,

  adminGetReport,

  // transfers
  createTransfer,
  getIncomingTransfers,
  getOutgoingTransfers,
  acceptTransfer,
  rejectTransfer,

  // admin
  getUsers,
  adminCreateObject,
  adminDeleteObject,
  adminCreateUser,
  adminDeleteUser,

  // stubs
  deleteItem
};