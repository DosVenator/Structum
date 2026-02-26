const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const app = express();
app.set('trust proxy', 1);

const prisma = new PrismaClient();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const SESSION_SECRET =
  process.env.SESSION_SECRET || process.env.JWT_SECRET || 'dev-secret-change-me';

// ---- request logger ----
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => {
    console.log(`${res.statusCode} ${req.method} ${req.originalUrl} ${Date.now() - t0}ms`);
  });
  next();
});

// ---- STATIC FIRST ----
app.use(express.static(path.join(__dirname, 'public')));

// ---- Healthcheck ----
app.get('/health', (req, res) => res.status(200).send('OK'));

// ---- parsers only for API ----
app.use('/api', express.json());
app.use('/api', express.urlencoded({ extended: true }));

// ---- sessions only for API ----
app.use(
  '/api',
  session({
    store: new pgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true
    }),
    name: 'inv.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 14
    }
  })
);

// --- helpers ---
function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}
function requireAdmin(req, res, next) {
  if (req.session?.user?.role !== 'admin')
    return res.status(403).json({ ok: false, error: 'forbidden' });
  next();
}
function requireUser(req, res, next) {
  if (req.session?.user?.role !== 'user')
    return res.status(403).json({ ok: false, error: 'forbidden' });
  next();
}
function nowMeta() {
  const ts = BigInt(Date.now());
  const time = new Date().toLocaleString();
  return { ts, time };
}

// --- AUTH ---
app.post('/api/login', async (req, res, next) => {
  try {
    const login = String(req.body.login || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();

    if (!login || !password) return res.status(400).json({ ok: false, error: 'bad-request' });

    const user = await prisma.user.findUnique({ where: { login } });
    if (!user) return res.status(401).json({ ok: false, error: 'invalid' });

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
  res.json({ ok: true, user: req.session?.user || null });
});

// --- OBJECTS ---
app.get('/api/objects', requireAuth, async (req, res, next) => {
  try {
    const objects = await prisma.object.findMany({ orderBy: { name: 'asc' } });
    res.json({ ok: true, objects });
  } catch (e) {
    next(e);
  }
});

// --- ITEMS ---
app.get('/api/items', requireAuth, async (req, res, next) => {
  try {
    const u = req.session.user;

    const requestedObjectId = String(req.query.objectId || 'all');
    const objectId = u.role === 'admin' ? requestedObjectId : u.objectId;

    const where = {};
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

app.get('/api/items/:id/history', requireAuth, async (req, res, next) => {
  try {
    const u = req.session.user;
    const id = String(req.params.id);

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        object: true,
        operations: { orderBy: { ts: 'desc' }, take: 200 }
      }
    });

    if (!item) return res.status(404).json({ ok: false, error: 'not-found' });

    if (u.role !== 'admin' && item.objectId !== u.objectId) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }

    const history = item.operations.map((op) => ({
      type: op.type,
      qty: op.qty,
      from: op.from,
      time: op.time,
      ts: op.ts.toString()
    }));

    res.json({ ok: true, history });
  } catch (e) {
    next(e);
  }
});

// --- OPERATIONS (приход/расход) ---
app.post('/api/ops', requireAuth, requireUser, async (req, res, next) => {
  try {
    const u = req.session.user;

    const code = String(req.body.code || '').replace(/\s+/g, '');
    const name = String(req.body.name || '').trim();
    const qty = Number(req.body.qty);
    const from = String(req.body.from || '—').trim();
    const type = String(req.body.type || '').trim(); // in|out

    if (!code || !name) return res.status(400).json({ ok: false, error: 'bad-request' });
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ ok: false, error: 'qty' });
    if (type !== 'in' && type !== 'out') return res.status(400).json({ ok: false, error: 'type' });

    const { ts, time } = nowMeta();

    const item = await prisma.item.upsert({
      where: { objectId_code: { objectId: u.objectId, code } },
      update: {},
      create: { objectId: u.objectId, code, name, quantity: 0 }
    });

    const newQty = type === 'in' ? item.quantity + qty : Math.max(0, item.quantity - qty);

    const updated = await prisma.item.update({
      where: { id: item.id },
      data: {
        name,
        quantity: newQty,
        operations: {
          create: {
            type,
            qty,
            from,
            ts,
            time,
            objectId: u.objectId,
            userId: u.id
          }
        }
      }
    });

    res.json({ ok: true, item: updated });
  } catch (e) {
    next(e);
  }
});

// --- REPORT ---
app.get('/api/report', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const objectId = String(req.query.objectId || 'all');
    const fromTs = BigInt(Number(req.query.fromTs || 0));
    const toTs = BigInt(Number(req.query.toTs || Date.now()));
    const itemCode = String(req.query.itemCode || '').trim();

    const whereItem = {};
    if (objectId !== 'all') whereItem.objectId = objectId;
    if (itemCode) whereItem.code = itemCode;

    const items = await prisma.item.findMany({
      where: whereItem,
      include: { object: true, operations: true }
    });

    const rows = [];
    for (const it of items) {
      for (const op of it.operations) {
        if (op.ts < fromTs || op.ts > toTs) continue;
        rows.push({
          ts: op.ts.toString(),
          time: op.time,
          objectId: it.objectId,
          objectName: it.object?.name || 'Объект',
          itemCode: it.code,
          itemName: it.name,
          type: op.type,
          qty: op.qty,
          from: op.from
        });
      }
    }

    rows.sort((a, b) => Number(b.ts) - Number(a.ts));
    res.json({ ok: true, rows });
  } catch (e) {
    next(e);
  }
});

/* ===========================
   TRANSFERS (под твой schema.prisma: enum TransferStatus + createdById/actedById)
   =========================== */

// создать передачу (user)
app.post('/api/transfers', requireAuth, requireUser, async (req, res, next) => {
  try {
    const u = req.session.user;

    const toObjectId = String(req.body.toObjectId || '').trim();
    const itemId = String(req.body.itemId || '').trim();
    const qty = Number(req.body.qty);

    if (!toObjectId || !itemId) return res.status(400).json({ ok: false, error: 'bad-request' });
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ ok: false, error: 'qty' });
    if (toObjectId === u.objectId) return res.status(400).json({ ok: false, error: 'same-object' });

    const { ts, time } = nowMeta();

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id: itemId } });
      if (!item) return { err: { status: 404, error: 'not-found' } };
      if (item.objectId !== u.objectId) return { err: { status: 403, error: 'forbidden' } };
      if (item.quantity < qty) return { err: { status: 400, error: 'not-enough' } };

      // списать у отправителя
      await tx.item.update({
        where: { id: item.id },
        data: { quantity: item.quantity - qty }
      });

      // операция out у отправителя
      await tx.operation.create({
        data: {
          type: 'out',
          qty,
          from: `Передача → ${toObjectId}`,
          ts,
          time,
          objectId: u.objectId,
          itemId: item.id,
          userId: u.id
        }
      });

      // создать transfer
      const transfer = await tx.transfer.create({
        data: {
          code: item.code,
          name: item.name,
          qty,
          status: 'PENDING',
          createdById: u.id,
          fromObjectId: u.objectId,
          toObjectId,
          ts,
          time
        }
      });

      return { transfer };
    });

    if (result?.err) return res.status(result.err.status).json({ ok: false, error: result.err.error });
    res.json({ ok: true, transfer: result.transfer });
  } catch (e) {
    next(e);
  }
});

// входящие pending (user)
app.get('/api/transfers/incoming', requireAuth, requireUser, async (req, res, next) => {
  try {
    const u = req.session.user;

    const transfers = await prisma.transfer.findMany({
      where: { toObjectId: u.objectId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    res.json({ ok: true, transfers });
  } catch (e) {
    next(e);
  }
});

// исходящие (user)
app.get('/api/transfers/outgoing', requireAuth, requireUser, async (req, res, next) => {
  try {
    const u = req.session.user;

    const transfers = await prisma.transfer.findMany({
      where: { fromObjectId: u.objectId },
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    res.json({ ok: true, transfers });
  } catch (e) {
    next(e);
  }
});

// принять (user — получатель)
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

      // upsert item у получателя
      const item = await tx.item.upsert({
        where: { objectId_code: { objectId: tr.toObjectId, code: tr.code } },
        update: { name: tr.name, quantity: { increment: tr.qty } },
        create: { objectId: tr.toObjectId, code: tr.code, name: tr.name, quantity: tr.qty }
      });

      // операция in у получателя
      await tx.operation.create({
        data: {
          type: 'in',
          qty: tr.qty,
          from: `Передача ← ${tr.fromObjectId}`,
          ts: actedTs,
          time: actedTime,
          objectId: tr.toObjectId,
          itemId: item.id,
          userId: u.id
        }
      });

      const updated = await tx.transfer.update({
        where: { id },
        data: {
          status: 'ACCEPTED',
          actedById: u.id,
          actedAt,
          actedTs,
          actedTime
        }
      });

      return { transfer: updated };
    });

    if (result?.err) return res.status(result.err.status).json({ ok: false, error: result.err.error });
    res.json({ ok: true, transfer: result.transfer });
  } catch (e) {
    next(e);
  }
});

// отклонить (user — получатель) -> вернуть отправителю
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

      // вернуть qty отправителю
      const fromItem = await tx.item.upsert({
        where: { objectId_code: { objectId: tr.fromObjectId, code: tr.code } },
        update: { name: tr.name, quantity: { increment: tr.qty } },
        create: { objectId: tr.fromObjectId, code: tr.code, name: tr.name, quantity: tr.qty }
      });

      await tx.operation.create({
        data: {
          type: 'in',
          qty: tr.qty,
          from: `Возврат (отклонено) ← ${tr.toObjectId}`,
          ts: actedTs,
          time: actedTime,
          objectId: tr.fromObjectId,
          itemId: fromItem.id,
          userId: u.id
        }
      });

      const updated = await tx.transfer.update({
        where: { id },
        data: {
          status: 'REJECTED',
          actedById: u.id,
          actedAt,
          actedTs,
          actedTime
        }
      });

      return { transfer: updated };
    });

    if (result?.err) return res.status(result.err.status).json({ ok: false, error: result.err.error });
    res.json({ ok: true, transfer: result.transfer });
  } catch (e) {
    next(e);
  }
});

// Главная (fallback)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- error handler ----
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