import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { OrderCard } from '@/components/OrderCard';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Mascot } from '@/components/Mascot';
import { MatchIcon } from '@/components/icons/illustrated/MatchIcon';
import { EscrowIcon } from '@/components/icons/illustrated/EscrowIcon';
import { BuildIcon } from '@/components/icons/illustrated/BuildIcon';
import { ChatIcon } from '@/components/icons/illustrated/ChatIcon';
import { CodeIcon } from '@/components/icons/illustrated/CodeIcon';
import { ClientIcon } from '@/components/icons/illustrated/ClientIcon';
import { FreelancerIcon } from '@/components/icons/illustrated/FreelancerIcon';
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

const QUICK_SEARCHES = ['React', 'дизайн', 'лендинг', 'SMM', 'бот', 'логотип', 'SEO', 'перевод'];

const DEAL_FLOW = [
  {
    icon: <BuildIcon className="h-7 w-7" />,
    title: 'Бриф без лишнего шума',
    description: 'Заказ собирает бюджет, сроки, файлы, теги и ожидания в одном месте.',
  },
  {
    icon: <MatchIcon className="h-7 w-7" />,
    title: 'Кандидаты с контекстом',
    description: 'Отклики, профиль, портфолио и совпадение навыков видны до первого сообщения.',
  },
  {
    icon: <ChatIcon className="h-7 w-7" />,
    title: 'Чат по конкретной задаче',
    description: 'Диалог, инвойсы, чеки и статусы живут рядом с заказом, а не в разрозненных вкладках.',
  },
  {
    icon: <BalanceEscrowIcon className="h-7 w-7" />,
    title: 'Эскроу до приёмки',
    description: 'Средства резервируются и двигаются по понятному сценарию: оплата, сдача, проверка, выплата.',
  },
];

const TRUST_ITEMS = [
  { icon: <EscrowIcon className="h-8 w-8" />, title: 'Финансы прозрачны', text: 'Баланс, эскроу, инвойсы, вывод и чеки разделены по статусам.' },
  { icon: <CodeIcon className="h-8 w-8" />, title: 'Профили работают на доверие', text: 'Навыки, портфолио, качество профиля и история заказов помогают выбрать быстрее.' },
  { icon: <ChatIcon className="h-8 w-8" />, title: 'Каждый диалог привязан к заказу', text: 'Заказчик видит, с кем говорит, по какой задаче и какой следующий шаг нужен.' },
];

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
        name: 'TaskHunt',
        url: WEB_URL,
        logo: `${WEB_URL}/logo-full.png`,
      },
      {
        '@type': 'WebSite',
        name: 'TaskHunt',
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
    <main className="marketing-page min-h-screen overflow-hidden bg-cream text-stone-900">
      {/* eslint-disable-next-line @next/next/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5">
        <Link href="/" className="shrink-0 transition-transform hover:scale-105">
          <Logo withWordmark className="h-12" />
        </Link>
        <nav className="hidden items-center gap-1 rounded-full border border-stone-100 bg-white/72 p-1 text-sm font-bold text-stone-600 shadow-sm backdrop-blur md:flex">
          <Link href="/categories" className="rounded-full px-3 py-2 hover:bg-card-sand hover:text-stone-950">
            Категории
          </Link>
          <Link href="/freelancers" className="rounded-full px-3 py-2 hover:bg-card-sage hover:text-stone-950">
            Фрилансеры
          </Link>
          <Link href="/pricing" className="rounded-full px-3 py-2 hover:bg-card-lavender hover:text-stone-950">
            Тарифы
          </Link>
          <Link href="/support" className="rounded-full px-3 py-2 hover:bg-card-rose hover:text-stone-950">
            Поддержка
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="secondary-action px-4 py-2 text-sm">
            Войти
          </Link>
          <Link href="/register?role=CLIENT" className="primary-action px-4 py-2 text-sm">
            Разместить заказ
          </Link>
        </div>
      </header>

      <section className="relative mx-auto max-w-7xl px-4 pb-10 pt-3 md:pb-14">
        <div className="relative overflow-hidden rounded-[2rem] border border-stone-100 bg-white/76 px-5 py-6 shadow-2xl shadow-stone-200/70 backdrop-blur md:px-8 md:py-8">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(41,37,36,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(41,37,36,0.04)_1px,transparent_1px)] bg-[size:34px_34px]" />
          <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1.05fr)_390px] lg:items-center">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Маркетплейс для проектной работы</p>
              <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight text-stone-950 sm:text-5xl lg:text-6xl">
                Найдите исполнителя и доведите заказ до оплаты в одном месте
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-stone-600">
                TaskHunt соединяет поиск, отклики, чат, инвойсы, статусы заказа и эскроу. Заказчик видит понятный процесс, исполнитель понимает условия до старта.
              </p>

              <form action="/search" method="GET" className="mt-7 rounded-[1.65rem] border border-stone-200 bg-white p-2 shadow-xl shadow-stone-200/70">
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_auto]">
                  <label className="flex min-w-0 items-center gap-3 rounded-[1.25rem] bg-stone-50 px-4 py-3">
                    <SearchIcon className="h-5 w-5 shrink-0 text-stone-400" />
                    <input
                      name="q"
                      placeholder="React, дизайн, лендинг, SMM..."
                      className="min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-stone-400"
                    />
                  </label>
                  <select name="type" className="field-surface px-4 py-3 text-sm font-bold text-stone-700">
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
                      className="rounded-full bg-card-sage/70 px-3 py-1.5 text-sm font-semibold text-stone-600 transition hover:bg-card-sand hover:text-stone-950"
                    >
                      {query}
                    </Link>
                  ))}
                </div>
              </form>
            </div>

            <div className="rounded-[1.8rem] border border-stone-100 bg-card-sand/70 p-4 shadow-xl shadow-stone-200/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Пример сделки</p>
                  <h2 className="mt-2 font-serif text-2xl text-stone-950">UI/UX витрина продукта</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-600">Заказ, отклики, чат и счёт видны в одном контуре.</p>
                </div>
                <Mascot name="shieldCheck" size="h-20 w-20" />
              </div>
              <div className="mt-5 grid gap-2">
                {[
                  ['Отклики', '3 кандидата', 'bg-white/80'],
                  ['Инвойс', '$820 к оплате', 'bg-card-sage/85'],
                  ['Статус', 'на согласовании', 'bg-white/80'],
                ].map(([label, value, tone]) => (
                  <div key={label} className={`flex items-center justify-between gap-3 rounded-[1.15rem] px-3 py-2.5 ${tone}`}>
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-stone-500">{label}</span>
                    <span className="text-sm font-bold text-stone-950">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-[1.35rem] bg-white/80 p-3">
                <Mascot name="search" size="h-14 w-14" />
                <p className="text-sm leading-6 text-stone-600">Подбор и коммуникация начинаются с понятной задачи, а не с хаоса в личных сообщениях.</p>
              </div>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
            <div className="hero-stat p-4 text-center">
              <p className="font-serif text-3xl text-stone-950">{visibleStats.totalOrders}+</p>
              <p className="text-sm font-medium text-stone-500">заказов в системе</p>
            </div>
            <div className="hero-stat p-4 text-center">
              <p className="font-serif text-3xl text-stone-950">{visibleStats.totalFreelancers}+</p>
              <p className="text-sm font-medium text-stone-500">профилей специалистов</p>
            </div>
            <div className="hero-stat p-4 text-center">
              <p className="font-serif text-3xl text-stone-950">
                {Number(visibleStats.totalEscrowVolume) > 0 ? money(visibleStats.totalEscrowVolume) : '100%'}
              </p>
              <p className="text-sm font-medium text-stone-500">сценарий защищённой оплаты</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-7xl flex-col gap-16 px-4 pb-16">
        <section className="grid gap-4 md:grid-cols-2">
          <Link href="/register?role=CLIENT" className="interactive-card group overflow-hidden rounded-[2rem] border border-stone-100 bg-card-sand/72 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Для заказчика</p>
                <h2 className="mt-2 font-serif text-3xl text-stone-950">Разместить задачу и выбрать исполнителя</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">
                  Создайте понятный бриф, сравните отклики, откройте чат с кандидатами и зафиксируйте оплату инвойсом.
                </p>
              </div>
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.7rem] bg-white/72">
                <ClientIcon className="h-14 w-14" />
              </span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-stone-600">
              {['Бриф', 'Отклики', 'Чат', 'Эскроу'].map((item) => (
                <span key={item} className="rounded-full bg-white/72 px-3 py-1.5">
                  {item}
                </span>
              ))}
            </div>
          </Link>

          <Link href="/register?role=FREELANCER" className="interactive-card group overflow-hidden rounded-[2rem] border border-stone-100 bg-card-sage/70 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Для фрилансера</p>
                <h2 className="mt-2 font-serif text-3xl text-stone-950">Собрать профиль и получать подходящие заказы</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600">
                  Покажите навыки, портфолио и условия работы. Система подскажет задачи, где ваш профиль выглядит сильнее.
                </p>
              </div>
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.7rem] bg-white/72">
                <FreelancerIcon className="h-14 w-14" />
              </span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-stone-600">
              {['Навыки', 'Портфолио', 'Рекомендации', 'Выплаты'].map((item) => (
                <span key={item} className="rounded-full bg-white/72 px-3 py-1.5">
                  {item}
                </span>
              ))}
            </div>
          </Link>
        </section>

        {topCategories.length > 0 && (
          <section>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-brand">Категории</p>
                <h2 className="font-serif text-3xl text-stone-950">Быстрый вход в рынок</h2>
              </div>
              <Link href="/categories" className="secondary-action px-4 py-2 text-sm">
                Все категории
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {topCategories.map((category, index) => (
                <Link
                  key={category.id}
                  href={`/categories/${category.id}`}
                  className={`interactive-card group flex min-h-36 flex-col justify-between rounded-[1.8rem] border border-stone-100 p-4 text-left shadow-sm ${
                    index % 4 === 0
                      ? 'bg-card-sand/75'
                      : index % 4 === 1
                        ? 'bg-white'
                        : index % 4 === 2
                          ? 'bg-card-lavender/65'
                          : 'bg-card-sage/65'
                  }`}
                >
                  <CategoryIcon slug={category.slug} className="h-10 w-10" />
                  <div>
                    <span className="break-words font-semibold text-stone-950 group-hover:text-brand">{category.name}</span>
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
              <p className="text-sm font-bold text-brand">Открытые задачи</p>
              <h2 className="font-serif text-3xl text-stone-950">Рынок, который уже можно открыть</h2>
            </div>
            <Link href="/search" className="secondary-action px-4 py-2 text-sm">
              Смотреть все
            </Link>
          </div>
          {openOrders.length > 0 ? (
            <div className="grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
              {openOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-[2rem] border border-stone-100 bg-card-sand/60 px-6 py-12 text-center shadow-sm">
              <EmptySearchIcon />
              <p className="text-stone-600">Заказов пока нет. Можно стать первым, кто запустит задачу.</p>
              <Link href="/register?role=CLIENT" className="primary-action px-5 py-2.5 text-sm">
                Разместить заказ
              </Link>
            </div>
          )}
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="workspace-hero p-6">
            <div className="relative">
              <p className="text-sm font-bold text-brand">Сделка по шагам</p>
              <h2 className="mt-2 font-serif text-4xl leading-tight text-stone-950">Не просто поиск, а полный рабочий процесс</h2>
              <p className="mt-4 text-sm leading-6 text-stone-600">
                TaskHunt закрывает путь от первого поиска до выплаты. Заказчик и исполнитель видят одинаковые статусы, документы и следующий шаг.
              </p>
              <Mascot name="qualityChecklist" size="mt-6 h-24 w-24" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {DEAL_FLOW.map((step, index) => (
              <div key={step.title} className="interactive-card rounded-[1.8rem] border border-stone-100 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-card-sand text-stone-900">{step.icon}</span>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-500">0{index + 1}</span>
                </div>
                <h3 className="mt-4 font-serif text-xl text-stone-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {TRUST_ITEMS.map((item) => (
            <div key={item.title} className="interactive-card rounded-[1.8rem] border border-stone-100 bg-white p-5 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-card-lavender">{item.icon}</div>
              <h3 className="mt-4 font-serif text-xl text-stone-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="relative overflow-hidden rounded-[2.2rem] border border-stone-100 bg-card-sage/65 px-5 py-8 text-center shadow-xl shadow-stone-200/60 sm:px-10">
          <Mascot name="thumbsup" size="mx-auto mb-3 h-20 w-20" />
          <h2 className="font-serif text-3xl text-stone-950">Готовы собрать сделку в одном месте?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-stone-600">
            Создайте профиль или заказ за несколько минут. Дальше TaskHunt подскажет совпадения, уведомления и безопасный путь оплаты.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/register" className="primary-action px-6 py-3">
              Создать аккаунт
            </Link>
            <Link href="/search" className="secondary-action px-6 py-3">
              Посмотреть рынок
            </Link>
          </div>
        </section>

        <footer className="flex flex-wrap justify-center gap-4 text-xs font-medium text-stone-400">
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
