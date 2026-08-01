'use client';

import { useState } from 'react';
import type { Invoice } from '@/lib/types';

export function PaymentConfirmDetails({
  invoice,
  loading,
}: {
  invoice: Invoice | null;
  loading?: boolean;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!invoice) return null;

  const payAmount = invoice.payAmount ?? invoice.amount;
  const payCurrency = invoice.payCurrency ?? invoice.currency;
  const payLine = `${payAmount} ${payCurrency}`;

  async function copy(value: string, field: string) {
    await window.navigator.clipboard?.writeText(value).catch(() => undefined);
    setCopiedField(field);
    window.setTimeout(() => {
      setCopiedField((current) => (current === field ? null : current));
    }, 1300);
  }

  if (!invoice.payAddress) {
    return (
      <p>
        {loading
          ? 'Получаем реквизиты оплаты для этого счёта...'
          : 'Реквизиты оплаты пока недоступны. Обновите счёт или попросите исполнителя выставить новый.'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p>Проверьте сумму и адрес. После подтверждения провайдера деньги уйдут в эскроу TaskHunt.</p>
      <div className="grid gap-2 rounded-[1.35rem] bg-stone-50 p-2">
        <CopyPaymentRow
          label="К оплате"
          value={payLine}
          copied={copiedField === 'amount'}
          onCopy={() => copy(payLine, 'amount')}
        />
        <CopyPaymentRow
          label="Адрес"
          value={invoice.payAddress}
          copied={copiedField === 'address'}
          onCopy={() => copy(invoice.payAddress ?? '', 'address')}
        />
      </div>
    </div>
  );
}

function CopyPaymentRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-[1rem] bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">{label}</span>
        <button type="button" onClick={onCopy} className="shrink-0 text-xs font-bold text-brand hover:text-brand-dark">
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      <p className="mt-1 break-all font-mono text-xs text-stone-700">{value}</p>
    </div>
  );
}
