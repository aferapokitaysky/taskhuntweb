// Google Analytics 4 через Consent Mode v2 — gtag.js грузится всегда (см.
// layout.tsx), но по умолчанию с analytics_storage: 'denied', так что до
// явного согласия пользователя (CookieConsent.tsx) ни один трекинговый
// cookie не пишется и персональные данные не уходят в GA (Google всё равно
// получает обезличенные "consent-less pings" для моделирования — это
// ожидаемое поведение Consent Mode, не баг). CONSENT_STORAGE_KEY
// сознательно отделён от старого 'cookie-consent-acknowledged' — тот
// значит только "видел баннер", а этот — конкретно "разрешил аналитику".

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export const ANALYTICS_CONSENT_STORAGE_KEY = 'analytics-consent';

export type AnalyticsConsent = 'granted' | 'denied';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function setAnalyticsConsent(consent: AnalyticsConsent) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, consent);
  window.gtag?.('consent', 'update', { analytics_storage: consent });
}
