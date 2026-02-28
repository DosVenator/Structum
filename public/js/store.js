// public/js/store.js — API store (cookie sessions)
import { cacheGet, cacheSet } from './idb.js';
import { enqueueJob, initQueueAutoFlush, queueCount } from './offlineQueue.js';

let _me = null;
let _objects = [];
let _items = [];
let _localDirty = false; // есть локальные изменения, не затирать кэшем

async function api(path, { method = 'GET', body } = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(path, opts);
  } catch (e) {
    // офлайн/сеть упала
    const err = new Error('network');
    err.status = 0;
    err.data = { error: 'network' };
    throw err;
  }

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
  const r = await api('/api/me'); // теперь /api/me вернёт 401 если не залогинен
  _me = r.user;
  return _me;
}
// пытаемся восстановить сессию после F5 (без падений)
async function restoreSession() {
  try {
    const r = await api('/api/me');
    _me = r.user;
    return { ok: true, user: _me };
  } catch (e) {
    _me = null;
    return { ok: false, status: e.status || 0 };
  }
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
  try {
    const r = await api('/api/objects');
    _objects = r.objects || [];
    await cacheSet('objects', _objects);
    return _objects;
  } catch (e) {
    const cached = await cacheGet('objects');
    _objects = Array.isArray(cached) ? cached : [];
    return _objects;
  }
}

function getObjectById(id) {
  return _objects.find(o => o.id === id) || null;
}

// --- items ---
async function getItems({ objectId = 'all' } = {}) {
  const me = await currentUserObj();
  const q = me?.role === 'admin' ? `?objectId=${encodeURIComponent(objectId)}` : '';
  const cacheKey = `items:${me?.role === 'admin' ? objectId : (me?.objectId || 'me')}`;

  try {
    const r = await api('/api/items' + q);
    _items = r.items || [];
    await cacheSet(cacheKey, _items);
    return _items;
  } catch (e) {
  const cached = await cacheGet(cacheKey);
  const cachedArr = Array.isArray(cached) ? cached : [];
  // если есть локальные изменения (queued), не перетираем текущий _items кэшем
  if (_localDirty && Array.isArray(_items) && _items.length) {
    return _items;
  }
  _items = cachedArr;
  return _items;
}
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

    return { ok: true, item: updated, queued: false };
  } catch (e) {
    // если офлайн — кладём в очередь и делаем оптимистичное обновление
    if (e?.data?.error === 'network' || e.status === 0) {
      const me = await currentUserObj().catch(() => null);

      await enqueueJob({
        kind: 'ops',
        request: {
          url: '/api/ops',
          method: 'POST',
          body: { code, name, qty, from, type }
        }
      });
      _localDirty = true;
      // оптимистично обновим локально список (если есть этот товар)
      const clean = String(code || '').replace(/\s+/g, '');
      const local = _items.find(i => i.code === clean) || null;

      if (local) {
        const delta = (type === 'in') ? Number(qty) : -Number(qty);
        local.quantity = Math.max(0, Number(local.quantity || 0) + delta);
      } else {
        // если товара не было — добавим локально “черновик”
        _items.unshift({
          id: 'local-' + Date.now(),
          code: clean,
          name: String(name || clean),
          quantity: type === 'in' ? Number(qty) : 0,
          objectId: me?.objectId || null
        });
      }

      return { ok: true, queued: true };
    }

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

async function createTransfer({ itemId, toObjectId, qty, damaged = false, comment = '' }) {
  try {
    const r = await api('/api/transfers', {
      method: 'POST',
      body: { itemId, toObjectId, qty: Number(qty), damaged: !!damaged, comment: String(comment || '') }
    });
    return { ok: true, transfer: r.transfer, queued: false };
  } catch (e) {
    if (e?.data?.error === 'network' || e.status === 0) {
  await enqueueJob({
    kind: 'transfer-create',
    request: {
      url: '/api/transfers',
      method: 'POST',
      body: { itemId, toObjectId, qty: Number(qty), damaged: !!damaged, comment: String(comment || '') }
    }
  });

  _localDirty = true;

  // ✅ ОПТИМИСТИЧНО: сразу уменьшаем остаток на текущем складе
  const n = Number(qty);
  const it = _items.find(x => x.id === itemId);
  if (it && Number.isFinite(n) && n > 0) {
    it.quantity = Math.max(0, Number(it.quantity || 0) - n);

    // если стало 0 — убираем из списка (как ты и ожидаешь)
    if (it.quantity === 0) {
      _items = _items.filter(x => x.id !== itemId);
    }
  }

  return { ok: true, queued: true };
}
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
async function getTransferDetails(id) {
  try {
    const r = await api(`/api/transfers/${encodeURIComponent(id)}`);
    return { ok: true, transfer: r.transfer };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || e.message || 'server' };
  }
}
async function getTransferUpdates(sinceTs = 0) {
  try {
    const r = await api(`/api/transfers/updates?sinceTs=${encodeURIComponent(String(sinceTs || 0))}`);
    return { ok: true, updates: r.updates || [] };
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
async function deleteItem(id) {
  try {
    await api(`/api/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
    _items = _items.filter(x => x.id !== id);
    return { ok: true };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || e.message || 'server' };
  }
}
async function getPushPublicKey() {
  try {
    const r = await api('/api/push/public-key');
    return { ok: true, publicKey: r.publicKey };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || e.message || 'server' };
  }
}

async function pushSubscribe(subscription) {
  try {
    await api('/api/push/subscribe', { method: 'POST', body: { subscription } });
    return { ok: true };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || e.message || 'server' };
  }
}
async function pushTest() {
  try {
    const r = await api('/api/push/test', { method: 'POST' });
    return { ok: true };
  } catch (e) {
    return { ok: false, status: e.status, error: e.data?.error || e.message || 'server' };
  }
}

initQueueAutoFlush();
// Авто-восстановление сессии при перезагрузке страницы
const _bootRestore = restoreSession();

window.store = {
  loginUser,
  logout,
  restoreSession,
  boot: () => _bootRestore,
  currentUserObj,
  changePassword,

queueCount,

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
  getTransferDetails,
  getTransferUpdates,
  getPushPublicKey,
  pushSubscribe,

  // admin
  getUsers,
  adminCreateObject,
  adminDeleteObject,
  adminCreateUser,
  adminDeleteUser,

  // stubs
  pushTest,
  deleteItem
};