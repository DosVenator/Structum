/* public/js/idb.js
   Мини-обёртка над IndexedDB для:
   - outbox (очередь офлайн-операций)
   - cache (кэш объектов/товаров)
*/

const DB_NAME = 'structum-db';
const DB_VER = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);

    req.onupgradeneeded = () => {
      const db = req.result;

      // Очередь офлайн действий
      if (!db.objectStoreNames.contains('outbox')) {
        const s = db.createObjectStore('outbox', { keyPath: 'localId' });
        s.createIndex('status', 'status', { unique: false });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Кэш (items/objects/прочее)
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    const res = fn(store);
    t.oncomplete = () => resolve(res);
    t.onerror = () => reject(t.error);
  });
}

/* =========================
   OUTBOX
   ========================= */

export async function outboxAdd(job) {
  return tx('outbox', 'readwrite', (s) => s.put(job));
}

export async function outboxGetPending(limit = 30) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('outbox', 'readonly');
    const s = t.objectStore('outbox');
    const idx = s.index('status');
    const req = idx.openCursor(IDBKeyRange.only('queued'));

    const items = [];
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return resolve(items);
      items.push(cur.value);
      if (items.length >= limit) return resolve(items);
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function outboxMarkSent(localId) {
  return tx('outbox', 'readwrite', (s) => {
    const getReq = s.get(localId);
    getReq.onsuccess = () => {
      const v = getReq.result;
      if (!v) return;
      v.status = 'sent';
      v.sentAt = Date.now();
      s.put(v);
    };
  });
}

export async function outboxMarkFailed(localId, reason = '') {
  return tx('outbox', 'readwrite', (s) => {
    const getReq = s.get(localId);
    getReq.onsuccess = () => {
      const v = getReq.result;
      if (!v) return;
      v.status = 'failed';
      v.failedAt = Date.now();
      v.failReason = String(reason || '');
      s.put(v);
    };
  });
}

export async function outboxCountQueued() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('outbox', 'readonly');
    const s = t.objectStore('outbox');
    const idx = s.index('status');
    const req = idx.count(IDBKeyRange.only('queued'));
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => reject(req.error);
  });
}

/* =========================
   CACHE
   ========================= */

export async function cacheSet(key, value) {
  return tx('cache', 'readwrite', (s) =>
    s.put({ key: String(key), value, updatedAt: Date.now() })
  );
}

export async function cacheGet(key) {
  const db = await openDB();
  return new Promise((resolve) => {
    const t = db.transaction('cache', 'readonly');
    const s = t.objectStore('cache');
    const req = s.get(String(key));
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => resolve(null);
  });
}