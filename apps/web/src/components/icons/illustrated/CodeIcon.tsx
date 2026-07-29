/** Разработка — простой code-символ `</>` в облаке-репличке, чище прежней версии со скобками. */
export function CodeIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path
        d="M22 24 h56 a8 8 0 0 1 8 8 v32 a8 8 0 0 1 -8 8 h-30 l-16 16 v-16 h-10 a8 8 0 0 1 -8 -8 v-32 a8 8 0 0 1 8 -8 Z"
        fill="#FDFCFA"
        stroke="#1A1A1A"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M42 42 L30 54 L42 66" stroke="#1A1A1A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M58 42 L70 54 L58 66" stroke="#1A1A1A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
