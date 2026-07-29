import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { IllustratedCard } from '@/components/IllustratedCard';
import { MatchIcon } from '@/components/icons/illustrated/MatchIcon';
import { EscrowIcon } from '@/components/icons/illustrated/EscrowIcon';
import { BuildIcon } from '@/components/icons/illustrated/BuildIcon';
import { ChatIcon } from '@/components/icons/illustrated/ChatIcon';
import { CodeIcon } from '@/components/icons/illustrated/CodeIcon';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center gap-20 px-4 py-16 text-center">
      <section className="flex flex-col items-center gap-6">
        <div className="animate-float">
          <Logo withWordmark={false} className="h-16 w-16" />
        </div>
        <h1 className="max-w-2xl font-serif text-5xl leading-tight text-stone-900">TuskHunt</h1>
        <p className="max-w-md text-stone-600">
          Деньги защищены на платформе, пока работа не сдана и не принята — заказчик и
          исполнитель встречаются на равных.
        </p>
        <div className="flex gap-4">
          <Link href="/register" className="rounded-full bg-brand px-6 py-3 font-medium text-white transition hover:bg-brand-dark">
            Начать
          </Link>
          <Link href="/login" className="rounded-full border border-stone-300 px-6 py-3 font-medium text-stone-800 transition hover:bg-white">
            Войти
          </Link>
        </div>
      </section>

      <section className="grid w-full grid-cols-2 gap-4 text-left sm:grid-cols-3">
        <IllustratedCard
          color="lavender"
          icon={<MatchIcon />}
          title="Точный подбор"
          description="Совместимость фрилансера с заказом считается по навыкам, рейтингу и истории сделок — не просто по дате отклика."
        />
        <IllustratedCard
          color="sand"
          icon={<BuildIcon />}
          title="Разместите заказ"
          description="Опишите задачу, укажите бюджет и стек — отклики начнут приходить сразу."
        />
        <IllustratedCard
          color="sage"
          icon={<EscrowIcon />}
          title="Эскроу-защита"
          description="Оплата резервируется на платформе и переходит исполнителю только после приёмки работы."
        />
        <IllustratedCard
          color="rose"
          icon={<ChatIcon />}
          title="Прямой чат"
          description="Обсудите детали с любым откликнувшимся до того, как примете решение — не только с выбранным исполнителем."
        />
        <IllustratedCard
          color="olive"
          icon={<CodeIcon />}
          title="Для разработчиков"
          description="Заказы с реальным стеком и понятной сложностью, без размытых формулировок."
        />
      </section>

      <footer className="flex gap-4 text-xs text-stone-400">
        <Link href="/terms" className="hover:text-stone-600">
          Условия использования
        </Link>
        <Link href="/privacy" className="hover:text-stone-600">
          Конфиденциальность
        </Link>
      </footer>
    </main>
  );
}
