'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { saveTokens } from '@/lib/api';
import { AuthShell } from '@/components/AuthShell';
import { Mascot } from '@/components/Mascot';

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

export default function OAuthCallbackClient() {
  return (
    <AuthShell
      eyebrow="OAuth"
      title="Завершаем безопасный вход"
      description="Проверяем ответ провайдера и переносим вас в рабочее пространство."
    >
      <div className="flex flex-col items-center justify-center gap-6 py-8">
        <div className="animate-float">
          <Mascot name="hello" size="h-20 w-20" />
        </div>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full w-1/3 animate-loading-bar rounded-full bg-brand" />
        </div>
        <Suspense fallback={<p className="text-sm text-stone-500">Входим…</p>}>
          <OAuthCallbackInner />
        </Suspense>
      </div>
    </AuthShell>
  );
}
