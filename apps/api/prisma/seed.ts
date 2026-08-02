import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_STAFF_ROLES, PermissionCode } from '@taskhunt/shared-types';

const prisma = new PrismaClient();

const SYSTEM_ACCOUNT_EMAIL = 'system@taskhunt.internal';

const AUDIO_VIDEO_NICHES = [
  'Видеомонтаж (Premiere Pro / DaVinci Resolve)',
  'Цветокоррекция и грейдинг',
  '2D-анимация',
  '3D-анимация и рендеринг',
  'Моушн-дизайн (After Effects)',
  'Монтаж YouTube-роликов',
  'Монтаж Reels / TikTok / Shorts',
  'Монтаж рекламных видео',
  'Монтаж свадебного видео',
  'Монтаж корпоративных видео',
  'Создание видеообложек и превью',
  'Субтитры и транскрибация видео',
  'Озвучка рекламы',
  'Озвучка аудиокниг',
  'Дубляж и войсовер',
  'Сведение и мастеринг подкастов',
  'Запись и монтаж подкастов',
  'Звукорежиссура',
  'Сведение музыки (Mixing)',
  'Мастеринг треков',
  'Саунд-дизайн для игр',
  'Написание музыки на заказ',
  'Джинглы и аудиологотипы',
  'Настройка стриминга (OBS / vMix)',
  'Обработка звука для стримов',
  'Видеосъёмка на заказ',
  'Аэросъёмка (дроны)',
  'Продакшн рекламных роликов',
  'Создание обучающих видео (скринкасты)',
  'Анимация логотипа (Logo Reveal)',
  'Whiteboard-анимация',
  'Постпродакшн видео',
  'VFX и композитинг',
  'Ротоскопинг',
  'Аудио-реставрация и шумоподавление',
  'Караоке-минусовки',
  'Подбор и создание звуковых эффектов (SFX)',
];

const BUSINESS_NICHES = [
  'Составление бизнес-плана',
  'Финансовое моделирование',
  'Составление договоров',
  'Регистрация компаний и ИП',
  'Бухгалтерские услуги онлайн',
  'Налоговый консалтинг',
  'HR-консалтинг и подбор персонала',
  'Рекрутинг (Recruiting)',
  'Разработка HR-политик',
  'Executive-коучинг',
  'Бизнес-коучинг',
  'Управленческий консалтинг',
  'Стратегический консалтинг',
  'Оптимизация бизнес-процессов',
  'Разработка KPI и метрик',
  'Финансовый аудит',
  'Инвестиционный консалтинг',
  'Питч-дек для инвесторов (Pitch Deck)',
  'Составление резюме (Resume Writing)',
  'Подготовка к собеседованию (Career Coaching)',
  'Ведение переговоров',
  'Аналитика рынка (Market Research)',
  'Конкурентный анализ',
  'Внедрение CRM-систем',
  'Управление проектами (Project Management)',
  'Скрам-мастер на аутсорсе',
  'Виртуальный секретарь / офис-менеджер',
  'Транскрибация деловых встреч',
  'Составление презентаций',
  'Due Diligence консалтинг',
  'Консалтинг по грантам и субсидиям',
  'Бизнес-планирование стартапов',
  'Финансовый контроллинг',
];

const EDUCATION_NICHES = [
  'Репетитор английского языка',
  'Репетитор математики',
  'Репетитор программирования',
  'Подготовка к ЕГЭ / ЗНО',
  'Подготовка к IELTS / TOEFL',
  'Создание учебных программ (Curriculum Design)',
  'Разработка вебинаров',
  'Методическая разработка уроков',
  'Академическое письмо',
  'Помощь с дипломными и курсовыми',
  'Разработка тестов и квизов',
  'Онлайн-школа под ключ',
  'Наставничество (Mentorship)',
  'Разработка обучающих презентаций',
  'Создание образовательного контента',
  'Проверка домашних заданий',
  'Разработка курсов на LMS (Moodle / Teachable)',
  'Языковой обмен и разговорная практика',
  'Профориентация',
  'Развивающие занятия для детей',
  'Логопедические занятия онлайн',
];

const AUDIO_VIDEO_SKILLS = [
  'Adobe Premiere Pro',
  'DaVinci Resolve',
  'After Effects',
  'Final Cut Pro',
  'Adobe Audition',
  'Audacity',
  'Pro Tools',
  'Ableton Live',
  'FL Studio',
  'Logic Pro',
  'OBS Studio',
  'vMix',
  'Cinema 4D',
  'Nuke',
  'Color Grading',
  'Sound Design',
  'Foley',
  'ADR',
  'Video Editing',
  'Motion Graphics',
  '2D Animation',
  '3D Animation',
  'Rotoscoping',
  'VFX Compositing',
  'Voiceover',
  'Podcast Production',
  'Audio Mastering',
  'Music Production',
];

const BUSINESS_SKILLS = [
  'Financial Modeling',
  'Business Planning',
  'Excel',
  'Google Sheets',
  'PowerPoint',
  'Notion',
  'Asana',
  'Trello',
  'Jira',
  'Salesforce',
  'HubSpot CRM',
  'Contract Drafting',
  'Due Diligence',
  'Market Research',
  'Competitive Analysis',
  'KPI Design',
  'OKR Framework',
  'Pitch Deck Design',
  'Negotiation',
  'Recruiting',
  'HR Policy',
  'Payroll',
  'Bookkeeping',
  'QuickBooks',
  'Xero',
  'SAP',
  'Six Sigma',
  'Agile Coaching',
  'Scrum Master',
];

const EDUCATION_SKILLS = [
  'Curriculum Design',
  'Lesson Planning',
  'Moodle',
  'Teachable',
  'Google Classroom',
  'IELTS Preparation',
  'TOEFL Preparation',
  'ESL Teaching',
  'Academic Writing',
  'Tutoring',
  'Instructional Design',
  'E-learning Development',
  'Articulate Storyline',
  'Kahoot',
  'Quizlet',
];

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
    'Аудио и видео': ['Видеомонтаж', 'Моушн-дизайн', 'Озвучка и войсовер', 'Подкаст-продакшн'],
    'Бизнес и консалтинг': ['Виртуальный ассистент', 'Бизнес-консалтинг', 'Юридические консультации', 'Финансовый консалтинг'],
    'Обучение': ['Онлайн-репетиторство', 'Разработка курсов', 'Коучинг'],
  };

  const rootIds: Record<string, string> = {};
  for (const [rootName, children] of Object.entries(rootCategories)) {
    const root = await prisma.category.upsert({
      where: { slug: slugify(rootName) },
      update: {},
      create: { name: rootName, slug: slugify(rootName) },
    });
    rootIds[rootName] = root.id;

    for (const childName of children) {
      await prisma.category.upsert({
        where: { slug: slugify(`${rootName}-${childName}`) },
        update: {},
        create: { name: childName, slug: slugify(`${rootName}-${childName}`), parentId: root.id },
      });
    }
  }

  // 4b. Ниши — большой плоский список конкретных специализаций под каждым
  // корнем (в дополнение к 3-4 базовым выше), чтобы фрилансер мог указать не
  // просто "Видеомонтаж", а "Цветокоррекция и грейдинг". slugTag() отдельно
  // транслитерирует #/+ (иначе "C#"/"C++" схлопываются с "C" в один slug).
  async function seedNiches(rootName: string, names: string[]) {
    const rootId = rootIds[rootName];
    if (!rootId) return;
    const seen = new Set<string>();
    for (const name of names) {
      const slug = slugTag(name);
      if (seen.has(slug)) continue; // почти-дубли (регистр/пунктуация) — берём первое вхождение
      seen.add(slug);
      await prisma.category.upsert({ where: { slug }, update: {}, create: { name, slug, parentId: rootId } });
    }
    console.log(`Seeded ${seen.size} niches under "${rootName}".`);
  }

  await seedNiches('IT и разработка', readTagFile('it_niches_tags.txt'));
  await seedNiches('Аудио и видео', AUDIO_VIDEO_NICHES);
  await seedNiches('Бизнес и консалтинг', BUSINESS_NICHES);
  await seedNiches('Обучение', EDUCATION_NICHES);

  // 4c. Навыки — плоский список технологий/инструментов для поиска при
  // заполнении профиля (см. programming_skills_tags.txt в корне репо + ручные
  // списки под новые категории ниже).
  async function seedSkills(names: string[]) {
    const seen = new Set<string>();
    for (const name of names) {
      const slug = slugTag(name);
      if (seen.has(slug)) continue;
      seen.add(slug);
      await prisma.skill.upsert({ where: { slug }, update: {}, create: { name, slug } });
    }
    return seen.size;
  }

  const programmingSkillCount = await seedSkills(readTagFile('programming_skills_tags.txt'));
  const audioVideoSkillCount = await seedSkills(AUDIO_VIDEO_SKILLS);
  const businessSkillCount = await seedSkills(BUSINESS_SKILLS);
  const educationSkillCount = await seedSkills(EDUCATION_SKILLS);
  console.log(
    `Seeded skills: ${programmingSkillCount} programming, ${audioVideoSkillCount} audio/video, ${businessSkillCount} business, ${educationSkillCount} education.`,
  );

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

  // 6. Тиры подписки — цены/лимиты см. docs/MONETIZATION.md
  const tiers = [
    {
      name: 'STARTER' as const,
      priceUsd: 0,
      commissionPercent: 10,
      maxActiveBidsPerMonth: 10,
      maxActiveOrdersPerMonth: 5,
      freeBoostsPerMonth: 0,
      supportPriority: 'NORMAL' as const,
    },
    {
      name: 'PRO' as const,
      priceUsd: 12,
      commissionPercent: 7,
      maxActiveBidsPerMonth: 50,
      maxActiveOrdersPerMonth: 20,
      freeBoostsPerMonth: 1,
      supportPriority: 'HIGH' as const,
    },
    {
      name: 'PREMIUM' as const,
      priceUsd: 29.99,
      commissionPercent: 5,
      maxActiveBidsPerMonth: null,
      maxActiveOrdersPerMonth: null,
      freeBoostsPerMonth: 5,
      supportPriority: 'URGENT' as const,
    },
  ];
  for (const tier of tiers) {
    await prisma.subscriptionTier.upsert({ where: { name: tier.name }, update: tier, create: tier });
  }

  console.log('Seed completed.');
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

// slugify() схлопывает "C", "C#", "C++" в один и тот же "c" — # и + просто
// вырезаются как не-буквенно-цифровые. Для тегов (там реально встречаются
// такие имена) транслитерируем их в слова до общей slugify().
function slugTag(input: string): string {
  return slugify(input.replace(/#/g, ' sharp ').replace(/\+/g, ' plus '));
}

function readTagFile(fileName: string): string[] {
  const filePath = path.resolve(__dirname, '../../../', fileName);
  return fs
    .readFileSync(filePath, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
