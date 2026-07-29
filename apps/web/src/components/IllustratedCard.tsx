import type { ReactNode } from 'react';

const BACKGROUNDS = {
  lavender: 'bg-card-lavender',
  rose: 'bg-card-rose',
  sage: 'bg-card-sage',
  olive: 'bg-card-olive',
  sand: 'bg-card-sand',
} as const;

export type IllustratedCardColor = keyof typeof BACKGROUNDS;

/**
 * Карточка-иллюстрация: скруглённый пастельный квадрат с чёрно-белой
 * SVG-иконкой в духе рисованных карточек — общий строительный блок для
 * лендинга/фич-секций. Цвет фона задаётся именем из палитры card.* в
 * tailwind.config.ts, не сырым hex — так все карточки на странице всегда
 * остаются в одной согласованной палитре.
 */
export function IllustratedCard({
  icon,
  title,
  description,
  color = 'sand',
  className = '',
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  color?: IllustratedCardColor;
  className?: string;
}) {
  return (
    <div
      className={`group flex flex-col gap-4 rounded-3xl p-6 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg ${BACKGROUNDS[color]} ${className}`}
    >
      <div className="flex h-20 w-20 items-center justify-center transition-transform duration-300 group-hover:animate-wiggle">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
        {description && <p className="mt-1 text-sm leading-relaxed text-stone-700">{description}</p>}
      </div>
    </div>
  );
}
