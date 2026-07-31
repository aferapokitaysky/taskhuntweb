'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { MatchIcon } from '@/components/icons/illustrated/MatchIcon';
import { Mascot } from '@/components/Mascot';

interface ReferredUser {
  userId: string;
  displayName: string;
  joinedAt: string;
  rewardPaid: boolean;
}

interface ReferralInfo {
  code: string;
  totalReferred: number;
  totalEarned: string;
  referrals: ReferredUser[];
}

export default function ReferralsPage() {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inputCode, setInputCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadReferralInfo();
  }, []);

  async function loadReferralInfo() {
    setLoading(true);
    setError(null);
    try {
      const data = await api<ReferralInfo>('/referrals/me');
      setInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!inputCode.trim()) return;

    setRedeemLoading(true);
    setRedeemError(null);
    setRedeemSuccess(null);

    try {
      await api('/referrals/redeem', {
        method: 'POST',
        body: JSON.stringify({ code: inputCode.trim() }),
      });
      setRedeemSuccess('Реферальный код успешно применён!');
      setInputCode('');
      loadReferralInfo();
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : 'Ошибка при активации кода');
    } finally {
      setRedeemLoading(false);
    }
  }

  function handleCopyLink() {
    if (!info?.code) return;
    const shareUrl = `${window.location.origin}/register?ref=${info.code}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <AppHeader />
        <div className="text-center text-stone-500">Загрузка реферальной программы...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <AppHeader />
        <EmptyState
          icon={<MatchIcon />}
          title="Реферальная программа временно недоступна"
          description="Попробуйте зайти на эту страницу чуть позже."
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <AppHeader />
      <section className="workspace-hero p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-brand">Партнёрский рост</p>
            <h1 className="mt-2 font-serif text-4xl leading-tight text-stone-950">Реферальная программа</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
              Приглашайте друзей на TaskHunt и получайте 5% от первого оплаченного заказа каждого привлечённого пользователя.
            </p>
          </div>
          <Mascot name="successConfetti" size="h-20 w-20" />
        </div>
      </section>

      {/* Карточки со статистикой */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="interactive-card rounded-3xl bg-card-sand p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm font-medium text-stone-600">Ваш реферальный код</div>
            <Mascot name="invoiceCoin" size="h-12 w-12" />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-2xl font-mono font-bold tracking-wider text-brand">
              {info?.code}
            </span>
            <button
              onClick={handleCopyLink}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/10"
            >
              {copied ? 'Скопировано!' : 'Копировать ссылку'}
            </button>
          </div>
        </div>

        <div className="interactive-card rounded-3xl bg-card-sage p-6">
          <div className="text-sm font-medium text-stone-600">Привлечено друзей</div>
          <div className="mt-2 font-serif text-3xl text-stone-900">{info?.totalReferred ?? 0}</div>
        </div>

        <div className="interactive-card rounded-3xl bg-card-lavender p-6">
          <div className="text-sm font-medium text-stone-600">Заработано</div>
          <div className="mt-2 font-serif text-3xl text-stone-900">${info?.totalEarned ?? '0.00'}</div>
        </div>
      </div>

      {/* Форма ввода промокода */}
      <div className="premium-panel rounded-3xl p-6">
        <h2 className="font-serif text-lg text-stone-900">Есть код от друга?</h2>
        <p className="mt-1 text-sm text-stone-500">
          Введите промокод реферера до совершения первой оплаты, чтобы привязать ваш аккаунт.
        </p>

        <form onSubmit={handleRedeem} className="mt-4 flex max-w-md gap-3">
          <input
            type="text"
            placeholder="Введите промокод"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            className="field-surface flex-1 px-4 py-2.5 font-mono text-sm uppercase"
            disabled={redeemLoading}
          />
          <button
            type="submit"
            disabled={redeemLoading || !inputCode.trim()}
            className="primary-action px-5 py-2.5 text-sm"
          >
            {redeemLoading ? 'Проверка...' : 'Применить'}
          </button>
        </form>

        {redeemSuccess && <p className="mt-3 text-sm text-emerald-600">{redeemSuccess}</p>}
        {redeemError && <p className="mt-3 text-sm text-red-600">{redeemError}</p>}
      </div>

      {/* Таблица рефералов */}
      <div className="premium-panel rounded-3xl p-6">
        <h2 className="mb-4 font-serif text-lg text-stone-900">Ваши рефералы</h2>

        {!info?.referrals || info.referrals.length === 0 ? (
          <EmptyState
            icon={<MatchIcon />}
            title="Пока никого не привели"
            description="Поделитесь своей ссылкой из карточки выше — и они появятся здесь."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200 text-xs font-semibold uppercase text-stone-400">
                <tr>
                  <th className="py-3 px-4">Пользователь</th>
                  <th className="py-3 px-4">Дата присоединения</th>
                  <th className="py-3 px-4">Статус вознаграждения</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {info.referrals.map((ref) => (
                  <tr key={ref.userId} className="hover:bg-stone-50">
                    <td className="px-4 py-3 font-medium text-stone-900">{ref.displayName}</td>
                    <td className="px-4 py-3 text-stone-500">
                      {new Date(ref.joinedAt).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {ref.rewardPaid ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          Начислено
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          Ожидает первой оплаты
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
