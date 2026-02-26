// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function hashPassword(p) {
  return bcrypt.hash(String(p), 10);
}

async function main() {
  // 1) Склады
  const s1 = await prisma.object.upsert({
    where: { name: 'Склад 1' },
    update: { active: true },
    create: { name: 'Склад 1', active: true },
  });

  const s2 = await prisma.object.upsert({
    where: { name: 'Склад 2' },
    update: { active: true },
    create: { name: 'Склад 2', active: true },
  });

  // 2) Пароли (bcrypt)
  const adminHash = await hashPassword('admin');
  const ivanHash = await hashPassword('1234');
  const annaHash = await hashPassword('abcd');

  // 3) Пользователи (ВАЖНО: update тоже обновляет пароль!)
  await prisma.user.upsert({
    where: { login: 'admin' },
    update: {
      passwordHash: adminHash,
      role: 'admin',
      mustChangePassword: false,
      objectId: null,
    },
    create: {
      login: 'admin',
      passwordHash: adminHash,
      role: 'admin',
      mustChangePassword: false,
    },
  });

  await prisma.user.upsert({
    where: { login: 'ivan' },
    update: {
      passwordHash: ivanHash,
      role: 'user',
      objectId: s1.id,
      mustChangePassword: false,
    },
    create: {
      login: 'ivan',
      passwordHash: ivanHash,
      role: 'user',
      objectId: s1.id,
      mustChangePassword: false,
    },
  });

  await prisma.user.upsert({
    where: { login: 'anna' },
    update: {
      passwordHash: annaHash,
      role: 'user',
      objectId: s2.id,
      mustChangePassword: false,
    },
    create: {
      login: 'anna',
      passwordHash: annaHash,
      role: 'user',
      objectId: s2.id,
      mustChangePassword: false,
    },
  });

  console.log('✅ Seed done');
  console.log('Логины: admin/admin, ivan/1234, anna/abcd');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });