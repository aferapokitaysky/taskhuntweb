const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const apiOrigin = new URL(apiUrl).origin;
const apiWsOrigin = apiOrigin.replace(/^http/, 'ws');

// CSP собирается из реального API-origin (не хардкод localhost), чтобы
// работать и в dev, и после смены на прод-домен без правок этого файла —
// см. NEXT_PUBLIC_API_URL. unsafe-inline нужен для инлайн-скрипта темы
// (layout.tsx, no-flash) и инлайн style={{}} у прогресс-баров/порталов
// (OrderTimeline, NextLevelWidget, NotificationBell) — без nonce/hash-CSP
// строже не сделать, не усложняем этим раундом.
// unsafe-eval — ТОЛЬКО для dev: webpack в режиме разработки (eval-source-map)
// гидратирует чанки через eval(), без этого React молча не гидратируется
// (клиентские страницы с useEffect зависают на loading-состоянии). В проде
// (next build) eval не используется — там эта директива не нужна и не даётся.
const scriptSrc = process.env.NODE_ENV === 'production' ? `'self' 'unsafe-inline'` : `'self' 'unsafe-inline' 'unsafe-eval'`;
const csp = [
  `default-src 'self'`,
  `script-src ${scriptSrc}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: ${apiOrigin} https:`,
  `font-src 'self' data:`,
  `connect-src 'self' ${apiOrigin} ${apiWsOrigin}`,
  `frame-ancestors 'none'`,
  `object-src 'none'`,
  `base-uri 'self'`,
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // standalone-выход — для Docker-образа (apps/web/Dockerfile): в runtime-слой
  // копируется только .next/standalone (уже с нужными node_modules), а не
  // весь workspace целиком.
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
