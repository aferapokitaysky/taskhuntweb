/**
 * Бренд-знак — маскот с рюкзаком, машет рукой. Для каждого варианта
 * (`withWordmark` решает между полным лого с надписью "taskhunt" и
 * компактной мордочкой без текста) есть светлая и тёмная версии
 * плашки — переключаются чистым CSS (`dark:`), без JS, чтобы компонент
 * оставался серверным и не мигал при гидратации.
 */
export function Logo({ withWordmark = true, className = '' }: { withWordmark?: boolean; className?: string }) {
  if (withWordmark) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-full.png"
          alt="TaskHunt"
          className={`${className || 'h-9'} w-auto object-contain dark:hidden`}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-full-dark.png"
          alt="TaskHunt"
          className={`hidden ${className || 'h-9'} w-auto object-contain dark:block`}
        />
      </>
    );
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-mark.png"
        alt="TaskHunt"
        className={`${className || 'h-9 w-9'} aspect-square object-contain dark:hidden`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-mark-dark.png"
        alt="TaskHunt"
        className={`hidden ${className || 'h-9 w-9'} aspect-square object-contain dark:block`}
      />
    </>
  );
}
