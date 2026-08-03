/**
 * Русское склонение числительных: [форма для 1, форма для 2-4, форма для 5+].
 * pluralize(1, ['заказ', 'заказа', 'заказов']) → 'заказ'
 * pluralize(3, ['заказ', 'заказа', 'заказов']) → 'заказа'
 * pluralize(11, ['заказ', 'заказа', 'заказов']) → 'заказов'
 */
export function pluralize(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return few;
  return many;
}
