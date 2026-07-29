/** FAQ — знак вопроса в овале, контурная иконка в общем чернильном стиле. */
export function FaqIcon({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <ellipse cx="50" cy="50" rx="30" ry="42" stroke="#1A1A1A" strokeWidth="4" />
      <path
        d="M39 38 C39 28 61 28 61 40 C61 48 50 48 50 58"
        stroke="#1A1A1A"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="50" cy="72" r="3.5" fill="#1A1A1A" />
    </svg>
  );
}
