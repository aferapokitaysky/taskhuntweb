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

  if (loading) return <p className="text-sm text-stone-500">Загружаем адреса…</p>;

  return (
    <div className="space-y-3">
      {addresses.length > 0 && !addingNew && (
        <div className="space-y-2">
          {addresses.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelectedId(a.id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                selectedId === a.id ? 'border-brand bg-brand/10' : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <NetworkLogo network={a.network} size={28} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-900">{a.label}</p>
                <p className="truncate text-xs text-stone-500">
                  {a.network} · {a.address.slice(0, 6)}…{a.address.slice(-4)}
                </p>
              </div>
              {a.isDefault && (
                <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                  По умолчанию
                </span>
              )}
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteAddress(a.id);
                }}
                className="shrink-0 text-xs text-stone-400 hover:text-red-600"
              >
                Удалить
              </span>
            </button>
          ))}
          <button type="button" onClick={() => setAddingNew(true)} className="text-sm font-medium text-brand hover:underline">
            + Новый адрес
          </button>
        </div>
      )}

      {(addingNew || addresses.length === 0) && (
        <div className="space-y-3 rounded-xl border border-stone-200 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {(showAllNetworks ? PAYOUT_NETWORKS : POPULAR_NETWORKS).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNetwork(n)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition ${
                  network === n ? 'border-brand bg-brand/10 text-brand' : 'border-stone-200 text-stone-600 hover:border-stone-300'
                }`}
              >
                <NetworkLogo network={n} size={16} />
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
          <input
            placeholder="Адрес кошелька"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            placeholder="Название/заметка (необязательно)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
            Сохранить для следующего раза
          </label>
          {addresses.length > 0 && (
            <button type="button" onClick={() => setAddingNew(false)} className="text-sm font-medium text-stone-500 hover:text-stone-900">
              ← К сохранённым адресам
            </button>
          )}
        </div>
      )}
    </div>
  );
}
