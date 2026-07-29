/** Колокольчик — рисованный от руки, чуть асимметричный, в общем чернильном стиле. */
export function BellIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.2c1 0 1.7.6 1.9 1.5 2.6.9 4.1 3.2 4 6.3-.1 3 .5 4.6 1.8 5.8.3.3.1.9-.4.9H4.7c-.5 0-.7-.6-.4-.9 1.3-1.2 1.8-2.7 1.7-5.7-.1-3.2 1.4-5.5 4-6.4.2-.9.9-1.5 2-1.5Z" />
      <path d="M9.4 20.3c.3.9 1.2 1.5 2.6 1.5s2.3-.6 2.6-1.5" />
    </svg>
  );
}
