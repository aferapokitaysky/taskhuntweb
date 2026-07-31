import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from './Logo';
import { Mascot } from './Mascot';
import { MatchIcon } from './icons/illustrated/MatchIcon';
import { BalanceEscrowIcon } from './icons/illustrated/BalanceEscrowIcon';
import { BalanceMainIcon } from './icons/illustrated/BalanceMainIcon';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  sideTitle?: string;
  sideDescription?: string;
}

const TRUST_POINTS = [
  { icon: <BalanceEscrowIcon className="h-6 w-6" />, label: 'Эскроу защищает бюджет до приёмки' },
  { icon: <MatchIcon className="h-6 w-6" />, label: 'Подбор по навыкам, рейтингу и истории' },
  { icon: <BalanceMainIcon className="h-6 w-6" />, label: 'Инвойсы, чат и выплаты в одном контуре' },
];

const ACTIVITY_ITEMS = [
  { label: 'Новый отклик', value: 'UI/UX заказ', tone: 'bg-card-lavender' },
  { label: 'Эскроу открыт', value: '$820', tone: 'bg-card-sage' },
  { label: 'Инвойс принят', value: '15 мин назад', tone: 'bg-card-sand' },
];

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  sideTitle = 'Работайте как на большой job-платформе, но с безопасной сделкой',
  sideDescription = 'TuskHunt соединяет поиск заказов, профили специалистов, чат, этапы, инвойсы и крипто-эскроу в одном спокойном рабочем процессе.',
}: AuthShellProps) {
  return (
    <main className="min-h-screen px-4 py-6">
      <div className="premium-panel mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[2rem] lg:grid-cols-[minmax(420px,1fr)_minmax(0,0.9fr)]">
        <section className="flex flex-col justify-center px-5 py-8 sm:px-10 lg:px-14">
          <Link href="/" className="mb-8 inline-flex w-fit transition-transform hover:scale-105 lg:hidden">
            <Logo className="h-10" />
          </Link>
          <div className="mb-8 reveal-in">
            <p className="text-sm font-semibold text-brand">{eyebrow}</p>
            <h1 className="mt-2 font-serif text-3xl leading-tight text-stone-950 sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-stone-600">{description}</p>
          </div>
          <div className="reveal-in rounded-3xl border border-stone-100 bg-cream-50 p-4 shadow-sm sm:p-6" style={{ animationDelay: '90ms' }}>
            {children}
          </div>
        </section>

        <aside className="edge-highlight relative hidden flex-col justify-between bg-stone-950 p-8 text-white lg:flex">
          <div className="motion-grid pointer-events-none absolute inset-0 opacity-45" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-stone-950 to-transparent" />
          <div className="relative z-10">
            <Link href="/" className="inline-flex rounded-2xl bg-white/95 p-3 transition-transform hover:scale-105">
              <Logo className="h-10" />
            </Link>
            <div className="mt-16 reveal-in">
              <div className="mb-4 flex items-center gap-3">
                <p className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-brand-light">
                  Безопасный фриланс-маркетплейс
                </p>
                <Mascot name="wave" size="h-14 w-14" />
              </div>
              <h2 className="max-w-md font-serif text-4xl leading-tight">{sideTitle}</h2>
              <p className="mt-5 max-w-md leading-7 text-stone-300">{sideDescription}</p>
            </div>
          </div>

          <div className="relative z-10">
            <div className="mb-6 grid grid-cols-3 gap-3">
              {ACTIVITY_ITEMS.map((item, index) => (
                <div
                  key={item.label}
                  className={`interactive-card rounded-2xl p-3 text-stone-900 ${item.tone}`}
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-600">{item.label}</p>
                  <p className="mt-1 truncate text-sm font-bold">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mb-6 grid gap-3">
              {TRUST_POINTS.map((point) => (
                <div key={point.label} className="interactive-card flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-stone-200">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-light">
                    {point.icon}
                  </span>
                  {point.label}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/10 p-4 shadow-2xl shadow-black/20">
              <Mascot name="hello" size="h-16 w-16 animate-float" />
              <p className="text-sm leading-6 text-stone-300">
                Подсказки, статусы и уведомления помогают не терять следующий шаг сделки.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
