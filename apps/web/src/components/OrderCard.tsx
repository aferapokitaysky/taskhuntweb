import Link from 'next/link';
import type { Order } from '@/lib/types';
import { money } from '@/lib/types';
import { BoostIcon } from '@/components/icons/BoostIcon';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';

/** Карточка заказа для read-only контекстов (поиск, витрины) — без
 * действий вроде "Откликнуться"/избранного, только просмотр и переход. */
export function OrderCard({ order }: { order: Order }) {
  return (
    <article className="interactive-card group min-w-0 rounded-[2rem] border border-stone-100 bg-white p-5 shadow-sm">
      <div className="flex h-full min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1 break-words text-xs font-medium uppercase tracking-wide text-stone-400">{order.category?.name ?? 'Категория'}</p>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Link href={`/orders/${order.id}`} className="min-w-0 max-w-full break-words text-lg font-semibold leading-snug text-stone-950 transition-colors hover:text-brand">
                {order.title}
              </Link>
              {order.isPromoted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 shadow-sm shadow-amber-200/70">
                  <BoostIcon className="h-3 w-3 animate-pulse-soft" />
                  Продвигается
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-3 break-words text-sm leading-6 text-stone-600">{order.description}</p>
          </div>
          <div className="min-w-0 shrink-0 text-right">
            <p className="break-words text-lg font-semibold leading-tight">{money(order.budgetMin, order.currency)}</p>
            <p className="text-xs text-stone-400">бюджет от</p>
          </div>
        </div>

        {order.tags && order.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {order.tags.slice(0, 5).map((tag) => (
              <span key={tag} className="max-w-full break-words rounded-full bg-card-sand px-2.5 py-1 text-xs font-medium text-stone-700">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-600">
              {order._count?.bids ?? order.bids?.length ?? 0} откликов
            </span>
            {typeof order.viewsCount === 'number' && (
              <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-600">{order.viewsCount} просмотров</span>
            )}
          </div>
          <Link href={`/orders/${order.id}`} className="font-semibold text-brand opacity-90 transition group-hover:translate-x-0.5 group-hover:opacity-100">
            Подробнее →
          </Link>
        </div>
      </div>
    </article>
  );
}
