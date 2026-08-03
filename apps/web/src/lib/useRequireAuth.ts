'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getStoredAccessToken } from './api';

/**
 * Гейт для приватных страниц (личный кабинет, чаты, профиль и т.д.) —
 * без него анонимный визит по прямой ссылке просто рендерил пустую/сломанную
 * страницу (все запросы падали 401, а api.ts редиректит на /login только
 * когда токен ЕСТЬ, но невалиден/просрочен — у чистого анонима токена нет
 * вовсе, и та ветка не срабатывала). Истёкший/невалидный токен по-прежнему
 * обрабатывает api.ts (refresh -> logout), эта проверка — только на
 * полное отсутствие токена, синхронно до первого запроса за данными.
 */
export function useRequireAuth() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!getStoredAccessToken()) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
