// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

function hash(p) {
  return crypto.createHash('sha256').update(String(p)).digest('hex');
}

async function main() {
  const s1 = await prisma.object.upsert({
    where: { name: 'Склад 1' },
    update: {},
    create: { name: 'Склад 1', active: true },
  });

  const s2 = await prisma.object.upsert({
    where: { name: 'Склад 2' },
    update: {},
    create: { name: 'Склад 2', active: true },
  });

  await prisma.user.upsert({
    where: { login: 'admin' },
    update: {},
    create: {
      login: 'admin',
      passwordHash: hash('admin'),
      role: 'admin',
      mustChangePassword: false,
    },
  });

  await prisma.user.upsert({
    where: { login: 'ivan' },
    update: { objectId: s1.id },
    create: {
      login: 'ivan',
      passwordHash: hash('1234'),
      role: 'user',
      objectId: s1.id,
      mustChangePassword: false,
    },
  });

  await prisma.user.upsert({
    where: { login: 'anna' },
    update: { objectId: s2.id },
    create: {
      login: 'anna',
      passwordHash: hash('abcd'),
      role: 'user',
      objectId: s2.id,
      mustChangePassword: false,
    },
  });

  console.log('✅ Seed done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });