export function ReferralNavIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <circle cx="19" cy="32" r="9" fill="#F0E5CF" stroke="#1A1A1A" strokeWidth="3" />
      <circle cx="45" cy="18" r="9" fill="#D7D5E8" stroke="#1A1A1A" strokeWidth="3" />
      <circle cx="45" cy="46" r="9" fill="#C8D3C6" stroke="#1A1A1A" strokeWidth="3" />
      <path d="M27 29l10-7M27 35l10 7" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
