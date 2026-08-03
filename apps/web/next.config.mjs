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
// GA4 (@next/third-parties, layout.tsx) грузит gtag.js с googletagmanager.com
// и шлёт события на google-analytics.com. static.cloudflareinsights.com —
// RUM-беакон, который Cloudflare сам инжектит в HTML, если в панели домена
// включена "Web Analytics" — не наш код, но CSP всё равно должен его пускать.
const csp = [
  `default-src 'self'`,
  `script-src ${scriptSrc} https://www.googletagmanager.com https://static.cloudflareinsights.com`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: ${apiOrigin} https:`,
  `font-src 'self' data:`,
  // api.github.com — публичный readonly GitHub API, дёргается напрямую с
  // клиента в GithubRepos.tsx (профиль фрилансера, вкладка GitHub).
  `connect-src 'self' ${apiOrigin} ${apiWsOrigin} https://api.github.com https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://cloudflareinsights.com`,
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
