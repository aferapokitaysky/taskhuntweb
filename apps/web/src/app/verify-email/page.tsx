'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { MailCheckIcon } from '@/components/icons/illustrated/MailCheckIcon';

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
    return <p className="text-stone-500">Подтверждаем email…</p>;
  }

  if (status === 'success') {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 animate-float items-center justify-center">
          <MailCheckIcon className="h-16 w-16" />
        </div>
        <h1 className="mb-3 font-serif text-2xl text-stone-900">Email подтверждён</h1>
        <p className="mb-6 text-stone-600">Аккаунт активирован, можно пользоваться платформой.</p>
        <Link href="/dashboard" className="rounded-lg bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark">
          В личный кабинет
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center opacity-60">
        <MailCheckIcon className="h-16 w-16" />
      </div>
      <h1 className="mb-3 font-serif text-2xl text-stone-900">Ссылка недействительна</h1>
      <p className="mb-6 text-stone-600">Ссылка устарела или уже была использована.</p>
      <Link href="/login" className="rounded-lg border border-stone-300 px-6 py-3 font-medium hover:bg-stone-50">
        Войти
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-8 inline-flex w-fit self-center transition-transform hover:scale-105">
        <Logo className="h-9" />
      </Link>
      <Suspense fallback={<p className="text-center text-stone-500">Подтверждаем email…</p>}>
        <VerifyEmailInner />
      </Suspense>
    </main>
  );
}
