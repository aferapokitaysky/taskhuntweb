'use client';

import { useEffect, useState } from 'react';
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

const ACCEPTED_RECEIPTS_KEY = 'taskhunt:acceptedReceipts:v1';

function loadAcceptedReceipts() {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const raw = window.localStorage.getItem(ACCEPTED_RECEIPTS_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

function rememberAcceptedReceipt(invoiceId: string) {
  if (typeof window === 'undefined') return;
  try {
    const ids = loadAcceptedReceipts();
    ids.add(invoiceId);
    window.localStorage.setItem(ACCEPTED_RECEIPTS_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage can be unavailable in private mode; visual acceptance still works for this render.
  }
}

export function InvoiceChatCard({
  invoice,
  own,
  canPay,
  onPayIntent,
  onDownloadPdf,
}: {
  invoice: Invoice;
  own?: boolean;
  canPay?: boolean;
  onPayIntent?: (invoice: Invoice) => void;
  onDownloadPdf?: (invoice: Invoice) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [receiptAccepted, setReceiptAccepted] = useState(false);
  const paid = invoice.status === 'PAID';
  const pending = invoice.status === 'PENDING';
  const cancelled = invoice.status === 'CANCELLED' || invoice.status === 'EXPIRED';
  const shortId = invoice.id.slice(0, 8).toUpperCase();
  const paymentLine = invoice.payAddress
    ? `${invoice.payAmount ?? invoice.amount} ${invoice.payCurrency ?? invoice.currency}`
    : null;
  const statusTone = paid
    ? 'bg-emerald-100 text-emerald-700'
    : cancelled
      ? 'bg-red-100 text-red-700'
      : 'bg-brand/10 text-brand';
  const receiptCardTone = receiptAccepted
    ? 'border-emerald-200 bg-emerald-50/90 text-emerald-900 shadow-emerald-900/5'
    : 'border-emerald-100 bg-white text-stone-900 shadow-stone-200/60';

  useEffect(() => {
    setReceiptAccepted(loadAcceptedReceipts().has(invoice.id));
  }, [invoice.id]);

  async function copyValue(value: string, field: string) {
    await navigator.clipboard?.writeText(value).catch(() => undefined);
    setCopiedField(field);
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
      setCopiedField(null);
    }, 1200);
  }

  return (
    <div
      className={`relative mt-2 max-w-xl overflow-hidden rounded-[1.85rem] border shadow-lg transition duration-300 ${
        own ? 'border-white/25 bg-white/10 text-white shadow-stone-950/10' : 'border-brand/20 bg-white text-stone-900 shadow-stone-200/60 dark:border-stone-700 dark:bg-stone-900'
      }`}
    >
      <div className="pointer-events-none absolute left-0 right-0 top-[108px] h-px border-t border-dashed border-stone-300/70 dark:border-stone-700" />
      <div className="pointer-events-none absolute -left-3 top-[96px] h-6 w-6 rounded-full bg-stone-50 dark:bg-stone-950" />
      <div className="pointer-events-none absolute -right-3 top-[96px] h-6 w-6 rounded-full bg-stone-50 dark:bg-stone-950" />

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
                <span className="block text-[11px] font-medium text-stone-400">защищённый документ</span>
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone}`}>
              {INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}
            </span>
          </div>
          {invoice.description && <p className="mt-3 break-words text-xs leading-5 text-stone-600">{invoice.description}</p>}
          <div className="mt-3 grid gap-2 rounded-[1rem] bg-stone-50 p-2 text-[11px] text-stone-500 dark:bg-stone-800">
            <CopyRow
              label="ID"
              value={invoice.id}
              copied={copied && copiedField === 'id'}
              onCopy={() => copyValue(invoice.id, 'id')}
            />
            <CopyRow
              label="Сумма"
              value={money(invoice.amount, invoice.currency)}
              copied={copied && copiedField === 'amount'}
              onCopy={() => copyValue(`${invoice.amount} ${invoice.currency}`, 'amount')}
            />
          </div>
          {invoice.payAddress && pending && (
            <div className="mt-3 grid gap-2 rounded-[1rem] bg-white p-2 text-[11px] text-stone-500 ring-1 ring-brand/10 dark:bg-stone-800">
              <CopyRow
                label="Оплата"
                value={paymentLine ?? money(invoice.amount, invoice.currency)}
                copied={copied && copiedField === 'pay-amount'}
                onCopy={() => copyValue(paymentLine ?? `${invoice.amount} ${invoice.currency}`, 'pay-amount')}
                accent
              />
              <CopyRow
                label="Адрес"
                value={invoice.payAddress}
                copied={copied && copiedField === 'address'}
                onCopy={() => copyValue(invoice.payAddress ?? '', 'address')}
              />
            </div>
          )}
        </div>
      </div>

      {pending && canPay && (
        <div className="grid gap-2 border-t border-stone-100 bg-white/90 p-3 dark:border-stone-700 dark:bg-stone-900">
          <button type="button" onClick={() => onPayIntent?.(invoice)} className="primary-action px-4 py-2.5 text-sm">
            Оплатить счёт
          </button>
          {onDownloadPdf && (
            <button type="button" onClick={() => onDownloadPdf(invoice)} className="secondary-action w-full justify-center px-4 py-2 text-sm">
              Скачать PDF-счёт
            </button>
          )}
          <p className="flex gap-2 text-xs leading-5 text-stone-500">
            <BalanceEscrowIcon className="h-5 w-5 shrink-0" />
            После оплаты провайдер подтвердит перевод, а сумма уйдёт в эскроу.
          </p>
        </div>
      )}
      {pending && !canPay && (
        <div className="grid gap-2 border-t border-stone-100 bg-white/70 p-3 text-xs leading-5 text-stone-500 dark:border-stone-700 dark:bg-stone-900">
          <p>Счёт отправлен заказчику. Когда платёж подтвердится, здесь появится чек.</p>
          {onDownloadPdf && (
            <button type="button" onClick={() => onDownloadPdf(invoice)} className="secondary-action w-full justify-center px-4 py-2 text-sm">
              Скачать PDF-счёт
            </button>
          )}
        </div>
      )}
      {paid && (
        <div className="border-t border-dashed border-emerald-200 bg-white/82 p-3 dark:border-stone-700 dark:bg-stone-900">
          <div
            className={`relative overflow-hidden rounded-[1.45rem] border p-3 shadow-lg transition duration-500 ${
              receiptAccepted ? 'translate-y-2 rotate-[-0.4deg]' : 'translate-y-0'
            } ${receiptCardTone} dark:border-emerald-900/50 dark:bg-stone-800 dark:text-stone-100`}
          >
            <div className="pointer-events-none absolute left-0 right-0 top-11 border-t border-dashed border-emerald-200 dark:border-emerald-900/60" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-600">
                  {receiptAccepted ? 'Чек принят' : 'Чек готов к приёмке'}
                </p>
                <p className="mt-4 font-serif text-2xl leading-none text-stone-950 dark:text-stone-50">{money(invoice.amount, invoice.currency)}</p>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.1rem] bg-emerald-100 text-emerald-700 shadow-sm dark:bg-emerald-950/60">
                <MailCheckIcon className="h-7 w-7" />
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-[1rem] bg-white/70 px-3 py-2 dark:bg-stone-900">
                <span className="block font-semibold uppercase tracking-[0.12em] text-stone-400">Документ</span>
                <span className="mt-1 block break-all font-mono text-stone-700 dark:text-stone-200">RC-{shortId}</span>
              </div>
              <div className="rounded-[1rem] bg-white/70 px-3 py-2 dark:bg-stone-900">
                <span className="block font-semibold uppercase tracking-[0.12em] text-stone-400">Статус</span>
                <span className="mt-1 block font-semibold text-emerald-700 dark:text-emerald-300">
                  {receiptAccepted ? 'использован' : 'ожидает принятия'}
                </span>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-stone-600 dark:text-stone-300">
              {receiptAccepted
                ? 'Чек принят и остаётся в истории сделки, чате и кошельке.'
                : 'Оплата подтверждена. Примите чек, чтобы визуально закрыть платёж в переписке.'}
            </p>
            <div
              className={`mt-3 rounded-b-[1.15rem] border-t border-dashed px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.16em] transition duration-500 ${
                receiptAccepted
                  ? 'translate-y-1 border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-200'
                  : 'border-stone-200 bg-stone-50 text-stone-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-500'
              }`}
            >
              {receiptAccepted ? 'чек принят / использован' : 'чек ожидает приёмки'}
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setReceiptAccepted(true);
                rememberAcceptedReceipt(invoice.id);
              }}
              disabled={receiptAccepted}
              className="primary-action justify-center px-4 py-2 text-sm disabled:opacity-65"
            >
              {receiptAccepted ? 'Чек принят' : 'Принять чек'}
            </button>
            {onDownloadPdf && (
              <button type="button" onClick={() => onDownloadPdf(invoice)} className="secondary-action w-full justify-center px-4 py-2 text-sm">
                Скачать PDF-чек
              </button>
            )}
          </div>
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

function CopyRow({
  label,
  value,
  copied,
  onCopy,
  accent,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  accent?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className={`font-semibold uppercase tracking-[0.12em] ${accent ? 'text-brand' : 'text-stone-400'}`}>{label}</span>
        <button type="button" onClick={onCopy} className="font-semibold text-brand hover:text-brand-dark">
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      <p className="break-all font-mono text-stone-600 dark:text-stone-300">{value}</p>
    </div>
  );
}
