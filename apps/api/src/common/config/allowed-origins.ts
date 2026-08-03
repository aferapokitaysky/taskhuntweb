// WEB_PUBLIC_URL остаётся канонiчным URL для редиректов/писем (OAuth callback,
// verify-email, reset-password — там нужен ровно один адрес). Для CORS же
// нужен список: локально фронт (Codex) поднимается то на 3000, то на 3050,
// и preview/staging-домены добавляются без пересборки образа.
// WEB_PUBLIC_URLS — через запятую, имеет приоритет; если не задан, список
// собирается из WEB_PUBLIC_URL + дефолтных локальных origin'ов (только вне
// production, см. CODEX_CLAUDE_SYNC.md Request 001).
const LOCAL_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3050',
  'http://127.0.0.1:3050',
];

export function getAllowedOrigins(): string[] {
  const list = process.env.WEB_PUBLIC_URLS;
  if (list) {
    return list
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  const origins = new Set<string>();
  if (process.env.WEB_PUBLIC_URL) origins.add(process.env.WEB_PUBLIC_URL);
  if (process.env.NODE_ENV !== 'production') {
    for (const origin of LOCAL_DEV_ORIGINS) origins.add(origin);
  }
  return [...origins];
}

export function createCorsOriginValidator(): (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void {
  const allowedOrigins = new Set(getAllowedOrigins());
  return (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS origin is not allowed: ${origin}`));
  };
}
