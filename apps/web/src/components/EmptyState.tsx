import type { ReactNode } from 'react';

/** Пустое состояние списка — иконка + заголовок + подпись, вместо голого текста. */
export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return (
    <div className="interactive-card flex flex-col items-center gap-3 rounded-3xl border border-stone-100 bg-card-sand/60 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center opacity-80">{icon}</div>
      <p className="font-serif text-lg text-stone-900">{title}</p>
      {description && <p className="max-w-sm text-sm text-stone-600">{description}</p>}
    </div>
  );
}
