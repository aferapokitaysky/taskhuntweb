/** Дизайн — палитра художника с каплями цвета, для карточки категории.
 * Собрана из примитивов (эллипс + круги), без ручных кривых — предыдущая
 * версия на одном сложном path получалась угловатой/неровной на глаз. */
export function DesignIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <ellipse cx="48" cy="53" rx="40" ry="34" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="4" />
      <circle cx="62" cy="65" r="10" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3" />
      <circle cx="27" cy="42" r="7" fill="#CC785C" stroke="#1A1A1A" strokeWidth="2.5" />
      <circle cx="48" cy="27" r="7" fill="#D7D5E8" stroke="#1A1A1A" strokeWidth="2.5" />
      <circle cx="69" cy="35" r="7" fill="#C7D3C9" stroke="#1A1A1A" strokeWidth="2.5" />
      <circle cx="30" cy="66" r="7" fill="#EDE1CE" stroke="#1A1A1A" strokeWidth="2.5" />
    </svg>
  );
}
