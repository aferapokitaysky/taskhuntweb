import Link from 'next/link';
import type { Order } from '@/lib/types';
import { money } from '@/lib/types';
import { BoostIcon } from '@/components/icons/BoostIcon';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';

/** Карточка заказа для read-only контекстов (поиск, витрины) — без
 * действий вроде "Откликнуться"/избранного, только просмотр и переход. */
export function OrderCard({ order }: { order: Order }) {
  return (
    <article className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href={`/orders/${order.id}`} className="text-lg font-semibold hover:text-brand">
              {order.title}
            </Link>
            {order.isPromoted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                <BoostIcon className="h-3 w-3" />
                Продвигается
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-stone-600">{order.description}</p>
          {order.tags && order.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {order.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-card-sand px-2 py-0.5 text-xs text-stone-700">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="font-semibold">{money(order.budgetMin, order.currency)}</p>
          <OrderStatusBadge status={order.status} className="mt-1" />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full bg-stone-100 px-3 py-1">{order.category?.name ?? 'Категория'}</span>
        <span className="text-stone-500">Откликов: {order._count?.bids ?? order.bids?.length ?? 0}</span>
      </div>
    </article>
  );
}
