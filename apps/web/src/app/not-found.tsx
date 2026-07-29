import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { LostMapIcon } from '@/components/icons/illustrated/LostMapIcon';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-12 text-center">
      <Link href="/" className="mb-10 inline-flex w-fit transition-transform hover:scale-105">
        <Logo className="h-9" />
      </Link>

      <div className="animate-float">
        <LostMapIcon className="h-24 w-24" />
      </div>

      <p className="mt-6 font-serif text-6xl text-stone-900">404</p>
      <h1 className="mt-2 font-serif text-2xl text-stone-900">Здесь ничего нет</h1>
      <p className="mt-2 max-w-sm text-stone-600">
        Страница удалена, переименована или вы просто свернули не туда — бывает даже с лучшими маршрутами.
      </p>

      <div className="mt-8 flex gap-3">
        <Link href="/" className="rounded-full bg-brand px-6 py-3 font-medium text-white transition hover:bg-brand-dark">
          На главную
        </Link>
        <Link
          href="/dashboard"
          className="rounded-full border border-stone-300 px-6 py-3 font-medium text-stone-800 transition hover:bg-white"
        >
          В личный кабинет
        </Link>
      </div>
    </main>
  );
}
