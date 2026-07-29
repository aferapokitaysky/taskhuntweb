'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'cookie-consent-acknowledged';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function acknowledge() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white px-4 py-4 shadow-lg">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-stone-600">
          Мы используем технически необходимые данные в браузере для работы сессии.{' '}
          <Link href="/privacy" className="text-brand hover:underline">
            Подробнее в политике конфиденциальности
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={acknowledge}
          className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
