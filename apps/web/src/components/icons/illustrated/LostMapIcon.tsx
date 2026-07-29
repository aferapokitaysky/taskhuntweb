/** Заблудились — карта со сломанным маршрутом, для страницы 404. */
export function LostMapIcon({ className = 'h-20 w-20' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path
        d="M14 24 L36 15 L64 24 L86 15 L86 76 L64 85 L36 76 L14 85 Z"
        fill="#FDFCFA"
        stroke="#1A1A1A"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M36 15 L36 76" stroke="#1A1A1A" strokeWidth="3" strokeDasharray="1 7" strokeLinecap="round" />
      <path d="M64 24 L64 85" stroke="#1A1A1A" strokeWidth="3" strokeDasharray="1 7" strokeLinecap="round" />
      <path
        d="M24 60 C30 50 34 66 40 56 C45 48 50 62 56 50"
        stroke="#CC785C"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray="6 5"
        fill="none"
      />
      <circle cx="70" cy="45" r="12" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3.5" />
      <path d="M65 40 L75 50 M75 40 L65 50" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
