'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { money } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';
import { ErrorNotice } from '@/components/ErrorNotice';
import { CheckIcon } from '@/components/icons/CheckIcon';
import { CrownIcon } from '@/components/icons/CrownIcon';
import { CrownIllustratedIcon } from '@/components/icons/illustrated/CrownIllustratedIcon';
import { RocketIcon } from '@/components/icons/illustrated/RocketIcon';
import { SeedlingIcon } from '@/components/icons/illustrated/SeedlingIcon';
import { PricingShieldIcon } from '@/components/icons/illustrated/PricingShieldIcon';
import { Mascot, type MascotName } from '@/components/Mascot';
import { Skeleton } from '@/components/Skeleton';

interface SubscriptionTier {
  id: string;
  name: 'STARTER' | 'PRO' | 'PREMIUM';
  priceUsd: string;
  commissionPercent: string;
  maxActiveBidsPerMonth: number | null;
  maxActiveOrdersPerMonth: number | null;
  freeBoostsPerMonth: number;
}

interface MySubscription {
  tier: { name: string };
}

const TIER_META: Record<SubscriptionTier['name'], { title: string; tone: string; Icon: typeof SeedlingIcon }> = {
  STARTER: { title: 'Starter', tone: 'bg-card-sand', Icon: SeedlingIcon },
  PRO: { title: 'Pro', tone: 'bg-card-sage', Icon: RocketIcon },
  PREMIUM: { title: 'Premium', tone: 'bg-white', Icon: CrownIllustratedIcon },
};

const PRICING_FEATURES: Array<{ title: string; text: string; mascot?: MascotName }> = [
  { title: 'Комиссия понятна', text: 'Процент виден до выбора тарифа и не меняется внутри сделки.' },
  { title: 'Бусты включены', text: 'На старших тарифах продвижение заказов не требует ручной оплаты каждый раз.' },
  { title: 'Лимиты честные', text: 'Видно, сколько заказов и откликов доступно в месяц.' },
];

function tierFeatures(tier: SubscriptionTier): string[] {
  return [
    `Комиссия: ${tier.commissionPercent}%`,
    tier.maxActiveBidsPerMonth ? `${tier.maxActiveBidsPerMonth} откликов в месяц` : 'Отклики без лимита',
    tier.maxActiveOrdersPerMonth ? `${tier.maxActiveOrdersPerMonth} заказов в месяц` : 'Заказы без лимита',
    tier.freeBoostsPerMonth > 0 ? `${tier.freeBoostsPerMonth} бустов в месяц включено` : 'Продвижение оплачивается отдельно',
  ];
}

export default function PricingClient() {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [mySubscription, setMySubscription] = useState<MySubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutTier, setCheckoutTier] = useState<string | null>(null);
  const [payment, setPayment] = useState<{ payAddress: string; payAmount: number; payCurrency: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [activatedTier, setActivatedTier] = useState<string | null>(null);

  useEffect(() => {
    api<SubscriptionTier[]>('/subscriptions/tiers')
      .then(setTiers)
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить тарифы'))
      .finally(() => setLoading(false));

    api<MySubscription>('/subscriptions/me')
      .then(setMySubscription)
      .catch(() => setMySubscription(null));
  }, []);

  const bestTier = useMemo(() => tiers.find((tier) => tier.name === 'PREMIUM') ?? tiers[tiers.length - 1], [tiers]);

  async function upgrade(tierName: string) {
    setCheckoutTier(tierName);
    setError(null);
    setPayment(null);
    setActivatedTier(null);
    setCheckingOut(true);
    try {
      // Сначала пробуем списать с основного баланса — без нового
      // крипто-платежа. Если средств не хватает (403), тихо переходим к
      // обычной крипто-оплате ниже — это ожидаемый, не ошибочный путь.
      await api('/subscriptions/checkout/from-balance', {
        method: 'POST',
        body: JSON.stringify({ tierName }),
      });
      setActivatedTier(tierName);
      const mine = await api<MySubscription>('/subscriptions/me').catch(() => null);
      if (mine) setMySubscription(mine);
      return;
    } catch {
      // недостаточно средств на балансе (или баланс недоступен) — ниже пробуем крипто
    } finally {
      setCheckingOut(false);
    }

    try {
      const result = await api<{ payment: { payAddress: string; payAmount: number; payCurrency: string } }>(
        '/subscriptions/checkout',
        { method: 'POST', body: JSON.stringify({ tierName }) },
      );
      setPayment(result.payment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось оформить подписку. Убедитесь, что вы вошли в аккаунт.');
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <AppHeader />

      <section className="workspace-hero mb-8 p-6 md:p-8">
        <div className="relative grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Тарифы TaskHunt</p>
            <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-stone-950 md:text-6xl">Платите меньше комиссии, когда работа растет</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600">
              Тарифы не прячут ценность за лишними уровнями: лимиты, комиссия, бусты и переход на оплату видны сразу.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/register?role=FREELANCER" className="primary-action px-5 py-3 text-sm">
                Начать как фрилансер
              </Link>
              <Link href="/register?role=CLIENT" className="secondary-action px-5 py-3 text-sm">
                Нанимать команду
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-stone-100 bg-white/65 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <PricingShieldIcon className="h-12 w-12" />
                <div>
                  <p className="text-xs uppercase text-stone-400">Текущий тариф</p>
                  <p className="mt-1 font-serif text-3xl text-stone-950">{mySubscription?.tier.name ?? 'Starter'}</p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-stone-600">
              Оплата идет через тот же безопасный платежный контур, что и сделки на платформе.
            </p>
          </div>
        </div>
      </section>

      {error && <ErrorNotice message={error} />}

      <section className="mb-8 grid gap-4 lg:grid-cols-3">
        {PRICING_FEATURES.map(({ title, text, mascot }) => (
          <div key={title} className="interactive-card rounded-3xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl text-stone-950">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
              </div>
              {mascot && <Mascot name={mascot} size="h-12 w-12" />}
            </div>
          </div>
        ))}
      </section>

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="premium-panel p-6">
              <Skeleton className="h-14 w-14 rounded-3xl" />
              <Skeleton className="mt-5 h-7 w-32" />
              <Skeleton className="mt-5 h-12 w-40" />
              <Skeleton className="mt-8 h-40 rounded-2xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {tiers.map((tier) => {
            const meta = TIER_META[tier.name];
            const isCurrent = mySubscription?.tier.name === tier.name;
            const isFree = tier.name === 'STARTER';
            const isPremium = tier.name === bestTier?.name;
            const Icon = meta.Icon;

            return (
              <article
                key={tier.id}
                className={`interactive-card relative flex min-h-[520px] flex-col rounded-3xl p-6 ${meta.tone} ${
                  isPremium ? 'ring-2 ring-brand' : ''
                }`}
              >
                {isPremium && (
                  <span className="absolute -top-3 right-6 inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">
                    <CrownIcon className="h-3.5 w-3.5" />
                    Максимум возможностей
                  </span>
                )}

                <div className="flex items-start justify-between gap-4">
                  <Icon className="h-14 w-14" />
                  {isCurrent && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Активен</span>}
                </div>

                <h2 className="mt-5 font-serif text-3xl text-stone-950">{meta.title}</h2>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {tier.name === 'STARTER' && 'Для первых задач, проверки платформы и аккуратного старта без обязательной оплаты.'}
                  {tier.name === 'PRO' && 'Для регулярной работы, когда важны лимиты, бусты и сниженная комиссия.'}
                  {tier.name === 'PREMIUM' && 'Для активных команд и специалистов, которые хотят максимум оборота и меньше ручной рутины.'}
                </p>

                <div className="mt-6">
                  <p className="text-4xl font-bold text-stone-950">
                    {isFree ? 'Бесплатно' : money(tier.priceUsd, 'USD')}
                    {!isFree && <span className="text-sm font-normal text-stone-500"> / месяц</span>}
                  </p>
                </div>

                <ul className="mt-6 space-y-3">
                  {tierFeatures(tier).map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm leading-5 text-stone-700">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-6">
                  {isCurrent ? (
                    <p className="rounded-full bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700">Ваш текущий тариф</p>
                  ) : isFree ? (
                    <p className="secondary-action px-4 py-3 text-center text-sm">Тариф по умолчанию</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => upgrade(tier.name)}
                      disabled={checkingOut && checkoutTier === tier.name}
                      className="primary-action w-full px-4 py-3 text-sm disabled:opacity-60"
                    >
                      {checkingOut && checkoutTier === tier.name ? 'Проверяем баланс...' : `Перейти на ${meta.title}`}
                    </button>
                  )}

                  {checkoutTier === tier.name && activatedTier === tier.name && (
                    <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-xs font-semibold text-emerald-700">
                      Тариф {meta.title} активирован — списано с основного баланса кошелька.
                    </div>
                  )}

                  {checkoutTier === tier.name && payment && (
                    <div className="mt-4 rounded-2xl bg-card-sand p-4 text-xs text-stone-700">
                      <p className="font-semibold text-stone-950">Не хватает баланса — оплатите криптой</p>
                      <p className="mt-2 font-semibold text-stone-950">Оплата: {payment.payAmount} {payment.payCurrency}</p>
                      <p className="mt-2 break-all text-stone-600">{payment.payAddress}</p>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
