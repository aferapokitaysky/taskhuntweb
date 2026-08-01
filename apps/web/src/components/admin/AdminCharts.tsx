'use client';

// Лёгкие самодельные SVG-графики без внешней зависимости (recharts и т.п.
// в проекте нет, тащить целую библиотеку ради нескольких графиков в
// админке не стоило) — просто bar/line на чистом SVG, тема/цвета совпадают
// с остальным UI.

const BRAND = '#CC785C';
const SAGE = '#8B9A72';
const LAVENDER = '#9C98C4';
const ROSE = '#C98A8A';
const MUTED = '#a8a29e';

export function BarChart({
  data,
  height = 220,
  valueFormatter = (v: number) => String(v),
  color = BRAND,
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  valueFormatter?: (value: number) => string;
  color?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-stone-400">Данных пока нет.</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d) => {
        const barHeight = Math.max((d.value / max) * (height - 40), 2);
        return (
          <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="text-[11px] font-semibold text-stone-600">{valueFormatter(d.value)}</span>
            <div
              className="w-full rounded-t-[0.6rem] transition-all"
              style={{ height: barHeight, backgroundColor: color, minWidth: 8 }}
              title={`${d.label}: ${valueFormatter(d.value)}`}
            />
            <span className="w-full truncate text-center text-[10px] text-stone-500" title={d.label}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function LineChart({
  series,
  height = 220,
  valueFormatter = (v: number) => String(v),
}: {
  series: Array<{ name: string; color: string; points: Array<{ label: string; value: number }> }>;
  height?: number;
  valueFormatter?: (value: number) => string;
}) {
  const points = series[0]?.points ?? [];
  if (points.length === 0) {
    return <p className="text-sm text-stone-400">Данных пока нет.</p>;
  }
  const width = Math.max(points.length * 28, 280);
  const allValues = series.flatMap((s) => s.points.map((p) => p.value));
  const max = Math.max(...allValues, 1);
  const padding = 24;
  const chartHeight = height - padding * 2;

  function pathFor(pts: Array<{ label: string; value: number }>) {
    return pts
      .map((p, i) => {
        const x = (i / Math.max(pts.length - 1, 1)) * (width - padding * 2) + padding;
        const y = height - padding - (p.value / max) * chartHeight;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  const step = Math.max(Math.ceil(points.length / 8), 1);

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="min-w-full">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e7e5e4" strokeWidth={1} />
        {series.map((s) => (
          <path key={s.name} d={pathFor(s.points)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {points.map((p, i) =>
          i % step === 0 ? (
            <text key={p.label} x={(i / Math.max(points.length - 1, 1)) * (width - padding * 2) + padding} y={height - 6} fontSize={9} fill={MUTED} textAnchor="middle">
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-xs text-stone-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
            {s.points.length > 0 && ` (сейчас: ${valueFormatter(s.points[s.points.length - 1].value)})`}
          </span>
        ))}
      </div>
    </div>
  );
}

export function FunnelChart({ steps }: { steps: Array<{ label: string; value: number }> }) {
  if (steps.length === 0) return null;
  const max = steps[0]?.value || 1;
  const colors = [BRAND, SAGE, LAVENDER, ROSE];
  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const percentOfMax = max > 0 ? Math.round((step.value / max) * 100) : 0;
        const percentOfPrev = i > 0 && steps[i - 1].value > 0 ? Math.round((step.value / steps[i - 1].value) * 100) : 100;
        return (
          <div key={step.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-700">{step.label}</span>
              <span className="text-stone-500">
                {step.value}
                {i > 0 && <span className="ml-1.5 text-stone-400">({percentOfPrev}% от предыдущего шага)</span>}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${percentOfMax}%`, backgroundColor: colors[i % colors.length] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
