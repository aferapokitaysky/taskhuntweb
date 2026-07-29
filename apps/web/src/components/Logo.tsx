/**
 * Бренд-знак — фирменный маскот-слонёнок с бивнем.
 * `withWordmark` решает, какой из двух исходников (apps/web/public/)
 * рендерить: полный лендинг-лого с надписью "taskhunt" внутри самой
 * картинки (logo-full.png, широкий формат) для мест с текстом, или
 * только квадратная мордочка (logo-mark.png) для компактных/icon-only
 * контекстов (favicon-подобные места, лоадеры) — рисовать текст поверх
 * второй раз поверх logo-full смысла нет, он уже в самой картинке.
 */
export function Logo({ withWordmark = true, className = '' }: { withWordmark?: boolean; className?: string }) {
  if (withWordmark) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/logo-full.png" alt="TaskHunt" className={`${className || 'h-9'} w-auto object-contain`} />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo-mark.png" alt="TaskHunt" className={`${className || 'h-9 w-9'} aspect-square object-contain`} />
  );
}
