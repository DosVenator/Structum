// scripts/deactivate-user.js
// usage:
//   node scripts/deactivate-user.js <login>

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function cleanLogin(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, '');
}

async function main() {
  const login = cleanLogin(process.argv[2]);
  if (!login) {
    console.error('❌ login required');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { login } });
  if (!user) {
    console.error('❌ user not found:', login);
    process.exit(1);
  }

  await prisma.user.update({ where: { login }, data: { active: false } });
  console.log('✅ deactivated:', login);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });