'use client';

import { useState } from 'react';
import type { Invoice } from '@/lib/types';
import { money } from '@/lib/types';
import { BalanceEscrowIcon } from './icons/illustrated/BalanceEscrowIcon';
import { BalanceMainIcon } from './icons/illustrated/BalanceMainIcon';
import { MailCheckIcon } from './icons/illustrated/MailCheckIcon';
import { Mascot } from './Mascot';

const INVOICE_STATUS_LABEL: Record<Invoice['status'], string> = {
  PENDING: 'Ожидает оплату',
  PAID: 'Оплачен, эскроу открыт',
  CANCELLED: 'Отменён',
  EXPIRED: 'Истёк',
};

export function InvoiceChatCard({
  invoice,
  own,
  canPay,
  onPayIntent,
}: {
  invoice: Invoice;
  own?: boolean;
  canPay?: boolean;
  onPayIntent?: (invoice: Invoice) => void;
}) {
  const [copied, setCopied] = useState(false);
  const paid = invoice.status === 'PAID';
  const pending = invoice.status === 'PENDING';
  const cancelled = invoice.status === 'CANCELLED' || invoice.status === 'EXPIRED';
  const shortId = invoice.id.slice(0, 8).toUpperCase();
  const statusTone = paid
    ? 'bg-emerald-100 text-emerald-700'
    : cancelled
      ? 'bg-red-100 text-red-700'
      : 'bg-brand/10 text-brand';

  async function copyInvoiceId() {
    await navigator.clipboard?.writeText(invoice.id).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div
      className={`mt-2 max-w-xl overflow-hidden rounded-[1.75rem] border shadow-sm ${
        own ? 'border-white/25 bg-white/10 text-white' : 'border-brand/20 bg-white text-stone-900 dark:border-stone-700 dark:bg-stone-900'
      }`}
    >
      <div className={`p-4 ${paid ? 'bg-card-sage/75' : cancelled ? 'bg-card-rose/70' : 'bg-card-sand/75'} dark:bg-stone-800`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-words text-[11px] font-bold uppercase tracking-[0.16em] text-brand">{paid ? 'Чек оплаты' : 'Счёт TaskHunt'}</p>
            <p className="mt-1 break-words font-serif text-3xl leading-none text-stone-950">{money(invoice.amount, invoice.currency)}</p>
            <p className="mt-2 text-xs font-semibold text-stone-500">Документ TH-{shortId}</p>
          </div>
          <Mascot name={paid ? 'successConfetti' : 'invoiceCoin'} size="h-14 w-14" />
        </div>
        <div className="mt-4 rounded-[1.35rem] bg-white/85 p-3 dark:bg-stone-900">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[1rem] bg-card-sand">
                {paid ? <MailCheckIcon className="h-6 w-6" /> : <BalanceMainIcon className="h-6 w-6" />}
              </span>
              <div className="min-w-0">
                <span className="block break-words font-serif text-lg text-stone-950">taskhunt</span>
                <span className="block text-[11px] font-medium text-stone-400">secure invoice</span>
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone}`}>
              {INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}
            </span>
          </div>
          {invoice.description && <p className="mt-3 break-words text-xs leading-5 text-stone-600">{invoice.description}</p>}
          <div className="mt-3 grid gap-2 rounded-[1rem] bg-stone-50 p-2 text-[11px] text-stone-500 dark:bg-stone-800">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold uppercase tracking-[0.12em] text-stone-400">ID</span>
              <button type="button" onClick={copyInvoiceId} className="font-semibold text-brand hover:text-brand-dark">
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
            <p className="break-all font-mono">{invoice.id}</p>
          </div>
        </div>
      </div>

      {pending && canPay && (
        <div className="grid gap-2 border-t border-stone-100 bg-white/90 p-3 dark:border-stone-700 dark:bg-stone-900">
          <button type="button" onClick={() => onPayIntent?.(invoice)} className="primary-action px-4 py-2.5 text-sm">
            Оплатить счёт
          </button>
          <p className="flex gap-2 text-xs leading-5 text-stone-500">
            <BalanceEscrowIcon className="h-5 w-5 shrink-0" />
            После оплаты провайдер подтвердит перевод, а сумма уйдёт в эскроу.
          </p>
        </div>
      )}
      {pending && !canPay && (
        <div className="border-t border-stone-100 bg-white/70 p-3 text-xs leading-5 text-stone-500 dark:border-stone-700 dark:bg-stone-900">
          Счёт отправлен заказчику. Когда платёж подтвердится, здесь появится чек.
        </div>
      )}
      {paid && (
        <div className="border-t border-stone-100 bg-white/80 p-3 text-xs leading-5 text-emerald-700 dark:border-stone-700 dark:bg-stone-900">
          Оплата подтверждена, средства находятся под защитой TaskHunt до приёмки работы.
        </div>
      )}
      {cancelled && (
        <div className="border-t border-stone-100 bg-white/80 p-3 text-xs leading-5 text-red-700 dark:border-stone-700 dark:bg-stone-900">
          Этот счёт больше нельзя оплатить. Попросите исполнителя выставить новый, если работа продолжается.
        </div>
      )}
    </div>
  );
}
