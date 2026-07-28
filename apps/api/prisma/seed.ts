import { PrismaClient } from '@prisma/client';
import { DEFAULT_STAFF_ROLES, PermissionCode } from '@taskhunt/shared-types';

const prisma = new PrismaClient();

const SYSTEM_ACCOUNT_EMAIL = 'system@taskhunt.internal';

async function main() {
  // 1. Системный аккаунт — контрагент для внешних движений денег (см. wallet/constants.ts)
  await prisma.user.upsert({
    where: { email: SYSTEM_ACCOUNT_EMAIL },
    update: {},
    create: {
      email: SYSTEM_ACCOUNT_EMAIL,
      primaryRole: 'CLIENT',
      status: 'ACTIVE',
      isStaff: true,
      profile: { create: { displayName: 'TaskHunt System' } },
      wallet: { create: {} },
    },
  });

  // 2. Permissions + Staff roles (granular RBAC)
  const allPermissionCodes = Object.values(PermissionCode);
  for (const code of allPermissionCodes) {
    await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
  }

  for (const [roleName, permissionCodes] of Object.entries(DEFAULT_STAFF_ROLES)) {
    const role = await prisma.staffRole.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    for (const code of permissionCodes) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { code } });
      await prisma.staffRolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  // 3. Commission rules (настраиваются позже из админки, тут — стартовые значения)
  await prisma.commissionRule.upsert({
    where: { type: 'MARKETPLACE_FEE' },
    update: {},
    create: { type: 'MARKETPLACE_FEE', percentage: 10 },
  });
  await prisma.commissionRule.upsert({
    where: { type: 'WITHDRAWAL_FEE' },
    update: {},
    create: { type: 'WITHDRAWAL_FEE', percentage: 1 },
  });
  await prisma.commissionRule.upsert({
    where: { type: 'REFERRAL_FEE' },
    update: {},
    create: { type: 'REFERRAL_FEE', percentage: 5 },
  });

  // 4. Базовые категории (дерево, мультиниша)
  const rootCategories: Record<string, string[]> = {
    'IT и разработка': ['Веб-разработка', 'Мобильная разработка', 'Боты и автоматизация', 'DevOps'],
    'Дизайн': ['UI/UX', 'Графический дизайн', '3D-моделирование'],
    'Тексты и переводы': ['Копирайтинг', 'Перевод', 'Редактура'],
    'Маркетинг': ['SEO', 'SMM', 'Реклама'],
    'Бытовые услуги': ['Ремонт техники', 'Клининг', 'Курьерские услуги'],
  };

  for (const [rootName, children] of Object.entries(rootCategories)) {
    const root = await prisma.category.upsert({
      where: { slug: slugify(rootName) },
      update: {},
      create: { name: rootName, slug: slugify(rootName) },
    });

    for (const childName of children) {
      await prisma.category.upsert({
        where: { slug: slugify(`${rootName}-${childName}`) },
        update: {},
        create: { name: childName, slug: slugify(`${rootName}-${childName}`), parentId: root.id },
      });
    }
  }

  // 5. Feature flags — по умолчанию выключено то, что ещё не реализовано (Phase 2/3)
  const flags = [
    { key: 'AI_FRAUD_SCORING', enabled: false },
    { key: 'REFERRALS', enabled: false },
    { key: 'MILESTONES', enabled: true },
    { key: 'TELEGRAM_NOTIFICATIONS', enabled: false },
    { key: 'WALLET', enabled: true },
  ];
  for (const flag of flags) {
    await prisma.featureFlag.upsert({ where: { key: flag.key }, update: {}, create: flag });
  }

  console.log('Seed completed.');
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
