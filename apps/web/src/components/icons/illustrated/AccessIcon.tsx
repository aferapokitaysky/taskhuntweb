/** Восстановление доступа — щит с замком, для страниц входа/сброса пароля. */
export function AccessIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path
        d="M50 8 L84 20 C84 50 72 76 50 90 C28 76 16 50 16 20 Z"
        fill="#FDFCFA"
        stroke="#1A1A1A"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <rect x="36" y="44" width="28" height="24" rx="4" fill="#CC785C" stroke="#1A1A1A" strokeWidth="3.5" />
      <path d="M42 44 V36 a8 8 0 0 1 16 0 v8" stroke="#1A1A1A" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <circle cx="50" cy="53" r="3.5" fill="#FDFCFA" />
      <path d="M50 56.5 L50 61" stroke="#FDFCFA" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
