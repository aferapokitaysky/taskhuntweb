import { AlertIcon } from './icons/illustrated/AlertIcon';

/** Единый стиль сообщения об ошибке — вместо голого красного текста везде по приложению. */
export function ErrorNotice({ message, className = '' }: { message: string; className?: string }) {
  return (
    <div className={`mb-5 flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50/70 px-4 py-3 text-sm text-red-700 ${className}`}>
      <AlertIcon className="h-6 w-6 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
