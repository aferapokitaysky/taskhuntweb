'use client';

import { AppHeader } from '@/components/AppHeader';
import { Mascot } from '@/components/Mascot';

const TELEGRAM_HANDLE = 'vacbanalert';

export default function ReferralsClient() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <AppHeader />
      <section className="workspace-hero p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-brand">Партнёрство</p>
            <h1 className="mt-2 font-serif text-4xl leading-tight text-stone-950">Сотрудничество и реклама</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
              По вопросам сотрудничества, размещения рекламы и партнёрских интеграций — пишите в Telegram, ответим лично.
            </p>
          </div>
          <Mascot name="supportHeadset" size="h-20 w-20" />
        </div>
      </section>

      <div className="premium-panel rounded-3xl p-8 text-center">
        <p className="text-sm font-medium text-stone-600">Наш контакт для партнёров</p>
        <a
          href={`https://t.me/${TELEGRAM_HANDLE}`}
          target="_blank"
          rel="noreferrer"
          className="primary-action mt-4 inline-flex items-center gap-2 px-6 py-3 text-base"
        >
          @{TELEGRAM_HANDLE}
        </a>
        <p className="mt-4 text-sm text-stone-500">Опишите, что вы предлагаете — рекламу, интеграцию, совместный проект — и мы свяжемся с вами.</p>
      </div>
    </main>
  );
}
