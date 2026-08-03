'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getStoredAccessToken } from '@/lib/api';

/**
 * Кнопки входа/регистрации на лендинге ("/") — рендерятся сервер-компонентом
 * page.tsx, который не видит localStorage. Уже залогиненный человек, попадая
 * на лендинг (например по прямой ссылке или из закладки), видел те же
 * "Войти"/"Зарегистрироваться" — выглядело так, будто его выкинуло из
 * аккаунта, хотя токены на месте. Здесь просто проверяем токен на клиенте
 * после маунта и подменяем CTA на "Перейти в кабинет".
 */
export function LandingAuthCta({ variant }: { variant: 'header' | 'section' }) {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(Boolean(getStoredAccessToken()));
  }, []);

  if (variant === 'header') {
    if (loggedIn) {
      return (
        <Link href="/dashboard" className="primary-action flex-1 justify-center px-3 py-2 text-sm sm:flex-none sm:px-4">
          Перейти в кабинет
        </Link>
      );
    }
    return (
      <>
        <Link href="/login" className="secondary-action flex-1 justify-center px-3 py-2 text-sm sm:flex-none sm:px-4">
          Войти
        </Link>
        <Link href="/register?role=CLIENT" className="primary-action flex-1 justify-center px-3 py-2 text-sm sm:flex-none sm:px-4">
          Разместить заказ
        </Link>
      </>
    );
  }

  if (loggedIn) {
    return (
      <Link href="/dashboard" className="primary-action px-6 py-3">
        Перейти в кабинет
      </Link>
    );
  }
  return (
    <>
      <Link href="/register" className="primary-action px-6 py-3">
        Создать аккаунт
      </Link>
      <Link href="/search" className="secondary-action px-6 py-3">
        Посмотреть рынок
      </Link>
    </>
  );
}
