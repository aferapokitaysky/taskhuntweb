'use client';

import type { ReactNode } from 'react';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Отмена',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-stone-950/45 px-4 backdrop-blur-sm">
      <div className="premium-panel w-full max-w-md rounded-[2rem] p-5 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Подтверждение</p>
        <h2 className="mt-2 font-serif text-2xl text-stone-950">{title}</h2>
        <div className="mt-3 text-sm leading-6 text-stone-600">{description}</div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onCancel} disabled={busy} className="secondary-action px-4 py-3 text-sm font-semibold disabled:opacity-50">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className="primary-action px-4 py-3 text-sm font-semibold disabled:opacity-50">
            {busy ? 'Выполняем...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
