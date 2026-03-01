// server.js
'use strict';

const express = require('express');
const path = require('path');

const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');

const bcrypt = require('bcrypt');
const webpush = require('web-push');
const { PrismaClient } = require('@prisma/client');

const app = express();
app.set('trust proxy', 1);

// ✅ BigInt-safe JSON (чтобы Prisma BigInt не ломал res.json)
app.set('json replacer', (key, value) => (typeof value === 'bigint' ? value.toString() : value));

const prisma = new PrismaClient();

// ================================
// ENV / CONFIG
// ================================
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is missing');
}

const SESSION_SECRET =
  process.env.SESSION_SECRET || process.env.JWT_SECRET || 'dev-secret-change-me';

// ================================
// DB pool (для connect-pg-simple)
// ================================
const isLocal =
  (DATABASE_URL || '').includes('localhost') ||
  (DATABASE_URL || '').includes('127.0.0.1');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

// ================================
// PUSH (Web Push)
// ================================
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT     || 'mailto:admin@example.com';

const PUSH_ENABLED = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (PUSH_ENABLED) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('✅ PUSH enabled');
} else {
  console.warn('⚠️ PUSH disabled: VAPID keys are missing');
}

async function sendPushToSubscriptions(subs, payloadObj) {
  if (!PUSH_ENABLED) return;
  if (!subs?.length) return;

  const payload = JSON.stringify(payloadObj || {});
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
      } catch (e) {
        const status = e?.statusCode || e?.status || 0;

        // если подписка умерла — удаляем (410/404)
        if (status === 404 || status === 410) {
          try { await prisma.pushSubscription.delete({ where: { endpoint: s.endpoint } }); } catch {}
        } else {
          console.warn('push send error', status, e?.message || e);
        }
      }
    })
  );
}

async function sendPushToObject(objectId, payloadObj) {
  if (!PUSH_ENABLED) return;
  if (!objectId) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { objectId: String(objectId) }
  });

  if (!subs.length) return;
  await sendPushToSubscriptions(subs, payloadObj);
}

// ================================
// Request logger
// ================================
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => {
    console.log(`${res.statusCode} ${req.method} ${req.originalUrl} ${Date.now() - t0}ms`);
  });
  next();
});

// ================================
// STATIC FIRST
// ================================
app.use(express.static(path.join(__dirname, 'public')));

// Healthcheck
app.get('/health', (req, res) => res.status(200).send('OK'));

// ================================
// ✅ NO-CACHE for API (fix 304 + sessions + updates)
// ================================
app.disable('etag'); // или: app.set('etag', false);

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});


// Parsers only for /api
app.use('/api', express.json());
app.use('/api', express.urlencoded({ extended: true }));

// ================================
// Sessions only for /api
// ================================
const sessionStore = new pgSession({
  pool,
  tableName: 'session',
  createTableIfMissing: true
});

// ✅ супер важно: увидеть реальные ошибки store
sessionStore.on('error', (e) => {
  console.error('❌ SESSION STORE ERROR:', e);
});

app.use(
  '/api',
  session({
    store: sessionStore,
    name: 'inv.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: 'auto',
      maxAge: 1000 * 60 * 60 * 24 * 14
    }
  })
);
app.use('/api', (req, res, next) => {
  if (req.path === '/me') {
    console.log('🍪 /api/me cookie:', req.headers.cookie || '(none)');
    console.log('🧩 sessionID:', req.sessionID);
    console.log('👤 session.user:', req.session?.user || null);
  }
  next();
});

// ================================
// Helpers / guards
// ================================
function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}
function requireAdmin(req, res, next) {
  if (req.session?.user?.role !== 'admin') return res.status(403).json({ ok: false, error: 'forbidden' });
  next();
}
function requireUser(req, res, next) {
  if (req.session?.user?.role !== 'user') return res.status(403).json({ ok: false, error: 'forbidden' });
  next();
}

function cleanName(s) {
  return String(s || '').trim();
}
function cleanLogin(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, '');
}
function isStrongEnoughPassword(p) {
  return String(p || '').length >= 4;
}

// Киевское время
function kyivTimeString(date = new Date()) {
  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}
function nowMeta() {
  const ts = BigInt(Date.now());
  const time = kyivTimeString(new Date());
  return { ts, time };
}

// ================================
// PUSH routes
// ================================
app.get('/api/push/public-key', requireAuth, (req, res) => {
  if (!PUSH_ENABLED) return res.status(503).json({ ok: false, error: 'push-disabled' });
  res.json({ ok: true, publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/push/subscribe', requireAuth, async (req, res, next) => {
  try {
    if (!PUSH_ENABLED) return res.status(503).json({ ok: false, error: 'push-disabled' });

    const u = req.session.user;
    const sub = req.body?.subscription;

    const endpoint = String(sub?.endpoint || '').trim();
    const p256dh = String(sub?.keys?.p256dh || '').trim();
    const auth = String(sub?.keys?.auth || '').trim();

    if (!endpoint || !p256dh || !auth) return res.status(400).json({ ok: false, error: 'bad-subscription' });

    const expirationTime = sub?.expirationTime ? BigInt(Math.floor(Number(sub.expirationTime))) : null;

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        p256dh,
        auth,
        expirationTime,
        userId: u?.id || null,
        objectId: u?.objectId || null,
        userAgent: String(req.headers['user-agent'] || '').slice(0, 300)
      },
      create: {
        endpoint,
        p256dh,
        auth,
        expirationTime,
        userId: u?.id || null,
        objectId: u?.objectId || null,
        userAgent: String(req.headers['user-agent'] || '').slice(0, 300)
      }
    });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// тест пуша на текущий объект
app.post('/api/push/test', requireAuth, async (req, res) => {
  try {
    if (!PUSH_ENABLED) return res.status(503).json({ ok: false, error: 'push-disabled' });

    const u = req.session.user;
    if (!u?.objectId) return res.status(400).json({ ok: false, error: 'no-object' });

    await sendPushToObject(u.objectId, {
      title: '🔔 Тест уведомлений',
      body: 'Если ты это видишь в шторке — PUSH работает.',
      tag: 'test-push',
      data: { url: '/' }
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('push test error', e);
    res.status(500).json({ ok: false, error: 'server' });
  }
});

// ================================
// AUTH
// ================================
app.post('/api/login', async (req, res, next) => {
  try {
    const login = cleanLogin(req.body.login);
    const password = String(req.body.password || '').trim();

    if (!login || !password) return res.status(400).json({ ok: false, error: 'bad-request' });

    const user = await prisma.user.findUnique({ where: { login } });
    if (!user) return res.status(401).json({ ok: false, error: 'invalid' });
    if (user.active === false) return res.status(403).json({ ok: false, error: 'inactive' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, error: 'invalid' });

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ ok: false, error: 'session' });

      req.session.user = {
        id: user.id,
        login: user.login,
        role: user.role,
        objectId: user.objectId,
        mustChangePassword: user.mustChangePassword
      };

      req.session.save((err2) => {
        if (err2) return res.status(500).json({ ok: false, error: 'session' });
        res.json({ ok: true, user: req.session.user });
      });
    });
  } catch (e) {
    next(e);
  }
});

app.post('/api/logout', (req, res) => {
  req.session?.destroy(() => {
    res.clearCookie('inv.sid', {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    res.json({ ok: true });
  });
});

app.get('/api/me', (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  return res.json({ ok: true, user: req.session.user });
});

app.post('/api/change-password', requireAuth, async (req, res, next) => {
  try {
    const u = req.session.user;

    const oldPassword = String(req.body.oldPassword || '');
    const newPassword = String(req.body.newPassword || '');

    if (!isStrongEnoughPassword(newPassword)) {
      return res.status(400).json({ ok: false, error: 'weak-password' });
    }

    const user = await prisma.user.findUnique({ where: { id: u.id } });
    if (!user) return res.status(404).json({ ok: false, error: 'not-found' });
    if (user.active === false) return res.status(403).json({ ok: false, error: 'inactive' });

    const forced = user.mustChangePassword === true;

    if (!forced) {
      if (!oldPassword) return res.status(400).json({ ok: false, error: 'old-required' });
      const okOld = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!okOld) return res.status(401).json({ ok: false, error: 'old-invalid' });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: u.id },
      data: { passwordHash: hash, mustChangePassword: false }
    });

    req.session.user.mustChangePassword = false;
    req.session.save(() => res.json({ ok: true }));
  } catch (e) {
    next(e);
  }
});

// ================================
// OBJECTS
// ================================
app.get('/api/objects', requireAuth, async (req, res, next) => {
  try {
    const objects = await prisma.object.findMany({
      where: { active: true },
      orderBy: { name: 'asc' }
    });
    res.json({ ok: true, objects });
  } catch (e) {
    next(e);
  }
});

// ================================
// ADMIN: Objects & Users
// ================================
app.post('/api/admin/objects', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const name = cleanName(req.body.name);
    if (!name) return res.status(400).json({ ok: false, error: 'name-required' });

    const created = await prisma.object.create({ data: { name, active: true } });
    res.json({ ok: true, object: created });
  } catch (e) {
    if (e?.code === 'P2002') return res.status(409).json({ ok: false, error: 'object-exists' });
    next(e);
  }
});

app.delete('/api/admin/objects/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id);

    const obj = await prisma.object.findUnique({ where: { id } });
    if (!obj) return res.status(404).json({ ok: false, error: 'not-found' });

    await prisma.$transaction(async (tx) => {
      await tx.object.update({ where: { id }, data: { active: false } });
      await tx.user.updateMany({ where: { objectId: id }, data: { active: false } });
    });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const meId = req.session.user.id;

    const users = await prisma.user.findMany({
      where: { active: true, NOT: { id: meId } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { object: { select: { id: true, name: true } } }
    });

    res.json({
      ok: true,
      users: users.map(u => ({
        id: u.id,
        login: u.login,
        role: u.role,
        objectId: u.objectId,
        objectName: u.object?.name || null,
        mustChangePassword: u.mustChangePassword,
        active: true,
        createdAt: u.createdAt
      }))
    });
  } catch (e) {
    next(e);
  }
});

app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const login = cleanLogin(req.body.login);
    const password = String(req.body.password || '');
    const role = String(req.body.role || 'user').trim();
    const objectIdRaw = req.body.objectId;

    if (!login) return res.status(400).json({ ok: false, error: 'login-required' });
    if (!isStrongEnoughPassword(password)) return res.status(400).json({ ok: false, error: 'weak-password' });
    if (role !== 'admin' && role !== 'user') return res.status(400).json({ ok: false, error: 'bad-role' });

    const objectId = role === 'user' ? String(objectIdRaw || '').trim() : null;
    if (role === 'user' && !objectId) return res.status(400).json({ ok: false, error: 'object-required' });

    if (role === 'user') {
      const obj = await prisma.object.findUnique({ where: { id: objectId } });
      if (!obj || obj.active === false) return res.status(404).json({ ok: false, error: 'object-not-found' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await prisma.user.create({
      data: {
        login,
        passwordHash,
        role,
        objectId,
        mustChangePassword: true,
        active: true
      }
    });

    res.json({
      ok: true,
      user: {
        id: created.id,
        login: created.login,
        role: created.role,
        objectId: created.objectId,
        mustChangePassword: created.mustChangePassword,
        active: created.active !== false
      }
    });
  } catch (e) {
    if (e?.code === 'P2002') return res.status(409).json({ ok: false, error: 'login-exists' });
    next(e);
  }
});

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id);

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ ok: false, error: 'not-found' });

    if (req.session?.user?.id === id) return res.status(400).json({ ok: false, error: 'cannot-delete-self' });

    await prisma.user.update({ where: { id }, data: { active: false } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ================================
// ITEMS
// ================================
app.get('/api/items', requireAuth, async (req, res, next) => {
  try {
    const u = req.session.user;

    const requestedObjectId = String(req.query.objectId || 'all');
    const objectId = u.role === 'admin' ? requestedObjectId : u.objectId;

    const where = { active: true };
    if (objectId && objectId !== 'all') where.objectId = objectId;

    const items = await prisma.item.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    res.json({ ok: true, items });
  } catch (e) {
    next(e);
  }
});

app.delete('/api/items/:id', requireAuth, async (req, res, next) => {
  try {
    const u = req.session.user;
    const id = String(req.params.id);

    const item = await prisma.item.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ ok: false, error: 'not-found' });

    if (u.role !== 'admin' && item.objectId !== u.objectId) return res.status(403).json({ ok: false, error: 'forbidden' });

    await prisma.item.update({ where: { id }, data: { active: false } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
app.patch('/api/items/:id', requireAuth, requireUser, async (req, res, next) => {
  try {
    const u = req.session.user;
    const id = String(req.params.id);
    const name = String(req.body.name || '').trim();

    if (!name) return res.status(400).json({ ok: false, error: 'name-required' });

    const item = await prisma.item.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ ok: false, error: 'not-found' });
    if (item.objectId !== u.objectId) return res.status(403).json({ ok: false, error: 'forbidden' });

    const updated = await prisma.item.update({
      where: { id },
      data: { name }
    });

    res.json({ ok: true, item: updated });
  } catch (e) {
    next(e);
  }
});
app.get('/api/items/:id/history', requireAuth, async (req, res, next) => {
  try {
    const u = req.session.user;
    const id = String(req.params.id);

    const nowMs = Date.now();
    const defaultFrom = nowMs - 7 * 24 * 60 * 60 * 1000;

    const fromTsNum = req.query.fromTs !== undefined ? Number(req.query.fromTs) : defaultFrom;
    const toTsNum   = req.query.toTs   !== undefined ? Number(req.query.toTs)   : nowMs;

    if (!Number.isFinite(fromTsNum) || !Number.isFinite(toTsNum)) {
      return res.status(400).json({ ok: false, error: 'bad-ts' });
    }

    const fromTs = BigInt(Math.max(0, Math.floor(fromTsNum)));
    const toTs   = BigInt(Math.max(0, Math.floor(toTsNum)));

    const item = await prisma.item.findUnique({ where: { id }, include: { object: true } });
    if (!item) return res.status(404).json({ ok: false, error: 'not-found' });

    if (u.role !== 'admin' && item.objectId !== u.objectId) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }

    const ops = await prisma.operation.findMany({
      where: { itemId: id, ts: { gte: fromTs, lte: toTs } },
      orderBy: { ts: 'desc' },
      take: 500,
      include: {
        transfer: { select: { id: true, damaged: true, comment: true } }
      }
    });

    const history = ops.map(op => ({
      type: op.type,
      qty: op.qty,
      from: op.from,
      time: op.time,
      ts: op.ts,
      transferId: op.transfer?.id || null,
      damaged: op.transfer?.damaged === true,
      hasComment: !!(op.transfer?.comment && String(op.transfer.comment).trim())
    }));

    res.json({ ok: true, history });
  } catch (e) {
    next(e);
  }
});

// ================================
// OPERATIONS
// ================================
app.post('/api/ops', requireAuth, requireUser, async (req, res, next) => {
  try {
    const u = req.session.user;

    const code = String(req.body.code || '').replace(/\s+/g, '');
    const name = String(req.body.name || '').trim();
    const unit = String(req.body.unit || '').trim();
    const qty = Number(req.body.qty);
    const from = String(req.body.from || '—').trim();
    const type = String(req.body.type || '').trim();
    
    if (!code || !name) return res.status(400).json({ ok: false, error: 'bad-request' });
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ ok: false, error: 'qty' });
    if (type !== 'in' && type !== 'out') return res.status(400).json({ ok: false, error: 'type' });

    const { ts, time } = nowMeta();

    const item = await prisma.item.findUnique({
  where: { objectId_code: { objectId: u.objectId, code } }
});

let ensuredItem = item;

if (!item) {
  // ✅ новый товар — тут name + unit обязателен
  if (!unit) return res.status(400).json({ ok: false, error: 'unit-required' });

  ensuredItem = await prisma.item.create({
    data: { objectId: u.objectId, code, name, unit, quantity: 0, active: true }
  });
} else {
  // ✅ если уже есть — просто активируем
  ensuredItem = await prisma.item.update({
    where: { id: item.id },
    data: { active: true }
  });
}

const newQty = type === 'in'
  ? ensuredItem.quantity + qty
  : Math.max(0, ensuredItem.quantity - qty);

const updated = await prisma.item.update({
  where: { id: ensuredItem.id },
  data: {
    // ✅ name НЕ трогаем здесь
    quantity: newQty,
    operations: {
      create: { type, qty, from, ts, time, objectId: u.objectId, userId: u.id }
    }
  }
});

res.json({ ok: true, item: updated });
  } catch (e) {
    next(e);
  }
});

// ================================
// REPORT (admin)
// ================================
app.get('/api/report', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const objectId = String(req.query.objectId || 'all');
    const itemCode = String(req.query.itemCode || '').trim();
    const type = String(req.query.type || 'all').trim();

    const fromTsNum = Number(req.query.fromTs || 0);
    const toTsNum = Number(req.query.toTs || Date.now());

    if (!Number.isFinite(fromTsNum) || !Number.isFinite(toTsNum)) {
      return res.status(400).json({ ok: false, error: 'bad-ts' });
    }

    const fromTs = BigInt(Math.max(0, Math.floor(fromTsNum)));
    const toTs = BigInt(Math.max(0, Math.floor(toTsNum)));

    const where = { ts: { gte: fromTs, lte: toTs } };
    if (objectId !== 'all') where.objectId = objectId;
    if (type === 'in' || type === 'out') where.type = type;
    if (itemCode) where.item = { code: itemCode };

    const ops = await prisma.operation.findMany({
      where,
      orderBy: { ts: 'desc' },
      take: 5000,
      include: {
        item: { select: { code: true, name: true } },
        object: { select: { name: true } }
      }
    });

    const rows = ops.map(op => ({
      ts: op.ts,
      time: op.time,
      objectId: op.objectId,
      objectName: op.object?.name || 'Объект',
      itemCode: op.item?.code || '',
      itemName: op.item?.name || '',
      type: op.type,
      qty: op.qty,
      from: op.from
    }));

    res.json({ ok: true, rows });
  } catch (e) {
    next(e);
  }
});

// ================================
// TRANSFERS
// ================================
app.post('/api/transfers', requireAuth, requireUser, async (req, res, next) => {
  try {
    const u = req.session.user;

    const toObjectId = String(req.body.toObjectId || '').trim();
    const itemId = String(req.body.itemId || '').trim();
    const qty = Number(req.body.qty);

    const damaged = !!req.body.damaged;
    const comment = String(req.body.comment || '').trim();
    const safeComment = comment ? comment.slice(0, 200) : null;

    if (!toObjectId || !itemId) return res.status(400).json({ ok: false, error: 'bad-request' });
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ ok: false, error: 'qty' });
    if (toObjectId === u.objectId) return res.status(400).json({ ok: false, error: 'same-object' });

    const { ts, time } = nowMeta();

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id: itemId } });
      if (!item) return { err: { status: 404, error: 'not-found' } };
      if (item.objectId !== u.objectId) return { err: { status: 403, error: 'forbidden' } };

      const toObj = await tx.object.findUnique({ where: { id: toObjectId } });
      if (!toObj) return { err: { status: 404, error: 'to-object-not-found' } };

      const pendingAgg = await tx.transfer.aggregate({
        where: { fromObjectId: u.objectId, code: item.code, status: 'PENDING' },
        _sum: { qty: true }
      });

      const reserved = Number(pendingAgg?._sum?.qty || 0);
      const available = item.quantity - reserved;
      if (available < qty) return { err: { status: 400, error: 'not-enough' } };

      const transfer = await tx.transfer.create({
        data: {
          code: item.code,
          name: item.name,
          unit: item.unit,
          qty,
          status: 'PENDING',
          createdById: u.id,
          fromObjectId: u.objectId,
          toObjectId,
          ts,
          time,
          damaged,
          comment: safeComment
        }
      });

      return { transfer };
    });

    if (result?.err) return res.status(result.err.status).json({ ok: false, error: result.err.error });

    res.json({ ok: true, transfer: result.transfer });

    // PUSH получателю
    try {
      const toObj = await prisma.object.findUnique({ where: { id: result.transfer.toObjectId } });
      await sendPushToObject(result.transfer.toObjectId, {
        title: '📥 Новая передача',
        body: `${result.transfer.name} ×${result.transfer.qty} (получатель: ${toObj?.name || ''})`,
        tag: `tr-${result.transfer.id}`,
        data: { url: '/', kind: 'transfer-created', transferId: result.transfer.id }
      });
    } catch {}
  } catch (e) {
    next(e);
  }
});

app.get('/api/transfers/incoming', requireAuth, requireUser, async (req, res, next) => {
  try {
    const u = req.session.user;

    const transfers = await prisma.transfer.findMany({
      where: { toObjectId: u.objectId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { fromObject: true }
    });

    res.json({
      ok: true,
      transfers: transfers.map(t => ({
        id: t.id,
        code: t.code,
        name: t.name,
        qty: t.qty,
        time: t.time,
        ts: t.ts,
        fromObjectId: t.fromObjectId,
        fromObjectName: t.fromObject?.name || '',
        damaged: t.damaged,
        comment: t.comment
      }))
    });
  } catch (e) {
    next(e);
  }
});

app.get('/api/transfers/outgoing', requireAuth, requireUser, async (req, res, next) => {
  try {
    const u = req.session.user;

    const transfers = await prisma.transfer.findMany({
      where: { fromObjectId: u.objectId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { toObject: true }
    });

    res.json({
      ok: true,
      transfers: transfers.map(t => ({
        id: t.id,
        code: t.code,
        name: t.name,
        qty: t.qty,
        time: t.time,
        ts: t.ts,
        toObjectId: t.toObjectId,
        toObjectName: t.toObject?.name || '',
        damaged: t.damaged,
        comment: t.comment
      }))
    });
  } catch (e) {
    next(e);
  }
});

app.get('/api/transfers/updates', requireAuth, requireUser, async (req, res, next) => {
  try {
    const u = req.session.user;

    const sinceTsNum = Number(req.query.sinceTs || 0);
    if (!Number.isFinite(sinceTsNum)) return res.status(400).json({ ok: false, error: 'bad-ts' });

    const sinceTs = BigInt(Math.max(0, Math.floor(sinceTsNum)));

    const transfers = await prisma.transfer.findMany({
      where: {
        fromObjectId: u.objectId,
        status: { in: ['ACCEPTED', 'REJECTED'] },
        actedTs: { gt: sinceTs }
      },
      orderBy: { actedTs: 'asc' },
      take: 200,
      include: { toObject: { select: { id: true, name: true } } }
    });

    res.json({
      ok: true,
      updates: transfers.map(t => ({
        id: t.id,
        code: t.code,
        name: t.name,
        qty: t.qty,
        status: t.status,
        actedTs: t.actedTs,
        actedTime: t.actedTime || '',
        toObjectId: t.toObjectId,
        toObjectName: t.toObject?.name || '',
        damaged: t.damaged === true,
        comment: t.comment || ''
      }))
    });
  } catch (e) {
    next(e);
  }
});

app.get('/api/transfers/:id', requireAuth, async (req, res, next) => {
  try {
    const u = req.session.user;
    const id = String(req.params.id);

    const tr = await prisma.transfer.findUnique({
      where: { id },
      include: {
        fromObject: { select: { id: true, name: true } },
        toObject: { select: { id: true, name: true } },
        createdBy: { select: { id: true, login: true } },
        actedBy: { select: { id: true, login: true } }
      }
    });

    if (!tr) return res.status(404).json({ ok: false, error: 'not-found' });

    if (u.role !== 'admin') {
      if (tr.fromObjectId !== u.objectId && tr.toObjectId !== u.objectId) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }
    }

    res.json({
      ok: true,
      transfer: {
        id: tr.id,
        code: tr.code,
        name: tr.name,
        qty: tr.qty,
        status: tr.status,
        ts: tr.ts,
        time: tr.time,
        damaged: tr.damaged === true,
        comment: tr.comment || '',
        fromObjectId: tr.fromObjectId,
        fromObjectName: tr.fromObject?.name || '',
        toObjectId: tr.toObjectId,
        toObjectName: tr.toObject?.name || '',
        createdByLogin: tr.createdBy?.login || '',
        actedByLogin: tr.actedBy?.login || '',
        actedTime: tr.actedTime || ''
      }
    });
  } catch (e) {
    next(e);
  }
});

app.post('/api/transfers/:id/accept', requireAuth, requireUser, async (req, res, next) => {
  try {
    const u = req.session.user;
    const id = String(req.params.id);

    const actedAt = new Date();
    const { ts: actedTs, time: actedTime } = nowMeta();

    const result = await prisma.$transaction(async (tx) => {
      const tr = await tx.transfer.findUnique({ where: { id } });
      if (!tr) return { err: { status: 404, error: 'not-found' } };
      if (tr.toObjectId !== u.objectId) return { err: { status: 403, error: 'forbidden' } };
      if (tr.status !== 'PENDING') return { err: { status: 400, error: 'bad-status' } };

      const fromObj = await tx.object.findUnique({ where: { id: tr.fromObjectId } });
      const toObj   = await tx.object.findUnique({ where: { id: tr.toObjectId } });

      const senderItem = await tx.item.findUnique({
        where: { objectId_code: { objectId: tr.fromObjectId, code: tr.code } }
      });
      if (!senderItem) return { err: { status: 400, error: 'sender-item-missing' } };
      if (senderItem.quantity < tr.qty) return { err: { status: 400, error: 'sender-not-enough' } };

      const newSenderQty = senderItem.quantity - tr.qty;

await tx.item.update({
  where: { id: senderItem.id },
  data: {
    quantity: newSenderQty,
    active: newSenderQty > 0
  }
});

      await tx.operation.create({
        data: {
          type: 'out',
          qty: tr.qty,
          from: `Передача → ${toObj?.name || 'Склад'}`,
          ts: actedTs,
          time: actedTime,
          objectId: tr.fromObjectId,
          itemId: senderItem.id,
          userId: tr.createdById,
          transferId: tr.id
        }
      });

      const receiverItem = await tx.item.upsert({
        where: { objectId_code: { objectId: tr.toObjectId, code: tr.code } },
        update: { name: tr.name, quantity: { increment: tr.qty }, active: true },
        create: { objectId: tr.toObjectId, code: tr.code, name: tr.name, unit: tr.unit || null, quantity: tr.qty, active: true }
      });

      await tx.operation.create({
        data: {
          type: 'in',
          qty: tr.qty,
          from: `Передача ← ${fromObj?.name || 'Склад'}`,
          ts: actedTs,
          time: actedTime,
          objectId: tr.toObjectId,
          itemId: receiverItem.id,
          userId: u.id,
          transferId: tr.id
        }
      });

      const updated = await tx.transfer.update({
        where: { id },
        data: { status: 'ACCEPTED', actedById: u.id, actedAt, actedTs, actedTime }
      });

      return { transfer: updated };
    });

    if (result?.err) return res.status(result.err.status).json({ ok: false, error: result.err.error });

    res.json({ ok: true, transfer: result.transfer });

    // PUSH отправителю
    try {
      const t = result.transfer;
      const toObj = await prisma.object.findUnique({ where: { id: t.toObjectId } });
      await sendPushToObject(t.fromObjectId, {
        title: '✅ Передача принята',
        body: `${toObj?.name || 'Склад'} принял: ${t.name} ×${t.qty}`,
        tag: `tr-${t.id}`,
        data: { url: '/', kind: 'transfer-accepted', transferId: t.id }
      });
    } catch {}
  } catch (e) {
    next(e);
  }
});

app.post('/api/transfers/:id/reject', requireAuth, requireUser, async (req, res, next) => {
  try {
    const u = req.session.user;
    const id = String(req.params.id);

    const actedAt = new Date();
    const { ts: actedTs, time: actedTime } = nowMeta();

    const result = await prisma.$transaction(async (tx) => {
      const tr = await tx.transfer.findUnique({ where: { id } });
      if (!tr) return { err: { status: 404, error: 'not-found' } };
      if (tr.toObjectId !== u.objectId) return { err: { status: 403, error: 'forbidden' } };
      if (tr.status !== 'PENDING') return { err: { status: 400, error: 'bad-status' } };

      const updated = await tx.transfer.update({
        where: { id },
        data: { status: 'REJECTED', actedById: u.id, actedAt, actedTs, actedTime }
      });

      return { transfer: updated };
    });

    if (result?.err) return res.status(result.err.status).json({ ok: false, error: result.err.error });

    res.json({ ok: true, transfer: result.transfer });

    // PUSH отправителю
    try {
      const t = result.transfer;
      const toObj = await prisma.object.findUnique({ where: { id: t.toObjectId } });
      await sendPushToObject(t.fromObjectId, {
        title: '⛔ Передача отклонена',
        body: `${toObj?.name || 'Склад'} отказался принять: ${t.name} ×${t.qty}. Баланс не изменился.`,
        tag: `tr-${t.id}`,
        data: { url: '/', kind: 'transfer-rejected', transferId: t.id }
      });
    } catch {}
  } catch (e) {
    next(e);
  }
});

// Главная (на всякий, хотя static уже отдаёт index.html)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ================================
// Error handler
// ================================
app.use((err, req, res, next) => {
  console.error('UNHANDLED ERROR:', {
    message: err?.message,
    code: err?.code,
    meta: err?.meta,
    stack: err?.stack
  });

  if (res.headersSent) return next(err);

  res.status(500).json({
    ok: false,
    error: 'server',
    code: err?.code || null
  });
});

process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
process.on('uncaughtException', (e) => console.error('uncaughtException', e));

process.on('SIGTERM', async () => {
  try { await prisma.$disconnect(); } catch {}
  try { await pool.end(); } catch {}
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`✅ Server started on port ${PORT}`));