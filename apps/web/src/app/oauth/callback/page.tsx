'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { saveTokens } from '@/lib/api';

function OAuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (accessToken && refreshToken) {
      saveTokens(accessToken, refreshToken);
      // Различить первый/повторный вход через OAuth сейчас нельзя (бэк не
      // сообщает об этом отдельно) — ведём на dashboard; онбординг всегда
      // можно пройти позже вручную.
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [params, router]);

  return <p className="text-sm text-slate-500">Входим…</p>;
}

export default function OAuthCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Suspense fallback={<p className="text-sm text-slate-500">Входим…</p>}>
        <OAuthCallbackInner />
      </Suspense>
    </main>
  );
}
