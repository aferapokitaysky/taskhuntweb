'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

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
      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="text-center text-slate-500">Загрузка реферальной программы...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-600">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Реферальная программа</h1>
        <p className="mt-2 text-slate-600">
          Приглашайте друзей на TaskHunt и получайте 5% от первого оплаченного заказа каждого привлечённого пользователя.
        </p>
      </div>

      {/* Карточки со статистикой */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Ваш реферальный код</div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-2xl font-mono font-bold tracking-wider text-brand">
              {info?.code}
            </span>
            <button
              onClick={handleCopyLink}
              className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-indigo-100 transition"
            >
              {copied ? 'Скопировано!' : 'Копировать ссылку'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Привлечено друзей</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{info?.totalReferred ?? 0}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Заработано</div>
          <div className="mt-2 text-3xl font-bold text-emerald-600">${info?.totalEarned ?? '0.00'}</div>
        </div>
      </div>

      {/* Форма ввода промокода */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Есть код от друга?</h2>
        <p className="mt-1 text-sm text-slate-500">
          Введите промокод реферера до совершения первой оплаты, чтобы привязать ваш аккаунт.
        </p>

        <form onSubmit={handleRedeem} className="mt-4 flex max-w-md gap-3">
          <input
            type="text"
            placeholder="Введите промокод"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 font-mono text-sm uppercase focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            disabled={redeemLoading}
          />
          <button
            type="submit"
            disabled={redeemLoading || !inputCode.trim()}
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
          >
            {redeemLoading ? 'Проверка...' : 'Применить'}
          </button>
        </form>

        {redeemSuccess && <p className="mt-3 text-sm text-emerald-600">{redeemSuccess}</p>}
        {redeemError && <p className="mt-3 text-sm text-red-600">{redeemError}</p>}
      </div>

      {/* Таблица рефералов */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Ваши рефералы</h2>

        {!info?.referrals || info.referrals.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            У вас пока нет привлечённых пользователей. Поделитесь ссылкой!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-400">
                <tr>
                  <th className="py-3 px-4">Пользователь</th>
                  <th className="py-3 px-4">Дата присоединения</th>
                  <th className="py-3 px-4">Статус вознаграждения</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {info.referrals.map((ref) => (
                  <tr key={ref.userId} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-900">{ref.displayName}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(ref.joinedAt).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4">
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
