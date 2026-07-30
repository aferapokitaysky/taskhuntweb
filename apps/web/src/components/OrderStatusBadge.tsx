import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from '@/lib/orderStatus';

export function OrderStatusBadge({ status, className = '' }: { status: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_COLORS[status] ?? 'bg-stone-100 text-stone-600'} ${className}`}
    >
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}
