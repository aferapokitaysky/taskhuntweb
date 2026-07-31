export function FavoriteOrderIcon({ active = false, className = 'h-5 w-5' }: { active?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <path
        d="M32 9l6.4 13 14.3 2.1-10.4 10.1 2.5 14.2L32 41.7 19.2 48.4l2.5-14.2L11.3 24.1 25.6 22z"
        fill={active ? '#F5C96B' : '#FDFCFA'}
        stroke="#1A1A1A"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M44 11h8M48 7v8" stroke="#CC785C" strokeWidth="4" strokeLinecap="round" />
      <path d="M25 29l5 5 10-11" stroke={active ? '#1A1A1A' : '#CC785C'} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
