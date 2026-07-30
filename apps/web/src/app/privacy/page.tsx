import Link from 'next/link';
import { Logo } from '@/components/Logo';

export const metadata = {
  title: 'Политика конфиденциальности',
  description: 'Политика обработки персональных данных TaskHunt',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="mb-8 inline-flex w-fit transition-transform hover:scale-105">
        <Logo className="h-9" />
      </Link>
      <h1 className="mb-2 font-serif text-3xl text-stone-900">Политика конфиденциальности</h1>
      <p className="mb-8 text-sm text-stone-500">
        Черновик для MVP-стадии, требует проверки юристом перед реальным запуском.
      </p>

      <div className="space-y-6 text-sm leading-relaxed text-stone-700">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-stone-900">1. Какие данные мы собираем</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Данные регистрации: email, хэш пароля (либо идентификатор от Google/GitHub/Apple при входе через них)</li>
            <li>Данные профиля: имя, биография, страна/город, ссылки на GitHub/сайт, навыки</li>
            <li>Данные заказов, откликов, сообщений в чате, файлов, прикреплённых к сделкам</li>
            <li>Данные платежей: суммы и статусы транзакций (сами платёжные реквизиты обрабатывает платёжный партнёр, не мы)</li>
            <li>Технические данные: IP-адрес, user-agent, метки времени запросов — для безопасности и аудита</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-stone-900">2. Для чего используются данные</h2>
          <p>
            Для предоставления сервиса (регистрация, заказы, эскроу, чат), связи с вами
            (уведомления, подтверждение email, восстановление пароля), обеспечения
            безопасности (антифрод, антивирус-проверка файлов), выполнения юридических
            обязательств.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-stone-900">3. Кому передаются данные</h2>
          <p>Данные могут передаваться следующим сторонним сервисам, необходимым для работы Платформы:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>NOWPayments — обработка криптоплатежей</li>
            <li>Резенд (Resend) — доставка email-уведомлений</li>
            <li>Google, GitHub, Apple — при выборе входа через эти сервисы (OAuth)</li>
            <li>Облачное файловое хранилище (S3-совместимое) — хранение загружаемых файлов</li>
          </ul>
          <p className="mt-2">Мы не продаём персональные данные третьим лицам.</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-stone-900">4. Cookies</h2>
          <p>
            Платформа использует технически необходимые данные в браузере (токены
            авторизации в localStorage) для поддержания сессии. При первом визите вы
            увидите баннер с информацией об этом.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-stone-900">5. Хранение данных</h2>
          <p>
            Данные хранятся до тех пор, пока аккаунт активен, и удаляются или
            анонимизируются по запросу пользователя, за исключением данных, которые
            необходимо сохранить для соблюдения юридических/бухгалтерских обязательств
            (например, история транзакций).
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-stone-900">6. Ваши права</h2>
          <p>
            Вы можете запросить просмотр, исправление или удаление своих персональных
            данных через раздел «Поддержка» в приложении.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-stone-900">7. Безопасность</h2>
          <p>
            Пароли хранятся в виде хэша (bcrypt), не в открытом виде. Доступ к
            административным функциям ограничен ролевой моделью (RBAC). Загружаемые файлы
            проверяются антивирусом перед выдачей.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-stone-900">8. Контакты</h2>
          <p>По вопросам обработки персональных данных обращайтесь через раздел «Поддержка» в приложении.</p>
        </section>
      </div>
    </main>
  );
}
