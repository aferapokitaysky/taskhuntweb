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
  { label: 'Отклик', value: '3 кандидата', tone: 'bg-card-lavender' },
  { label: 'Эскроу', value: '$820', tone: 'bg-card-sage' },
  { label: 'Инвойс', value: 'к оплате', tone: 'bg-card-sand' },
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
    <main className="auth-page min-h-screen px-3 py-3 sm:px-4">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-stone-100 bg-white/86 shadow-2xl shadow-stone-200/65 backdrop-blur lg:grid-cols-[minmax(420px,1fr)_minmax(0,0.9fr)]">
        <section className="flex flex-col justify-start px-5 py-6 sm:px-10 lg:px-14 lg:py-9">
          <Link href="/" className="mb-5 inline-flex w-fit transition-transform hover:scale-105 lg:hidden">
            <Logo className="h-10" />
          </Link>
          <div className="mb-5">
            <p className="text-sm font-semibold text-brand">{eyebrow}</p>
            <h1 className="mt-2 font-serif text-3xl leading-tight text-stone-950 sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-stone-600">{description}</p>
          </div>
          <div className="rounded-[1.7rem] border border-stone-200 bg-card-sand/35 p-4 shadow-xl shadow-stone-200/45 sm:p-5">
            {children}
          </div>
        </section>

        <aside className="relative hidden overflow-hidden border-l border-stone-100 bg-card-sand/55 p-8 lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(41,37,36,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(41,37,36,0.045)_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="relative z-10">
            <Link href="/" className="inline-flex rounded-[1.4rem] bg-white/90 p-3 shadow-sm transition-transform hover:scale-105">
              <Logo className="h-10" />
            </Link>
            <div className="mt-10">
              <div className="mb-4 flex items-center gap-3">
                <p className="inline-flex rounded-full bg-white/78 px-4 py-2 text-sm font-bold text-brand shadow-sm">
                  Безопасный фриланс-маркетплейс
                </p>
                <Mascot name="wave" size="h-16 w-16" />
              </div>
              <h2 className="max-w-md font-serif text-3xl leading-tight text-stone-950">{sideTitle}</h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-stone-600">{sideDescription}</p>
            </div>
          </div>

          <div className="relative z-10">
            <div className="mb-4 rounded-[1.8rem] border border-white/80 bg-white/72 p-4 shadow-xl shadow-stone-200/55 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Живая сделка</p>
                  <p className="mt-1 font-serif text-2xl text-stone-950">Landing page refresh</p>
                </div>
                <Mascot name="workLaptop" size="h-16 w-16" />
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {['Бриф', 'Чат', 'Инвойс', 'Приёмка'].map((item, index) => (
                  <div key={item} className="rounded-[1rem] bg-stone-50 px-2 py-2 text-center">
                    <p className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-brand shadow-sm">{index + 1}</p>
                    <p className="mt-1 text-[11px] font-semibold text-stone-500">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mb-4 grid grid-cols-3 gap-3">
              {ACTIVITY_ITEMS.map((item, index) => (
                <div
                  key={item.label}
                  className={`interactive-card rounded-[1.25rem] p-3 text-stone-900 ${item.tone}`}
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-600">{item.label}</p>
                  <p className="mt-1 truncate text-sm font-bold">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mb-4 grid gap-3">
              {TRUST_POINTS.map((point) => (
                <div key={point.label} className="interactive-card flex items-center gap-3 rounded-[1.35rem] border border-white/80 bg-white/68 px-4 py-3 text-sm font-medium text-stone-700 shadow-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.9rem] bg-card-sage text-brand">
                    {point.icon}
                  </span>
                  {point.label}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 rounded-[1.7rem] border border-white/80 bg-white/76 p-4 shadow-sm">
              <Mascot name="hello" size="h-16 w-16 animate-float" />
              <p className="text-sm leading-6 text-stone-600">
                Подсказки, статусы и уведомления помогают не терять следующий шаг сделки.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
