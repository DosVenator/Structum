/* public/js/offlineQueue.js
   Очередь офлайн-операций + безопасная синхронизация без нагрузки на батарейку
*/

import { outboxAdd, outboxGetPending, outboxMarkSent, outboxMarkFailed, outboxCountQueued } from './idb.js';

function uuid() {
  // достаточно для localId
  return (crypto?.randomUUID?.() || (Date.now() + '-' + Math.random().toString(16).slice(2)));
}

let flushTimer = null;
let flushing = false;
let backoffMs = 0;

function isOnline() {
  return navigator.onLine === true;
}

export async function queueCount() {
  try { return await outboxCountQueued(); } catch { return 0; }
}

export async function enqueueJob({ kind, request }) {
  const job = {
    localId: uuid(),
    kind: String(kind || 'api'),
    status: 'queued',
    createdAt: Date.now(),
    request: request || null
  };

  await outboxAdd(job);

  // попробуем сразу (если онлайн)
  scheduleFlush(400);
  return job.localId;
}

export function scheduleFlush(delay = 800) {
  if (flushTimer) return; // уже запланировано
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush().catch(() => {});
  }, delay);
}

async function sendJob(job) {
  // request: { url, method, body }
  const r = job?.request || {};
  const url = r.url;
  const method = r.method || 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: r.body !== undefined ? JSON.stringify(r.body) : undefined
  });

  // если сессия умерла — это не “ошибка сети”, а “нужно войти”
  if (res.status === 401) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data?.error || 'unauthorized');
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data?.error || `http-${res.status}`);
    err.code = `HTTP_${res.status}`;
    throw err;
  }

  return res.json().catch(() => ({}));
}

export async function flush() {
  if (flushing) return;
  if (!isOnline()) return;

  // чтобы не убивать батарейку: не шлем когда вкладка в фоне
  if (document.visibilityState === 'hidden') return;

  flushing = true;

  try {
    const batch = await outboxGetPending(20);
    if (!batch.length) {
      backoffMs = 0;
      return;
    }

    for (const job of batch) {
      try {
        await sendJob(job);
        await outboxMarkSent(job.localId);
      } catch (e) {
        // Если 401 — не долбим сеть, ждём логина
        if (e?.code === 'UNAUTHORIZED') {
          await outboxMarkFailed(job.localId, 'unauthorized');
          // остальные тоже смысла нет отправлять — сессии нет
          break;
        }

        // Любая другая ошибка: помечаем failed (можно будет “повторить” позже)
        await outboxMarkFailed(job.localId, e?.message || 'failed');
      }
    }

    // если ещё остались queued — продолжим мягко
    const left = await outboxCountQueued();
    if (left > 0) {
      // легкий бэкофф (чтобы не спамить)
      backoffMs = backoffMs ? Math.min(backoffMs * 1.7, 30000) : 1200;
      setTimeout(() => scheduleFlush(0), backoffMs);
    } else {
      backoffMs = 0;
    }
  } finally {
    flushing = false;
  }
}

export function initQueueAutoFlush() {
  // При появлении сети — пробуем синкнуть
  window.addEventListener('online', () => scheduleFlush(300));

  // При возвращении во вкладку — тоже
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleFlush(300);
  });

  // Очень лёгкий таймер: раз в 12 сек, ТОЛЬКО если есть очередь и вкладка видима
  setInterval(async () => {
    if (document.visibilityState !== 'visible') return;
    if (!isOnline()) return;
    const n = await outboxCountQueued().catch(() => 0);
    if (n > 0) scheduleFlush(100);
  }, 12000);
}