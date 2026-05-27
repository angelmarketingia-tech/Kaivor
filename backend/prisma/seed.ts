import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Admin tenant + user
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'kaivor-admin' },
    update: {},
    create: {
      slug: 'kaivor-admin',
      name: 'KAIVOR Admin',
      plan: 'enterprise',
    },
  });
  console.log(`✅ Tenant: ${tenant.slug}`);

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set to seed the admin user');
  }
  const hashed = await bcrypt.hash(adminPassword, 10);

  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: adminEmail } },
    update: { password: hashed, role: 'platform_superadmin', isActive: true },
    create: {
      tenantId: tenant.id,
      email: adminEmail,
      name: 'Ángel Marketing',
      password: hashed,
      role: 'platform_superadmin',
      isActive: true,
    },
  });
  console.log(`✅ Admin user: ${user.email}`);

  // Main company
  const company = await prisma.company.upsert({
    where: { tenantId_taxId: { tenantId: tenant.id, taxId: '900000000-1' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'KAIVOR Systems S.A.S.',
      taxId: '900000000-1',
      address: 'Bogotá D.C.',
      phone: '+57 300 000 0000',
      email: adminEmail,
    },
  });
  console.log(`✅ Company: ${company.name}`);

  // Default subscription
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 12);

  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: { plan: 'ENTERPRISE', status: 'active' },
    create: {
      tenantId: tenant.id,
      plan: 'ENTERPRISE',
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });
  console.log(`✅ Subscription: ENTERPRISE`);

  // Demo Consumidor Final customer
  await prisma.customer.upsert({
    where: { tenantId_taxId: { tenantId: tenant.id, taxId: 'CF' } },
    update: {},
    create: {
      tenantId: tenant.id,
      companyId: company.id,
      name: 'Consumidor Final',
      taxId: 'CF',
      city: 'Bogotá',
    },
  });
  console.log(`✅ Consumidor Final customer`);

  console.log(`\n🎉 Seed completed. Login with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
