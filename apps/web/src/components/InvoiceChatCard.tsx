'use client';

import type { Invoice } from '@/lib/types';
import { money } from '@/lib/types';
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
  const paid = invoice.status === 'PAID';
  const pending = invoice.status === 'PENDING';

  return (
    <div
      className={`mt-2 overflow-hidden rounded-[1.5rem] border shadow-sm ${
        own ? 'border-white/25 bg-white/10 text-white' : 'border-brand/20 bg-white text-stone-900'
      }`}
    >
      <div className={`p-4 ${paid ? 'bg-card-sage/70' : 'bg-card-sand/70'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand">{paid ? 'Чек оплаты' : 'Счёт TaskHunt'}</p>
            <p className="mt-1 font-serif text-3xl leading-none text-stone-950">{money(invoice.amount, invoice.currency)}</p>
          </div>
          <Mascot name={paid ? 'successConfetti' : 'invoiceCoin'} size="h-14 w-14" />
        </div>
        <div className="mt-4 rounded-[1.2rem] bg-white/80 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-serif text-lg text-stone-950">taskhunt</span>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${paid ? 'bg-emerald-100 text-emerald-700' : 'bg-brand/10 text-brand'}`}>
              {INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}
            </span>
          </div>
          {invoice.description && <p className="mt-2 text-xs leading-5 text-stone-600">{invoice.description}</p>}
          <p className="mt-2 break-all text-[11px] text-stone-400">ID: {invoice.id}</p>
        </div>
      </div>

      {pending && canPay && (
        <div className="grid gap-2 border-t border-stone-100 bg-white/90 p-3">
          <button type="button" onClick={() => onPayIntent?.(invoice)} className="primary-action px-4 py-2.5 text-sm">
            Оплатить счёт
          </button>
          <p className="text-xs leading-5 text-stone-500">После оплаты провайдер подтвердит перевод, а сумма уйдёт в эскроу.</p>
        </div>
      )}
      {pending && !canPay && (
        <div className="border-t border-stone-100 bg-white/70 p-3 text-xs leading-5 text-stone-500">
          Счёт отправлен заказчику. Когда платёж подтвердится, здесь появится чек.
        </div>
      )}
      {paid && (
        <div className="border-t border-stone-100 bg-white/80 p-3 text-xs leading-5 text-emerald-700">
          Оплата подтверждена, средства находятся под защитой TaskHunt до приёмки работы.
        </div>
      )}
    </div>
  );
}
