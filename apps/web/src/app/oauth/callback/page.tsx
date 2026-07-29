'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { saveTokens } from '@/lib/api';
import { Logo } from '@/components/Logo';

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

  return <p className="text-sm text-stone-500">Входим…</p>;
}

export default function OAuthCallbackPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <div className="animate-float">
        <Logo withWordmark={false} className="h-12 w-12" />
      </div>
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full w-1/3 animate-loading-bar rounded-full bg-brand" />
      </div>
      <Suspense fallback={<p className="text-sm text-stone-500">Входим…</p>}>
        <OAuthCallbackInner />
      </Suspense>
    </main>
  );
}
