export const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  OPEN: 'Открыт',
  IN_PROGRESS: 'В работе',
  IN_REVIEW: 'На проверке',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
  DISPUTED: 'Спор',
  EXPIRED: 'Просрочен',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-stone-100 text-stone-600',
  OPEN: 'bg-emerald-100 text-emerald-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  IN_REVIEW: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-stone-100 text-stone-500',
  DISPUTED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-stone-100 text-stone-500',
};
