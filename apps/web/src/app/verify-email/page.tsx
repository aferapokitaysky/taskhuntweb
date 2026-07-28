'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

type Status = 'checking' | 'success' | 'error';

function VerifyEmailInner() {
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      return;
    }
    api(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [params]);

  if (status === 'checking') {
    return <p className="text-slate-500">Подтверждаем email…</p>;
  }

  if (status === 'success') {
    return (
      <div className="text-center">
        <h1 className="mb-3 text-2xl font-bold">Email подтверждён</h1>
        <p className="mb-6 text-slate-600">Аккаунт активирован, можно пользоваться платформой.</p>
        <Link href="/dashboard" className="rounded-lg bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark">
          В личный кабинет
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="mb-3 text-2xl font-bold">Ссылка недействительна</h1>
      <p className="mb-6 text-slate-600">Ссылка устарела или уже была использована.</p>
      <Link href="/login" className="rounded-lg border border-slate-300 px-6 py-3 font-medium hover:bg-slate-50">
        Войти
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={<p className="text-slate-500">Подтверждаем email…</p>}>
        <VerifyEmailInner />
      </Suspense>
    </main>
  );
}
