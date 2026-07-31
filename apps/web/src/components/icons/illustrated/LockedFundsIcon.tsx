/** Заблокированные средства — сейф с печатью, для карточки баланса. */
export function LockedFundsIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <rect x="18" y="30" width="64" height="50" rx="16" fill="#FCEBEA" stroke="#1A1A1A" strokeWidth="4" />
      <path d="M34 30v-6c0-10 7-16 16-16s16 6 16 16v6" stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" />
      <circle cx="50" cy="55" r="12" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="4" />
      <path d="M50 50v8" stroke="#CC785C" strokeWidth="4" strokeLinecap="round" />
      <path d="M42 68h16" stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" />
      <circle cx="75" cy="28" r="10" fill="#D7D5E8" stroke="#1A1A1A" strokeWidth="3.5" />
      <path d="M72 28h6" stroke="#CC785C" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
