export function SupportNavIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <path d="M14 29a18 18 0 0 1 36 0v9a10 10 0 0 1-10 10h-5" stroke="#1A1A1A" strokeWidth="3.4" strokeLinecap="round" />
      <rect x="8" y="27" width="11" height="18" rx="5" fill="#C8D3C6" stroke="#1A1A1A" strokeWidth="3" />
      <rect x="45" y="27" width="11" height="18" rx="5" fill="#F2C6B8" stroke="#1A1A1A" strokeWidth="3" />
      <rect x="26" y="44" width="12" height="7" rx="3.5" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3" />
      <path d="M26 22h12M25 31h14" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
