export function AdminNavIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <path d="M32 8l20 8v13c0 13-8 22-20 27-12-5-20-14-20-27V16z" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M24 32l5 5 12-13" stroke="#CC785C" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
