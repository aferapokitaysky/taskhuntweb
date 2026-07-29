/** Письмо подтверждено — конверт с галочкой, для страницы верификации email. */
export function MailCheckIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <rect x="10" y="26" width="66" height="48" rx="6" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="4" strokeLinejoin="round" />
      <path d="M13 30 L43 54 L73 30" stroke="#1A1A1A" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="78" cy="66" r="18" fill="#CC785C" stroke="#1A1A1A" strokeWidth="4" />
      <path d="M69 66 L75 73 L88 58" stroke="#FDFCFA" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
