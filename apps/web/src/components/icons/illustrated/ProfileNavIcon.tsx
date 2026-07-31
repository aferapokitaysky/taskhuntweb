export function ProfileNavIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <circle cx="32" cy="23" r="11" fill="#FDFCFA" stroke="currentColor" strokeWidth="3.2" />
      <path d="M13 55c2.5-12 9.8-18 19-18s16.5 6 19 18" fill="#F0E5CF" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M45 14h7M48.5 10.5v7" stroke="#CC785C" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
