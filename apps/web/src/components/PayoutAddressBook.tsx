'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { SavedPayoutAddress } from '@/lib/types';
import { PAYOUT_NETWORKS } from '@taskhunt/shared-types';
import { NetworkLogo } from './NetworkLogo';

const POPULAR_NETWORKS = ['TRC20', 'ERC20', 'BEP20', 'SOL'] as const;

export type WithdrawTarget =
  | { mode: 'saved'; savedAddressId: string }
  | { mode: 'new'; network: string; address: string; label: string; saveAddress: boolean };

/** Книга сохранённых крипто-адресов для быстрого вывода — выбор из списка вместо ввода адреса каждый раз. */
export function PayoutAddressBook({ onChange }: { onChange: (target: WithdrawTarget | null) => void }) {
  const [addresses, setAddresses] = useState<SavedPayoutAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [showAllNetworks, setShowAllNetworks] = useState(false);
  const [network, setNetwork] = useState<string>('TRC20');
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [saveAddress, setSaveAddress] = useState(true);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api<SavedPayoutAddress[]>('/wallet/payout-addresses')
      .then((list) => {
        setAddresses(list);
        const def = list.find((a) => a.isDefault) ?? list[0];
        if (def) {
          setSelectedId(def.id);
          setAddingNew(false);
        } else {
          setAddingNew(true);
        }
      })
      .catch(() => setAddingNew(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!addingNew && selectedId) {
      onChange({ mode: 'saved', savedAddressId: selectedId });
    } else if (addingNew && address.trim()) {
      onChange({ mode: 'new', network, address: address.trim(), label: label.trim(), saveAddress });
    } else {
      onChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addingNew, selectedId, network, address, label, saveAddress]);

  async function deleteAddress(id: string) {
    await api(`/wallet/payout-addresses/${id}`, { method: 'DELETE' }).catch(() => undefined);
    load();
  }

  async function saveNewAddress() {
    if (!address.trim()) {
      setAddressError('Введите адрес кошелька');
      return;
    }
    setSavingAddress(true);
    setAddressError(null);
    try {
      const created = await api<SavedPayoutAddress>('/wallet/payout-addresses', {
        method: 'POST',
        body: JSON.stringify({
          network,
          address: address.trim(),
          label: label.trim() || `${network} кошелёк`,
        }),
      });
      setAddresses((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setSelectedId(created.id);
      setAddingNew(false);
      setAddress('');
      setLabel('');
      setSaveAddress(true);
    } catch (err) {
      setAddressError(err instanceof Error ? err.message : 'Не получилось привязать кошелёк');
    } finally {
      setSavingAddress(false);
    }
  }

  async function makeDefault(id: string) {
    await api<SavedPayoutAddress>(`/wallet/payout-addresses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isDefault: true }),
    }).catch(() => undefined);
    load();
  }

  if (loading) {
    return (
      <div className="rounded-[1.6rem] border border-stone-100 bg-white/70 p-4 text-sm text-stone-500">
        Загружаем кошельки…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">Кошелёк для выплаты</p>
          <p className="mt-1 text-sm text-stone-600">
            {addresses.length > 0 ? 'Выберите сохранённый адрес или привяжите новый.' : 'Привяжите первый адрес с сетью и заметкой.'}
          </p>
        </div>
        {addresses.length > 0 && (
          <button type="button" onClick={() => setAddingNew(true)} className="secondary-action px-3 py-2 text-xs font-semibold">
            Привязать
          </button>
        )}
      </div>

      {addresses.length > 0 && !addingNew && (
        <div className="space-y-2">
          {addresses.map((a) => (
            <div
              key={a.id}
              className={`interactive-card flex w-full items-center gap-3 rounded-[1.5rem] border px-3 py-3 text-left transition ${
                selectedId === a.id ? 'border-brand bg-brand/10 shadow-sm' : 'border-stone-100 bg-white/70 hover:border-stone-300'
              }`}
            >
              <button type="button" onClick={() => setSelectedId(a.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <NetworkLogo network={a.network} size={30} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-stone-900">{a.label}</span>
                  <span className="block truncate text-xs text-stone-500">
                    {a.network} · {a.address.slice(0, 6)}…{a.address.slice(-4)}
                  </span>
                  {a.lastUsedAt && <span className="mt-0.5 block text-[11px] text-stone-400">Последний вывод: {new Date(a.lastUsedAt).toLocaleDateString('ru-RU')}</span>}
                </span>
                {a.isDefault && (
                  <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                    Основной
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => deleteAddress(a.id)}
                className="shrink-0 rounded-full px-2 py-1 text-xs text-stone-400 hover:bg-red-50 hover:text-red-600"
              >
                Удалить
              </button>
            </div>
          ))}
          {selectedId && !addresses.find((item) => item.id === selectedId)?.isDefault && (
            <button type="button" onClick={() => makeDefault(selectedId)} className="secondary-action w-full px-3 py-2 text-sm font-semibold">
              Сделать выбранный основным
            </button>
          )}
        </div>
      )}

      {(addingNew || addresses.length === 0) && (
        <div className="space-y-3 rounded-[1.6rem] border border-stone-100 bg-white/70 p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            {(showAllNetworks ? PAYOUT_NETWORKS : POPULAR_NETWORKS).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNetwork(n)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  network === n ? 'border-brand bg-brand/10 text-brand shadow-sm' : 'border-stone-100 bg-white text-stone-600 hover:border-stone-300'
                }`}
              >
                <NetworkLogo network={n} size={18} />
                {n}
              </button>
            ))}
            {!showAllNetworks && (
              <button
                type="button"
                onClick={() => setShowAllNetworks(true)}
                className="text-xs font-medium text-stone-500 hover:text-stone-900"
              >
                Показать все сети
              </button>
            )}
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-stone-400">Адрес кошелька</span>
            <input
              placeholder="Например: TXa... или 0x..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="field-surface w-full px-3 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-stone-400">Заметка</span>
            <input
              placeholder={`${network} основной, Binance, Ledger...`}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="field-surface w-full px-3 py-3 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 rounded-[1.25rem] bg-stone-50 px-3 py-2 text-sm text-stone-600">
            <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="h-4 w-4 rounded-md" />
            Сохранить и использовать для следующих выплат
          </label>
          {addressError && <p className="rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{addressError}</p>}
          <button
            type="button"
            onClick={saveNewAddress}
            disabled={savingAddress || !address.trim()}
            className="primary-action w-full px-4 py-3 text-sm disabled:opacity-50"
          >
            {savingAddress ? 'Привязываем…' : 'Привязать кошелёк'}
          </button>
          {addresses.length > 0 && (
            <button type="button" onClick={() => setAddingNew(false)} className="secondary-action w-full px-3 py-2 text-sm font-semibold">
              К сохранённым адресам
            </button>
          )}
        </div>
      )}
    </div>
  );
}
