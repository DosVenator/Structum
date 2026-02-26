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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'dev-secret-change-me';

app.use(
  session({
    store: new pgSession({
      pool,
      tableName: 'session'
    }),
    name: 'inv.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 14
    }
  })
);

// Static
app.use(express.static(path.join(__dirname, 'public')));

// Healthcheck
app.get('/health', (req, res) => res.status(200).send('OK'));

// --- helpers ---
function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ ok: false, error: 'unauthorized' });
  next();
}
function requireAdmin(req, res, next) {
  if (req.session?.user?.role !== 'admin') return res.status(403).json({ ok: false, error: 'forbidden' });
  next();
}

// --- AUTH ---
app.post('/api/login', async (req, res) => {
  try {
    const login = String(req.body.login || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();

    if (!login || !password) return res.status(400).json({ ok: false, error: 'bad-request' });

    const user = await prisma.user.findUnique({ where: { login } });
    if (!user) return res.status(401).json({ ok: false, error: 'invalid' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, error: 'invalid' });

    req.session.user = {
      id: user.id,
      login: user.login,
      role: user.role,
      objectId: user.objectId,
      mustChangePassword: user.mustChangePassword
    };

    res.json({ ok: true, user: req.session.user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'server' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('inv.sid');
    res.json({ ok: true });
  });
});

app.get('/api/me', (req, res) => {
  res.json({ ok: true, user: req.session?.user || null });
});

// --- OBJECTS ---
app.get('/api/objects', requireAuth, async (req, res) => {
  const objects = await prisma.object.findMany({ orderBy: { name: 'asc' } });
  res.json({ ok: true, objects });
});

// --- ITEMS ---
app.get('/api/items', requireAuth, async (req, res) => {
  const u = req.session.user;

  // admin может смотреть по objectId=all или конкретному
  const requestedObjectId = String(req.query.objectId || 'all');
  const objectId = u.role === 'admin' ? requestedObjectId : u.objectId;

  const where = {};
  if (objectId && objectId !== 'all') where.objectId = objectId;

  const items = await prisma.item.findMany({
    where,
    orderBy: { name: 'asc' }
  });

  res.json({ ok: true, items });
});

app.get('/api/items/:id/history', requireAuth, async (req, res) => {
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

  // user видит только свой склад
  if (u.role !== 'admin' && item.objectId !== u.objectId) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  const history = item.operations.map(op => ({
    type: op.type,
    qty: op.qty,
    from: op.from,
    time: op.time,
    ts: op.ts.toString()
  }));

  res.json({ ok: true, history });
});

// --- OPERATIONS (приход/расход) ---
app.post('/api/ops', requireAuth, async (req, res) => {
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

  // upsert item by (objectId+code)
  const item = await prisma.item.upsert({
    where: { objectId_code: { objectId: u.objectId, code } },
    update: {},
    create: { objectId: u.objectId, code, name, quantity: 0 }
  });

  const newQty = type === 'in'
    ? item.quantity + qty
    : Math.max(0, item.quantity - qty);

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
});

// --- REPORT ---
app.get('/api/report', requireAuth, requireAdmin, async (req, res) => {
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
});

// Главная
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`✅ Server started on port ${PORT}`));