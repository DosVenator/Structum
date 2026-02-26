const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const password = async (p) => bcrypt.hash(String(p), 10);

  // объекты
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

  // admin
  await prisma.user.upsert({
    where: { login: 'admin' },
    update: {},
    create: {
      login: 'admin',
      passwordHash: await password('admin'),
      role: 'admin',
      mustChangePassword: false,
    },
  });

  // users
  await prisma.user.upsert({
    where: { login: 'ivan' },
    update: { objectId: s1.id },
    create: {
      login: 'ivan',
      passwordHash: await password('1234'),
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
      passwordHash: await password('abcd'),
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