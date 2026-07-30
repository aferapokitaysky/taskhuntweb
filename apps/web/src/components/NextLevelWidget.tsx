import { FreelancerLevelBadge, type FreelancerLevel } from '@/components/FreelancerLevelBadge';
import { pluralize } from '@/lib/pluralize';

interface NextLevelTarget {
  label: string;
  minOrders: number;
  minSuccessRate: number;
}

const RISING_TALENT: NextLevelTarget = { label: 'Rising Talent', minOrders: 3, minSuccessRate: 90 };
const TOP_RATED: NextLevelTarget = { label: 'Top Rated', minOrders: 10, minSuccessRate: 95 };

export function NextLevelWidget({
  level,
  completedOrders,
  successRate,
}: {
  level: FreelancerLevel;
  completedOrders: number;
  successRate: number | null;
}) {
  if (level === 'TOP_RATED') {
    return (
      <section className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <FreelancerLevelBadge level={level} />
          <p className="text-sm text-stone-600">Вы достигли максимального уровня — так держать!</p>
        </div>
      </section>
    );
  }

  const target = level === 'RISING_TALENT' ? TOP_RATED : RISING_TALENT;
  const rate = successRate ?? 0;
  const ordersProgress = Math.min(1, completedOrders / target.minOrders);
  const rateProgress = Math.min(1, rate / target.minSuccessRate);
  const overallProgress = Math.round(Math.min(ordersProgress, rateProgress) * 100);
  const ordersLeft = Math.max(0, target.minOrders - completedOrders);

  return (
    <section className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-900">До уровня {target.label}</h2>
        <FreelancerLevelBadge level={level} />
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${overallProgress}%` }} />
      </div>
      <p className="mt-2 text-xs text-stone-500">
        {ordersLeft > 0
          ? `Ещё ${ordersLeft} завершённых ${pluralize(ordersLeft, ['заказ', 'заказа', 'заказов'])} и рейтинг успеха от ${target.minSuccessRate}%`
          : `Держите рейтинг успеха от ${target.minSuccessRate}%, чтобы получить уровень`}
      </p>
    </section>
  );
}
