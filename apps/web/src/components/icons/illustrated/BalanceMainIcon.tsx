/** Основной баланс — кошелёк с монетой в стиле TaskHunt. */
export function BalanceMainIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <rect x="14" y="24" width="68" height="52" rx="18" fill="#F0E5CF" stroke="#1A1A1A" strokeWidth="4" />
      <path d="M22 34h42c7 0 12 5 12 12v6" stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" />
      <rect x="56" y="43" width="26" height="22" rx="9" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="4" />
      <circle cx="66" cy="54" r="4" fill="#CC785C" />
      <circle cx="33" cy="27" r="10" fill="#D7D5E8" stroke="#1A1A1A" strokeWidth="3.5" />
      <path d="M33 22v10M28 27h10" stroke="#CC785C" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
