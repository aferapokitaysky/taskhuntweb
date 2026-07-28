'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money } from '@/lib/types';
import { CheckIcon } from '@/components/icons/CheckIcon';

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

const TIER_TITLE: Record<string, string> = { STARTER: 'Starter', PRO: 'Pro', PREMIUM: 'Premium' };

function tierFeatures(tier: SubscriptionTier): string[] {
  return [
    `Комиссия с сделки: ${tier.commissionPercent}%`,
    tier.maxActiveBidsPerMonth ? `${tier.maxActiveBidsPerMonth} откликов/мес` : 'Без лимита откликов',
    tier.maxActiveOrdersPerMonth ? `${tier.maxActiveOrdersPerMonth} заказов/мес` : 'Без лимита заказов',
    tier.freeBoostsPerMonth > 0 ? `${tier.freeBoostsPerMonth} бесплатных бустов/мес` : 'Продвижение — платно',
  ];
}

export default function PricingPage() {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [mySubscription, setMySubscription] = useState<MySubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutTier, setCheckoutTier] = useState<string | null>(null);
  const [payment, setPayment] = useState<{ payAddress: string; payAmount: number; payCurrency: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SubscriptionTier[]>('/subscriptions/tiers')
      .then(setTiers)
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить тарифы'))
      .finally(() => setLoading(false));

    api<MySubscription>('/subscriptions/me')
      .then(setMySubscription)
      .catch(() => setMySubscription(null)); // не залогинен — просто не подсвечиваем текущий тариф
  }, []);

  async function upgrade(tierName: string) {
    setCheckoutTier(tierName);
    setError(null);
    setPayment(null);
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

  if (loading) {
    return <main className="mx-auto max-w-5xl px-4 py-10 text-slate-500">Загружаем тарифы…</main>;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/dashboard" className="mb-6 inline-block text-sm font-medium text-slate-500 hover:text-slate-900">
        ← Назад в dashboard
      </Link>
      <h1 className="mb-2 text-3xl font-bold">Тарифы</h1>
      <p className="mb-8 text-slate-500">Меньше комиссия, выше лимиты, приоритет в поддержке — по мере роста.</p>

      {error && <p className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => {
          const isCurrent = mySubscription?.tier.name === tier.name;
          const isFree = tier.name === 'STARTER';
          return (
            <div
              key={tier.id}
              className={`rounded-xl border p-6 shadow-sm ${
                tier.name === 'PREMIUM' ? 'border-brand ring-2 ring-brand' : 'border-slate-200 bg-white'
              }`}
            >
              <h2 className="text-xl font-bold">{TIER_TITLE[tier.name]}</h2>
              <p className="mt-2 text-3xl font-bold">
                {isFree ? 'Бесплатно' : money(tier.priceUsd, 'USD')}
                {!isFree && <span className="text-sm font-normal text-slate-500">/мес</span>}
              </p>

              <ul className="mt-6 space-y-2">
                {tierFeatures(tier).map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckIcon className="h-4 w-4 shrink-0 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isCurrent ? (
                  <p className="rounded-lg bg-emerald-50 px-4 py-2 text-center text-sm font-medium text-emerald-700">
                    Ваш текущий тариф
                  </p>
                ) : isFree ? (
                  <p className="rounded-lg border border-slate-200 px-4 py-2 text-center text-sm text-slate-500">
                    Тариф по умолчанию
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => upgrade(tier.name)}
                    className="w-full rounded-lg bg-brand px-4 py-3 font-medium text-white hover:bg-brand-dark"
                  >
                    Перейти на {TIER_TITLE[tier.name]}
                  </button>
                )}
              </div>

              {checkoutTier === tier.name && payment && (
                <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="mb-1 font-medium">Оплатите {payment.payAmount} {payment.payCurrency}:</p>
                  <p className="break-all">{payment.payAddress}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
