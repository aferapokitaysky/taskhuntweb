export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
}

export function getStoredAccessToken(): string | null {
  return getAccessToken();
}

export function saveTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}

function clearTokensAndRedirect() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

// accessToken живёт 15 минут (см. auth.service.ts) — на странице заказа/чата
// пользователь легко сидит дольше, и без обновления токена каждый запрос
// после экспирации тихо падал с 401, а большинство вызовов в компонентах
// глотают ошибку через .catch(() => ...) — снаружи это выглядело как
// "чат не открывается"/"уведомления не приходят" без единого сообщения об
// ошибке. Один общий promise на все параллельные 401 — чтобы 5 одновременных
// запросов не дёргали /auth/refresh пятью гонками и не перезаписывали токен
// друг другом.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      saveTokens(data.accessToken, data.refreshToken);
      return data.accessToken as string;
    } catch {
      return null;
    }
  })();
  const result = await refreshPromise;
  refreshPromise = null;
  return result;
}

function isExpiredOrExpiringSoon(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 < Date.now() + 10_000;
  } catch {
    return false;
  }
}

/**
 * Для socket.io: коннект аутентифицируется токеном один раз при установке
 * соединения, а не на каждый запрос, поэтому обычный ретрай на 401 (как в
 * api()) тут не работает — нужно освежить токен ДО того, как сокет
 * попытается подключиться с уже протухшим.
 */
export async function ensureFreshAccessToken(): Promise<string | null> {
  const token = getAccessToken();
  if (!token) return null;
  if (!isExpiredOrExpiringSoon(token)) return token;
  return refreshAccessToken();
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const retryRes = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
          ...options.headers,
        },
      });
      if (!retryRes.ok) {
        const body = await retryRes.json().catch(() => ({}));
        throw new Error(body.message ?? `Request failed: ${retryRes.status}`);
      }
      return retryRes.json();
    }
    clearTokensAndRedirect();
    throw new Error('Сессия истекла, войдите заново');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Скачивание файлов с эндпоинтов, требующих Authorization-заголовок —
 * обычный `<a href>` не может его передать, поэтому качаем как blob и
 * кликаем по временной ссылке. Общий хэлпер для GDPR-экспорта и
 * PDF-чеков (оба требуют авторизации).
 */
export async function downloadFile(path: string, filename: string): Promise<void> {
  let token = getAccessToken();
  let res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401 && token) {
    token = await refreshAccessToken();
    if (!token) {
      clearTokensAndRedirect();
      throw new Error('Сессия истекла, войдите заново');
    }
    res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export interface UploadedFileAsset {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'IMAGE' | 'VIDEO' | 'ARCHIVE' | 'DOCUMENT' | 'EXECUTABLE' | 'OTHER';
  scanStatus: 'PENDING' | 'CLEAN' | 'INFECTED';
}

/**
 * Отдельная функция вместо api(): загрузка файла — multipart/form-data,
 * а не JSON, поэтому нельзя переиспользовать общий хелпер с
 * захардкоженным Content-Type: application/json (для FormData браузер
 * сам проставляет корректный Content-Type с boundary).
 */
export async function uploadFile(file: File): Promise<UploadedFileAsset> {
  let token = getAccessToken();
  const formData = new FormData();
  formData.append('file', file);

  let res = await fetch(`${API_URL}/files/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  if (res.status === 401 && token) {
    token = await refreshAccessToken();
    if (!token) {
      clearTokensAndRedirect();
      throw new Error('Сессия истекла, войдите заново');
    }
    res = await fetch(`${API_URL}/files/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Upload failed: ${res.status}`);
  }

  return res.json();
}

export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  let token = getAccessToken();
  const formData = new FormData();
  formData.append('avatar', file);

  let res = await fetch(`${API_URL}/users/me/avatar`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  if (res.status === 401 && token) {
    token = await refreshAccessToken();
    if (!token) {
      clearTokensAndRedirect();
      throw new Error('Сессия истекла, войдите заново');
    }
    res = await fetch(`${API_URL}/users/me/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Upload failed: ${res.status}`);
  }

  return res.json();
}

/** Возвращает id/name — сохранённый или только что созданный (find-or-create на бэке). */
export async function createSkill(name: string): Promise<{ id: string; name: string; slug: string }> {
  return api('/skills', { method: 'POST', body: JSON.stringify({ name }) });
}
