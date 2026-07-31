export function OrdersNavIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <rect x="14" y="12" width="36" height="42" rx="7" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3.2" />
      <path d="M23 24h18M23 34h14M23 44h10" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
      <circle cx="48" cy="18" r="9" fill="#CC785C" stroke="#1A1A1A" strokeWidth="3" />
      <path d="M48 13v10M43 18h10" stroke="#FDFCFA" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
