/** Знак бренда — лупа с галочкой (нашли и закрыли задачу), в том же чернильном стиле, что и остальные иконки. */
function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <rect x="2" y="2" width="96" height="96" rx="26" fill="#CC785C" />
      <circle cx="42" cy="42" r="22" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="5" />
      <path d="M58 58 L78 78" stroke="#1A1A1A" strokeWidth="7" strokeLinecap="round" />
      <path d="M32 43 L39 50 L54 33" stroke="#1A1A1A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Logo({ withWordmark = true, className = '' }: { withWordmark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className="h-9 w-9 shrink-0" />
      {withWordmark && <span className="font-serif text-xl text-stone-900">TaskHunt</span>}
    </span>
  );
}
