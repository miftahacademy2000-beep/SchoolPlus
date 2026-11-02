import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  for (const id of ['01196048-c7ed-4d20-9580-2af64abfca05', 'e412a988-6f52-4451-b6a6-1ada98796cbc']) {
    const p = await prisma.profile.findUnique({ where: { id } });
    const roles = await prisma.userRole.findMany({ where: { userId: id } });
    console.log(`${id} | ${p?.email} | mustChangePassword=${p?.mustChangePassword}`);
    console.log('  roles:', roles.map((r) => `${r.role}(${r.schoolId})`).join(', '));
  }
}

main().catch((e) => console.error(e)).finally(() => prisma.$disconnect());