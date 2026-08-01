import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from './Logo';
import { Mascot } from './Mascot';
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
  { icon: <BalanceMainIcon className="h-6 w-6" />, label: 'Счета, чеки, чат и выплаты в одном контуре' },
];

const ACTIVITY_ITEMS = [
  { label: 'Отклик', value: '3', tone: 'bg-card-lavender' },
  { label: 'Эскроу', value: '$820', tone: 'bg-card-sage' },
];

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  sideTitle = 'Работайте как на большой job-платформе, но с безопасной сделкой',
  sideDescription = 'TaskHunt соединяет поиск заказов, профили специалистов, чат, этапы, счета, чеки и крипто-эскроу в одном спокойном рабочем процессе.',
}: AuthShellProps) {
  return (
    <main className="auth-page min-h-screen px-2 py-1 sm:px-4 sm:py-2">
      <div className="mx-auto grid min-h-[calc(100vh-0.5rem)] max-w-6xl overflow-hidden rounded-[1.6rem] border border-stone-100 bg-white/86 shadow-2xl shadow-stone-200/65 backdrop-blur sm:min-h-[calc(100vh-1rem)] sm:rounded-[2rem] lg:grid-cols-[minmax(420px,1fr)_minmax(0,0.9fr)]">
        <section className="flex flex-col justify-start px-3 py-2.5 sm:px-8 sm:py-5 lg:px-12 lg:py-7">
          <Link href="/" className="mb-1.5 inline-flex w-fit transition-transform hover:scale-105 sm:mb-4 lg:hidden">
            <Logo className="h-7 sm:h-10" />
          </Link>
          <div className="mb-2 sm:mb-4">
            <p className="text-[11px] font-semibold text-brand sm:text-sm">{eyebrow}</p>
            <h1 className="mt-1 font-serif text-xl leading-tight text-stone-950 sm:mt-2 sm:text-4xl">{title}</h1>
            <p className="mt-1.5 max-w-xl text-xs leading-5 text-stone-600 max-[380px]:hidden sm:mt-2 sm:text-sm sm:leading-6">{description}</p>
          </div>
          <div className="w-full rounded-[1.45rem] border border-stone-200 bg-card-sand/35 p-2.5 shadow-xl shadow-stone-200/45 sm:rounded-[1.7rem] sm:p-4">
            {children}
          </div>
        </section>

        <aside className="relative hidden h-fit self-center overflow-hidden rounded-l-[1.8rem] border-l border-stone-100 bg-card-sand/45 p-5 lg:flex lg:flex-col">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(41,37,36,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(41,37,36,0.04)_1px,transparent_1px)] bg-[size:30px_30px]" />
          <div className="relative z-10 rounded-[1.6rem] border border-white/80 bg-white/76 p-4 shadow-xl shadow-stone-200/45 backdrop-blur">
            <Link href="/" className="inline-flex rounded-[1.15rem] bg-white/90 p-2 shadow-sm transition-transform hover:scale-105">
              <Logo className="h-9" />
            </Link>
            <div className="mt-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Безопасный вход</p>
                <h2 className="mt-2 max-w-sm font-serif text-2xl leading-tight text-stone-950">{sideTitle}</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-stone-600">{sideDescription}</p>
              </div>
              <Mascot name="wave" size="h-14 w-14" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {ACTIVITY_ITEMS.map((item, index) => (
                <div
                  key={item.label}
                  className={`rounded-[1.05rem] p-3 text-stone-900 ${item.tone}`}
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-600">{item.label}</p>
                  <p className="mt-1 truncate text-sm font-bold">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {['Бриф', 'Чат', 'Счёт', 'Приёмка'].map((item, index) => (
                <div key={item} className="rounded-[0.95rem] bg-stone-50 px-2 py-2 text-center">
                  <p className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold text-brand shadow-sm">{index + 1}</p>
                  <p className="mt-1 text-[11px] font-semibold text-stone-500">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-2">
              {TRUST_POINTS.map((point) => (
                <div key={point.label} className="flex items-center gap-3 rounded-[1rem] bg-white/70 px-3 py-2 text-sm font-medium text-stone-700 shadow-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.75rem] bg-card-sage text-brand">
                    {point.icon}
                  </span>
                  {point.label}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
