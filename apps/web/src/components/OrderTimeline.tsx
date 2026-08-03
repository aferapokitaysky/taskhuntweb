import { CheckCircleIcon } from '@/components/icons/CheckCircleIcon';
import type { Order } from '@/lib/types';

const HAPPY_PATH: { key: Order['status']; label: string }[] = [
  { key: 'OPEN', label: 'Открыт' },
  { key: 'IN_PROGRESS', label: 'В работе' },
  { key: 'IN_REVIEW', label: 'На проверке' },
  { key: 'COMPLETED', label: 'Завершён' },
];

export function OrderTimeline({ status }: { status: Order['status'] }) {
  if (status === 'DRAFT') return null;

  if (status === 'CANCELLED' || status === 'EXPIRED') {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-500">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-stone-400" />
        {status === 'CANCELLED' ? 'Заказ отменён до завершения.' : 'Срок заказа истёк без завершения.'}
      </div>
    );
  }

  const isDisputed = status === 'DISPUTED';
  const effectiveIndex = isDisputed
    ? HAPPY_PATH.findIndex((s) => s.key === 'IN_REVIEW')
    : HAPPY_PATH.findIndex((s) => s.key === status);

  return (
    <div className="flex items-start">
      {HAPPY_PATH.map((step, i) => {
        const done = i < effectiveIndex || (i === effectiveIndex && status === 'COMPLETED');
        const current = i === effectiveIndex && status !== 'COMPLETED';
        return (
          <div key={step.key} className="flex flex-1 items-start last:flex-none">
            <div className="flex w-16 flex-col items-center gap-1.5 sm:w-24">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                  done
                    ? 'border-brand bg-brand text-white'
                    : current && isDisputed
                      ? 'border-red-400 bg-red-50 text-red-600'
                      : current
                        ? 'border-brand bg-white text-brand'
                        : 'border-stone-300 bg-white text-stone-400'
                }`}
              >
                {done ? <CheckCircleIcon className="h-4 w-4" /> : <span className="text-xs font-semibold">{i + 1}</span>}
              </div>
              <span
                className={`text-center text-[11px] font-medium leading-tight ${
                  current && isDisputed
                    ? 'text-red-600'
                    : done || current
                      ? 'text-stone-900'
                      : 'text-stone-400'
                }`}
              >
                {current && isDisputed ? 'Спор' : step.label}
              </span>
            </div>
            {i < HAPPY_PATH.length - 1 && (
              <div className={`mx-1 mt-3.5 h-0.5 flex-1 ${i < effectiveIndex ? 'bg-brand' : 'bg-stone-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
