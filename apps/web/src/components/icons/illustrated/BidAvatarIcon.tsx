export function BidAvatarIcon({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <rect x="15" y="13" width="70" height="74" rx="26" fill="#F0E5CF" stroke="#1A1A1A" strokeWidth="4" />
      <circle cx="50" cy="39" r="14" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="4" />
      <path d="M30 76c4.2-15.2 11.4-22.4 20-22.4S65.8 60.8 70 76" stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" />
      <path d="M70 18h11M75.5 12.5v11" stroke="#CC785C" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="25" cy="24" r="5" fill="#D7D5E8" stroke="#1A1A1A" strokeWidth="3" />
    </svg>
  );
}
