export function CategoriesNavIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <rect x="11" y="12" width="18" height="18" rx="5" fill="#F0E5CF" stroke="#1A1A1A" strokeWidth="3" />
      <rect x="35" y="12" width="18" height="18" rx="5" fill="#C8D3C6" stroke="#1A1A1A" strokeWidth="3" />
      <rect x="11" y="36" width="18" height="18" rx="5" fill="#D7D5E8" stroke="#1A1A1A" strokeWidth="3" />
      <rect x="35" y="36" width="18" height="18" rx="5" fill="#F2C6B8" stroke="#1A1A1A" strokeWidth="3" />
    </svg>
  );
}
