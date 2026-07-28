import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold">TaskHunt</h1>
      <p className="max-w-md text-slate-600">
        Фриланс-биржа со встроенным крипто-эскроу: деньги защищены на платформе,
        пока работа не сдана и не принята.
      </p>
      <div className="flex gap-4">
        <Link href="/register" className="rounded-lg bg-brand px-6 py-3 font-medium text-white hover:bg-brand-dark">
          Регистрация
        </Link>
        <Link href="/login" className="rounded-lg border border-slate-300 px-6 py-3 font-medium hover:bg-slate-100">
          Войти
        </Link>
      </div>
    </main>
  );
}
