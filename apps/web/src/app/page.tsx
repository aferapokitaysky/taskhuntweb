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
import { CheckCircleIcon } from '@/components/icons/CheckCircleIcon';
import { WalletIcon } from '@/components/icons/WalletIcon';
import { EmptySearchIcon } from '@/components/icons/illustrated/EmptySearchIcon';
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
    title: 'Разместите заказ',
    description: 'Опишите задачу и бюджет — сумма резервируется на вашем балансе, ещё не переведена никому.',
  },
  {
    icon: <MatchIcon className={STEP_ICON_SIZE} />,
    title: 'Выберите отклик',
    description: 'Фрилансер откликается, вы обсуждаете детали в чате и принимаете — бюджет уходит в эскроу.',
  },
  {
    icon: <CheckCircleIcon className={STEP_ICON_SIZE} />,
    title: 'Примите работу',
    description: 'Сдача по вехам — принимаете каждую по мере готовности, а не весь заказ разом в конце.',
  },
  {
    icon: <WalletIcon className={STEP_ICON_SIZE} />,
    title: 'Средства освобождаются',
    description: 'Эскроу переходит фрилансеру сразу после приёмки — комиссия фиксирована и видна заранее.',
  },
];

export default async function HomePage() {
  const [stats, openOrders, categories] = await Promise.all([fetchStats(), fetchOpenOrders(), fetchCategories()]);
  const topCategories = categories.slice(0, 8);

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
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center gap-20 px-4 py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="flex flex-col items-center gap-6">
        <h1 className="sr-only">TaskHunt</h1>
        <div className="animate-float">
          <Logo withWordmark className="h-20" />
        </div>
        <p className="max-w-lg text-stone-600">
          Крипто-эскроу вместо доверия на слово: бюджет заказчика заморожен в системе с первого отклика — вывод в
          крипте, без банковских очередей и заморозки на карте.
        </p>
        <div className="flex gap-4">
          <Link href="/register" className="rounded-full bg-brand px-6 py-3 font-medium text-white transition hover:bg-brand-dark">
            Начать
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-stone-300 px-6 py-3 font-medium text-stone-800 transition hover:bg-white dark:hover:bg-stone-800"
          >
            Войти
          </Link>
        </div>
        {stats && (
          <p className="text-sm text-stone-400">
            {stats.totalOrders}+ заказов · {stats.totalFreelancers}+ фрилансеров
            {Number(stats.totalEscrowVolume) > 0 && ` · ${money(stats.totalEscrowVolume)} прошло через эскроу`}
          </p>
        )}
      </section>

      <section className="w-full">
        <h2 className="mb-8 font-serif text-2xl text-stone-900">Как работает эскроу</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ESCROW_STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card-sand text-stone-900">
                {step.icon}
              </div>
              <p className="text-xs font-semibold text-brand">Шаг {i + 1}</p>
              <h3 className="font-semibold text-stone-900">{step.title}</h3>
              <p className="text-sm text-stone-600">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="w-full">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="font-serif text-2xl text-stone-900">Открытые заказы прямо сейчас</h2>
          <Link href="/login" className="text-sm font-medium text-brand hover:underline">
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
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-card-sand/60 px-6 py-12">
            <EmptySearchIcon />
            <p className="text-stone-600">Заказов пока нет — станьте первым, кто разместит.</p>
          </div>
        )}
      </section>

      {topCategories.length > 0 && (
        <section className="w-full">
          <h2 className="mb-8 font-serif text-2xl text-stone-900">Популярные категории</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {topCategories.map((category) => (
              <Link
                key={category.id}
                href={`/categories`}
                className="flex flex-col items-center gap-2 rounded-2xl border border-stone-100 bg-white p-4 text-center transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md dark:border-stone-800 dark:bg-stone-900"
              >
                <CategoryIcon slug={category.slug} className="h-8 w-8" />
                <span className="text-sm font-medium text-stone-900">{category.name}</span>
                {typeof category.orderCount === 'number' && (
                  <span className="text-xs text-stone-400">{category.orderCount} заказов</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="grid w-full grid-cols-2 gap-4 text-left sm:grid-cols-3">
        <IllustratedCard
          color="lavender"
          icon={<MatchIcon />}
          title="Точный подбор"
          description="Совместимость фрилансера с заказом считается по навыкам, рейтингу и истории сделок — не просто по дате отклика."
        />
        <IllustratedCard
          color="sand"
          icon={<BuildIcon />}
          title="Разместите заказ"
          description="Опишите задачу, укажите бюджет и стек — отклики начнут приходить сразу."
        />
        <IllustratedCard
          color="sage"
          icon={<EscrowIcon />}
          title="Эскроу-защита"
          description="Оплата резервируется на платформе и переходит исполнителю только после приёмки работы."
        />
        <IllustratedCard
          color="rose"
          icon={<ChatIcon />}
          title="Прямой чат"
          description="Обсудите детали с любым откликнувшимся до того, как примете решение — не только с выбранным исполнителем."
        />
        <IllustratedCard
          color="olive"
          icon={<CodeIcon />}
          title="Для разработчиков"
          description="Заказы с реальным стеком и понятной сложностью, без размытых формулировок."
        />
      </section>

      <footer className="flex gap-4 text-xs text-stone-400">
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
    </main>
  );
}
