import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { IllustratedCard } from '@/components/IllustratedCard';
import { OrderCard } from '@/components/OrderCard';
import { CategoryIcon } from '@/components/CategoryIcon';
import { MatchIcon } from '@/components/icons/illustrated/MatchIcon';
import { EscrowIcon } from '@/components/icons/illustrated/EscrowIcon';
import { BuildIcon } from '@/components/icons/illustrated/BuildIcon';
import { ChatIcon } from '@/components/icons/illustrated/ChatIcon';
import { CodeIcon } from '@/components/icons/illustrated/CodeIcon';
import { ClientIcon } from '@/components/icons/illustrated/ClientIcon';
import { FreelancerIcon } from '@/components/icons/illustrated/FreelancerIcon';
import { CheckCircleIcon } from '@/components/icons/CheckCircleIcon';
import { BalanceEscrowIcon } from '@/components/icons/illustrated/BalanceEscrowIcon';
import { EmptySearchIcon } from '@/components/icons/illustrated/EmptySearchIcon';
import { SearchIcon } from '@/components/icons/SearchIcon';
import type { Category, Order, PaginatedOrders } from '@/lib/types';
import { money } from '@/lib/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

interface PublicStats {
  totalOrders: number;
  totalFreelancers: number;
  totalEscrowVolume: string;
}

async function fetchStats(): Promise<PublicStats | null> {
  try {
    const res = await fetch(`${API_URL}/public/stats`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchOpenOrders(): Promise<Order[]> {
  try {
    const res = await fetch(`${API_URL}/orders?status=OPEN&limit=6`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const page: PaginatedOrders = await res.json();
    return page.items;
  } catch {
    return [];
  }
}

async function fetchCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${API_URL}/categories`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

const STEP_ICON_SIZE = 'h-7 w-7';

const ESCROW_STEPS = [
  {
    icon: <BuildIcon className={STEP_ICON_SIZE} />,
    title: 'Публикация',
    description: 'Заказчик описывает задачу, бюджет, сроки и теги. Исполнители сразу видят понятный бриф.',
  },
  {
    icon: <MatchIcon className={STEP_ICON_SIZE} />,
    title: 'Подбор',
    description: 'Отклики ранжируются по навыкам, рейтингу, истории сделок и совпадению с задачей.',
  },
  {
    icon: <ChatIcon className={STEP_ICON_SIZE} />,
    title: 'Договорённость',
    description: 'Детали, файлы, инвойсы и этапы остаются в чате заказа, а не теряются в мессенджерах.',
  },
  {
    icon: <BalanceEscrowIcon className={STEP_ICON_SIZE} />,
    title: 'Оплата',
    description: 'Деньги резервируются в эскроу и освобождаются после приёмки работы или решения спора.',
  },
];

const QUICK_SEARCHES = ['React', 'дизайн', 'лендинг', 'бот', 'SEO', 'логотип', 'перевод', 'ремонт'];

export default async function HomePage() {
  const [stats, openOrders, categories] = await Promise.all([fetchStats(), fetchOpenOrders(), fetchCategories()]);
  const topCategories = categories.slice(0, 8);
  const visibleStats = {
    totalOrders: stats?.totalOrders ?? openOrders.length,
    totalFreelancers: stats?.totalFreelancers ?? 0,
    totalEscrowVolume: stats?.totalEscrowVolume ?? '0',
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'TuskHunt',
        url: WEB_URL,
        logo: `${WEB_URL}/logo-full.png`,
      },
      {
        '@type': 'WebSite',
        name: 'TuskHunt',
        url: WEB_URL,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${WEB_URL}/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-card-sand/50 via-stone-50 to-white text-stone-900">
      {/* eslint-disable-next-line @next/next/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5">
        <Link href="/" className="shrink-0 transition-transform hover:scale-105">
          <Logo withWordmark className="h-12" />
        </Link>
        <nav className="hidden items-center gap-1 text-sm font-medium text-stone-600 md:flex">
          <Link href="/categories" className="rounded-full px-3 py-2 hover:bg-white">
            Категории
          </Link>
          <Link href="/freelancers" className="rounded-full px-3 py-2 hover:bg-white">
            Фрилансеры
          </Link>
          <Link href="/pricing" className="rounded-full px-3 py-2 hover:bg-white">
            Тарифы
          </Link>
          <Link href="/support" className="rounded-full px-3 py-2 hover:bg-white">
            Поддержка
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-stone-700 hover:bg-white">
            Войти
          </Link>
          <Link href="/register" className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            Разместить заказ
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-8 lg:grid-cols-[minmax(0,1.1fr)_420px] lg:items-center">
        <div>
          <p className="mb-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-medium text-brand shadow-sm">
            Фриланс-биржа с защищённой оплатой через крипто-эскроу
          </p>
          <h1 className="max-w-3xl font-serif text-4xl leading-tight text-stone-950 sm:text-5xl lg:text-6xl">
            Найдите исполнителя или заказ без хаоса в переписках
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-600">
            Поиск как на больших job-платформах, но под проектную работу: отклики, чат, инвойсы, этапы и эскроу
            собраны в одном рабочем пространстве.
          </p>

          <form action="/search" method="GET" className="premium-panel mt-8 rounded-3xl p-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
              <label className="flex min-w-0 items-center gap-3 rounded-2xl border border-stone-200 px-4 py-3">
                <SearchIcon className="h-5 w-5 shrink-0 text-stone-400" />
                <input
                  name="q"
                  placeholder="Дизайн сайта, React, SMM, перевод..."
                  className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-stone-400"
                />
              </label>
              <select name="type" className="field-surface px-4 py-3 text-stone-700">
                <option value="all">Везде</option>
                <option value="orders">Заказы</option>
                <option value="freelancers">Фрилансеры</option>
              </select>
              <button type="submit" className="primary-action px-6 py-3">
                Найти
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 px-1">
              {QUICK_SEARCHES.map((query) => (
                <Link
                  key={query}
                  href={`/search?q=${encodeURIComponent(query)}`}
                  className="rounded-full bg-stone-100 px-3 py-1.5 text-sm text-stone-600 hover:bg-card-sand hover:text-stone-900"
                >
                  {query}
                </Link>
              ))}
            </div>
          </form>

          <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
            <div className="interactive-card rounded-2xl bg-white/80 p-4 shadow-sm">
              <p className="text-2xl font-semibold">{visibleStats.totalOrders}+</p>
              <p className="text-sm text-stone-500">заказов в системе</p>
            </div>
            <div className="interactive-card rounded-2xl bg-white/80 p-4 shadow-sm">
              <p className="text-2xl font-semibold">{visibleStats.totalFreelancers}+</p>
              <p className="text-sm text-stone-500">профилей специалистов</p>
            </div>
            <div className="interactive-card rounded-2xl bg-white/80 p-4 shadow-sm">
              <p className="text-2xl font-semibold">
                {Number(visibleStats.totalEscrowVolume) > 0 ? money(visibleStats.totalEscrowVolume) : '100%'}
              </p>
              <p className="text-sm text-stone-500">оплата через эскроу</p>
            </div>
          </div>
        </div>

        <aside className="rounded-[2rem] bg-white p-5 text-left shadow-xl shadow-stone-200/70">
          <p className="mb-4 text-sm font-semibold text-stone-500">Выберите свой сценарий</p>
          <div className="space-y-3">
            <Link href="/register?role=CLIENT" className="block rounded-3xl border border-stone-100 p-4 transition hover:border-brand/40 hover:bg-card-sand/30">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-card-sand">
                  <ClientIcon className="h-8 w-8" />
                </span>
                <div>
                  <h2 className="font-semibold">Мне нужен исполнитель</h2>
                  <p className="mt-1 text-sm text-stone-600">
                    Разместите заказ, сравните отклики, напишите кандидатам и платите только через защищённый инвойс.
                  </p>
                </div>
              </div>
            </Link>
            <Link href="/register?role=FREELANCER" className="block rounded-3xl border border-stone-100 p-4 transition hover:border-brand/40 hover:bg-card-sage/30">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-card-sage">
                  <FreelancerIcon className="h-8 w-8" />
                </span>
                <div>
                  <h2 className="font-semibold">Я ищу заказы</h2>
                  <p className="mt-1 text-sm text-stone-600">
                    Заполните профиль, получите рекомендации по совпадению навыков и откликайтесь в один рабочий поток.
                  </p>
                </div>
              </div>
            </Link>
          </div>
          <div className="mt-5 rounded-3xl bg-stone-950 p-4 text-white">
            <p className="text-sm font-semibold">Чем отличаемся от доски объявлений</p>
            <p className="mt-2 text-sm leading-6 text-stone-300">
              Деньги не уходят напрямую исполнителю: они резервируются, видны в статусах заказа и освобождаются после
              приёмки работы или решения спора.
            </p>
          </div>
        </aside>
      </section>

      <div className="mx-auto flex max-w-7xl flex-col gap-16 px-4 pb-16">
        {topCategories.length > 0 && (
          <section>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-brand">Категории</p>
                <h2 className="font-serif text-3xl text-stone-900">Быстрый вход в рынок</h2>
              </div>
              <Link href="/categories" className="text-sm font-medium text-brand hover:underline">
                Все категории →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {topCategories.map((category) => (
                <Link
                  key={category.id}
                  href={`/categories/${category.id}`}
                  className="group flex min-h-36 flex-col justify-between rounded-3xl border border-stone-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
                >
                  <CategoryIcon slug={category.slug} className="h-9 w-9" />
                  <div>
                    <span className="font-semibold text-stone-900 group-hover:text-brand">{category.name}</span>
                    <p className="mt-1 text-sm text-stone-500">
                      {typeof category.orderCount === 'number' ? `${category.orderCount} заказов` : 'Заказы и специалисты'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-brand">Вакансии по-фрилансерски</p>
              <h2 className="font-serif text-3xl text-stone-900">Открытые заказы прямо сейчас</h2>
            </div>
            <Link href="/search" className="text-sm font-medium text-brand hover:underline">
              Смотреть все →
            </Link>
          </div>
          {openOrders.length > 0 ? (
            <div className="grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
              {openOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-3xl bg-card-sand/60 px-6 py-12 text-center">
              <EmptySearchIcon />
              <p className="text-stone-600">Заказов пока нет — станьте первым, кто разместит.</p>
              <Link href="/register" className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark">
                Разместить заказ
              </Link>
            </div>
          )}
        </section>

        <section>
          <div className="mb-8 text-center">
            <p className="text-sm font-medium text-brand">Сделка без сюрпризов</p>
            <h2 className="font-serif text-3xl text-stone-900">Как работает эскроу</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ESCROW_STEPS.map((step, i) => (
              <div key={step.title} className="rounded-3xl bg-white p-5 text-left shadow-sm">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card-sand text-stone-900">
                  {step.icon}
                </div>
                <p className="mt-4 text-xs font-semibold text-brand">Шаг {i + 1}</p>
                <h3 className="mt-1 font-semibold text-stone-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-5">
          <IllustratedCard
            color="lavender"
            icon={<MatchIcon />}
            title="Точный подбор"
            description="Совместимость фрилансера с заказом считается по навыкам, рейтингу и истории сделок."
          />
          <IllustratedCard
            color="sand"
            icon={<BuildIcon />}
            title="Понятный заказ"
            description="Бюджет, сроки, теги, этапы и файлы собраны в одном месте."
          />
          <IllustratedCard
            color="sage"
            icon={<EscrowIcon />}
            title="Эскроу-защита"
            description="Оплата резервируется на платформе и переходит исполнителю после приёмки."
          />
          <IllustratedCard
            color="rose"
            icon={<ChatIcon />}
            title="Прямой чат"
            description="Обсуждение с откликнувшимися доступно до окончательного выбора."
          />
          <IllustratedCard
            color="olive"
            icon={<CodeIcon />}
            title="Работа для профи"
            description="Профиль, портфолио, отзывы, бейджи и рекомендации работают на доверие."
          />
        </section>

        <section className="rounded-[2rem] bg-stone-950 px-5 py-8 text-center text-white sm:px-10">
          <h2 className="font-serif text-3xl">Готовы попробовать без хаоса в мессенджерах?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-stone-300">
            Создайте профиль или заказ за несколько минут. Дальше система сама подскажет совпадения, уведомления и
            безопасный путь оплаты.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/register" className="rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark">
              Создать аккаунт
            </Link>
            <Link href="/search" className="rounded-full border border-white/20 px-6 py-3 font-semibold text-white hover:bg-white/10">
              Посмотреть рынок
            </Link>
          </div>
        </section>

        <footer className="flex flex-wrap justify-center gap-4 text-xs text-stone-400">
          <Link href="/pricing" className="hover:text-stone-600">
            Тарифы
          </Link>
          <Link href="/terms" className="hover:text-stone-600">
            Условия использования
          </Link>
          <Link href="/privacy" className="hover:text-stone-600">
            Конфиденциальность
          </Link>
          <Link href="/support" className="hover:text-stone-600">
            Поддержка
          </Link>
        </footer>
      </div>
    </main>
  );
}
