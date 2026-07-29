/** Фрилансер — ящик с инструментами и звезда мастерства, для выбора роли при регистрации. */
export function FreelancerIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path
        d="M38 40 V28 a12 12 0 0 1 24 0 V40"
        stroke="#1A1A1A"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <rect x="16" y="40" width="68" height="42" rx="6" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="4" strokeLinejoin="round" />
      <path d="M16 58 H84" stroke="#1A1A1A" strokeWidth="3.5" />
      <rect x="42" y="52" width="16" height="14" rx="2" fill="#1A1A1A" />
      <circle cx="76" cy="24" r="17" fill="#CC785C" stroke="#1A1A1A" strokeWidth="4" />
      <path
        d="M76 15 L79 21 L86 22 L81 27 L82 34 L76 30 L70 34 L71 27 L66 22 L73 21 Z"
        fill="#FDFCFA"
        stroke="#1A1A1A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
