import type { Metadata } from 'next';
import { GoogleAnalytics } from '@next/third-parties/google';
import './globals.css';
import { CookieConsent } from '@/components/CookieConsent';
import { ToastProvider } from '@/components/Toast';
import { ANALYTICS_CONSENT_STORAGE_KEY, GA_MEASUREMENT_ID } from '@/lib/analytics';

const TAGLINE =
  'Крипто-эскроу вместо доверия на слово: бюджет заказчика заморожен в системе с первого отклика — вывод в крипте, без банковских очередей и заморозки на карте.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'),
  title: { default: 'TaskHunt — фриланс-биржа с крипто-эскроу', template: '%s — TaskHunt' },
  description: TAGLINE,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'TaskHunt',
    title: 'TaskHunt — фриланс-биржа с крипто-эскроу',
    description: TAGLINE,
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'TaskHunt' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TaskHunt — фриланс-биржа с крипто-эскроу',
    description: TAGLINE,
    images: ['/og-image.jpg'],
  },
};

const THEME_INIT_SCRIPT = `
  try {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
`;

// Google Consent Mode v2: должен выполниться ДО загрузки gtag.js (см.
// GoogleAnalytics ниже), поэтому — синхронный инлайн-скрипт, как и
// THEME_INIT_SCRIPT. По умолчанию 'denied' всегда, даже если человек уже
// когда-то согласился — сама загрузка страницы должна быть безопасной по
// умолчанию; согласие 'granted' применяется отдельным вызовом чуть ниже
// только если оно реально сохранено в localStorage.
const ANALYTICS_CONSENT_INIT_SCRIPT = `
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('consent', 'default', { analytics_storage: 'denied' });
  try {
    if (localStorage.getItem('${ANALYTICS_CONSENT_STORAGE_KEY}') === 'granted') {
      gtag('consent', 'update', { analytics_storage: 'granted' });
    }
  } catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {GA_MEASUREMENT_ID && (
          <>
            {/* eslint-disable-next-line @next/next/no-sync-scripts */}
            <script dangerouslySetInnerHTML={{ __html: ANALYTICS_CONSENT_INIT_SCRIPT }} />
            <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />
          </>
        )}
        <ToastProvider>
          {children}
          <CookieConsent />
        </ToastProvider>
      </body>
    </html>
  );
}
