import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  const passwordHash = await bcrypt.hash('Admin@123', 12);
  const adminId = crypto.randomUUID();
  const now = new Date();

  const admin = await prisma.profile.create({
    data: {
      id: adminId,
      email: 'admin@schoolplus.com',
      fullName: 'System Administrator',
      passwordHash,
      mustChangePassword: true,
      preferredLanguage: 'en',
      createdAt: now,
    },
  });
  console.log('Admin profile:', admin.id);

  await prisma.userRole.create({
    data: {
      userId: admin.id,
      role: 'super_admin',
      schoolId: null,
      createdAt: now,
    },
  });
  console.log('Admin role assigned');

  const existingSchool = await prisma.school.findFirst({ where: { slug: 'demo-school' } });
  const school =
    existingSchool ??
    (await prisma.school.create({
      data: {
        name: 'Demo School',
        slug: 'demo-school',
        logoUrl: '',
        email: 'demo@schoolplus.com',
        status: 'active',
        plan: 'pro',
        createdBy: admin.id,
        brand_color: '#000000',
        department_type: 'General',
        is_enabled: true,
        currency: 'USD',
        createdAt: now,
      },
    }));
  console.log('Demo school:', school.id);

  const existingSchoolAdmin = await prisma.profile.findFirst({
    where: { email: 'principal@demoschool.com' },
  });
  const schoolAdminProfile =
    existingSchoolAdmin ??
    (await prisma.profile.create({
      data: {
        id: crypto.randomUUID(),
        email: 'principal@demoschool.com',
        fullName: 'School Principal',
        passwordHash,
        mustChangePassword: true,
        preferredLanguage: 'en',
        createdAt: now,
      },
    }));

  const schoolAdminRole = await prisma.userRole.findFirst({
    where: { userId: schoolAdminProfile.id, role: 'school_admin', schoolId: school.id },
  });
  if (!schoolAdminRole) {
    await prisma.userRole.create({
      data: {
        userId: schoolAdminProfile.id,
        role: 'school_admin',
        schoolId: school.id,
        createdAt: now,
      },
    });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: schoolAdminProfile.id, schoolId: school.id },
  });
  if (membership) {
    await prisma.membership.update({
      where: { id: membership.id },
      data: { isActive: true },
    });
  } else {
    await prisma.membership.create({
      data: {
        userId: schoolAdminProfile.id,
        schoolId: school.id,
        isActive: true,
        createdAt: now,
      },
    });
  }
  console.log('School admin created');

  const generalSettings = await prisma.platformSetting.findFirst({
    where: { key: 'general', updatedBy: admin.id },
  });
  if (!generalSettings) {
    await prisma.platformSetting.create({
      data: {
        key: 'general',
        value: JSON.stringify({ app_name: 'SchoolPlus', currency: 'USD' }),
        description: 'General platform settings',
        updatedBy: admin.id,
        createdAt: now,
      },
    });
  }

  console.log('Seed completed successfully.');
  console.log('Login credentials:');
  console.log('  Super Admin: admin@schoolplus.com / Admin@123');
  console.log('  School Admin: principal@demoschool.com / Admin@123');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
