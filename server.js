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

// ---- request logger (видно, что именно отдаёт 500) ----
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => {
    console.log(`${res.statusCode} ${req.method} ${req.originalUrl} ${Date.now() - t0}ms`);
  });
  next();
});

// ---- STATIC FIRST (без сессий и без БД) ----
app.use(express.static(path.join(__dirname, 'public')));

// ---- Healthcheck (без БД) ----
app.get('/health', (req, res) => res.status(200).send('OK'));

// ---- parsers только для API ----
app.use('/api', express.json());
app.use('/api', express.urlencoded({ extended: true }));

// ---- sessions ТОЛЬКО для API ----
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

    // ВАЖНО: регенерируем сессию при логине (убирает странные состояния)
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
    // очищаем cookie с теми же опциями
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
app.post('/api/ops', requireAuth, async (req, res, next) => {
  try {
    const u = req.session.user;
    if (u.role !== 'user') return res.status(403).json({ ok: false, error: 'forbidden' });

    const code = String(req.body.code || '').replace(/\s+/g, '');
    const name = String(req.body.name || '').trim();
    const qty = Number(req.body.qty);
    const from = String(req.body.from || '—').trim();
    const type = String(req.body.type || '').trim(); // in|out

    if (!code || !name) return res.status(400).json({ ok: false, error: 'bad-request' });
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ ok: false, error: 'qty' });
    if (type !== 'in' && type !== 'out') return res.status(400).json({ ok: false, error: 'type' });

    const ts = BigInt(Date.now());
    const time = new Date().toLocaleString();

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
      include: {
        object: true,
        operations: true
      }
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

// Главная (на случай, если static не сработал)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- глобальный error handler ----
app.use((err, req, res, next) => {
  console.error('UNHANDLED ERROR:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, error: 'server' });
});

// ---- ловим падения процесса ----
process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
process.on('uncaughtException', (e) => console.error('uncaughtException', e));

// ---- graceful shutdown ----
process.on('SIGTERM', async () => {
  try { await prisma.$disconnect(); } catch {}
  try { await pool.end(); } catch {}
  process.exit(0);
});

// PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`✅ Server started on port ${PORT}`));