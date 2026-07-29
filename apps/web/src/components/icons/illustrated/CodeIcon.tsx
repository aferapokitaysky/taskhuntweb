/** Разработка — окно редактора кода с `</>`, вместо прежней речи-репличики
 * (у той хвостик визуально наезжал на скобку на маленьком размере). */
export function CodeIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <rect x="14" y="18" width="72" height="62" rx="10" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="4" strokeLinejoin="round" />
      <path d="M14 36 H86" stroke="#1A1A1A" strokeWidth="4" />
      <circle cx="25" cy="27" r="3.5" fill="#CC785C" />
      <circle cx="38" cy="27" r="3.5" fill="#1A1A1A" fillOpacity="0.15" />
      <path d="M40 50 L28 60 L40 70" stroke="#1A1A1A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M60 50 L72 60 L60 70" stroke="#1A1A1A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
