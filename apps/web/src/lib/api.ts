export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export function getStoredAccessToken(): string | null {
  return getAccessToken();
}

export function saveTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
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
  const token = getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
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
  const token = getAccessToken();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_URL}/files/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Upload failed: ${res.status}`);
  }

  return res.json();
}

export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const token = getAccessToken();
  const formData = new FormData();
  formData.append('avatar', file);

  const res = await fetch(`${API_URL}/users/me/avatar`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

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
