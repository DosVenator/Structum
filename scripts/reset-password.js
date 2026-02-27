// scripts/reset-password.js
// usage:
//   node scripts/reset-password.js <login> <newPassword> [--forceChange]
//
// examples:
//   node scripts/reset-password.js ivan 1234
//   node scripts/reset-password.js admin NewPass123 --forceChange

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

function cleanLogin(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, '');
}

async function main() {
  const loginArg = process.argv[2];
  const passArg = process.argv[3];
  const forceChange = process.argv.includes('--forceChange');

  const login = cleanLogin(loginArg);
  const newPassword = String(passArg || '');

  if (!login) {
    console.error('❌ login required');
    process.exit(1);
  }
  if (!newPassword || newPassword.length < 4) {
    console.error('❌ newPassword required (min 4 chars)');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { login } });
  if (!user) {
    console.error('❌ user not found:', login);
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { login },
    data: {
      passwordHash: hash,
      mustChangePassword: forceChange ? true : false,
      active: true
    }
  });

  console.log('✅ Password reset for:', login, 'forceChange:', forceChange);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });