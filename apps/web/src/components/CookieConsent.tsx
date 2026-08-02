'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GA_MEASUREMENT_ID, setAnalyticsConsent } from '@/lib/analytics';

const STORAGE_KEY = 'cookie-consent-acknowledged';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function acceptAll() {
    localStorage.setItem(STORAGE_KEY, '1');
    setAnalyticsConsent('granted');
    setVisible(false);
  }

  function necessaryOnly() {
    localStorage.setItem(STORAGE_KEY, '1');
    setAnalyticsConsent('denied');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookie-consent fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white px-4 py-4 shadow-lg">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-stone-600">
          Мы используем технически необходимые данные в браузере для работы сессии
          {GA_MEASUREMENT_ID && ', а с вашего согласия — обезличенную аналитику посещений'}.{' '}
          <Link href="/privacy" className="text-brand hover:underline">
            Подробнее в политике конфиденциальности
          </Link>
          .
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          {GA_MEASUREMENT_ID && (
            <button
              type="button"
              onClick={necessaryOnly}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
            >
              Только необходимые
            </button>
          )}
          <button
            type="button"
            onClick={acceptAll}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            {GA_MEASUREMENT_ID ? 'Принять всё' : 'Понятно'}
          </button>
        </div>
      </div>
    </div>
  );
}
