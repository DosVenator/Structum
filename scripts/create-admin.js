// scripts/create-admin.js
// usage:
//   node scripts/create-admin.js <login> <password>
//
// example:
//   node scripts/create-admin.js owneradmin S3cur3Pass

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

function cleanLogin(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, '');
}

async function main() {
  const loginArg = process.argv[2];
  const passArg = process.argv[3];

  const login = cleanLogin(loginArg);
  const password = String(passArg || '');

  if (!login) {
    console.error('❌ login required');
    process.exit(1);
  }
  if (!password || password.length < 4) {
    console.error('❌ password required (min 4 chars)');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { login },
    update: {
      passwordHash: hash,
      role: 'admin',
      mustChangePassword: false,
      active: true,
      objectId: null
    },
    create: {
      login,
      passwordHash: hash,
      role: 'admin',
      mustChangePassword: false,
      active: true,
      objectId: null
    }
  });

  console.log('✅ Admin ready:', { id: user.id, login: user.login, role: user.role, active: user.active });
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });