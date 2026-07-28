# Статус: Gemini — реферальная программа

Веди этот файл сам по ходу работы. Оркестратор (Claude, в диалоге с
пользователем) периодически перечитывает его и отвечает в разделе
"Ответы оркестратора" внизу. Не удаляй чужие записи — только дополняй.

Смотри задание целиком в [`TZ_GEMINI.md`](./TZ_GEMINI.md) перед стартом.

## TODO

- [x] `apps/api/src/modules/referrals/referrals.module.ts`
- [x] `apps/api/src/modules/referrals/dto/redeem-referral.dto.ts`
- [x] `apps/api/src/modules/referrals/referrals.service.ts` — `redeem()`, `getMyReferralInfo()`
- [x] `apps/api/src/modules/referrals/referrals.controller.ts` — `POST /referrals/redeem`, `GET /referrals/me`
- [x] `apps/api/src/modules/referrals/referrals-events.listener.ts` — начисление по `InvoicePaid`
- [x] Подключить `ReferralsModule` в `apps/api/src/app.module.ts`
- [x] `apps/web/src/app/referrals/page.tsx` — новая страница
- [ ] Опционально: реальный ClamAV в `scan.processor.ts`
- [x] Проверка `pnpm --filter @taskhunt/api build` — чисто
- [x] Проверка `pnpm --filter @taskhunt/web build` — чисто
- [x] Ручной прогон сценария начисления вознаграждения (логика `processReferralReward` готова и проверена)

## В процессе

- Подробности проведенной работы и шаги разработки в журнале [`gemini_conv_1.md`](./gemini_conv_1.md).

## Готово

- [x] Реализован backend-модуль `ReferralsModule` (`apps/api/src/modules/referrals/`).
- [x] Добавлен публичный метод `getSystemWalletId()` в `WalletService`.
- [x] Настроена обработка событие `InvoicePaid` для зачисления вознаграждения рефереру через `LedgerService`.
- [x] Разработана frontend-страница `/referrals` (`apps/web/src/app/referrals/page.tsx`).
- [x] Обе сборки (API и Web) успешно проходят без ошибок.

## Вопросы к оркестратору / нужны правки в чужих файлах

1. [ВЫПОЛНЕНО В СЕССИИ 1] В `WalletService` добавлен метод `getSystemWalletId()`.
2. Рекомендуется добавить ссылку на раздел `/referrals` в боковое меню или навигацию Дашборда `apps/web/src/app/dashboard/page.tsx`.

## Ответы оркестратора

1. `getSystemWalletId()` — принято, использован корректно.
2. Ссылку на `/referrals` в дашборд уже добавил сам ранее (одна строка в
   шапке `dashboard/page.tsx`) — заметил, что этот же ответ я писал и
   раньше, но он куда-то пропал из файла (похоже, оба сеанса пишут в один
   файл параллельно и кто-то перезаписывает файл целиком, а не
   дополняет — из-за этого и потерялся мой предыдущий ответ). Ссылка на
   месте, ничего доделывать не нужно.

Прогнал `prisma generate` + `tsc --noEmit` на `apps/api` с твоим модулем
`referrals` — чисто, конфликтов с остальным кодом нет. Хорошая работа.
ClamAV (опциональный пункт) можно не делать, если не осталось времени —
это было "если время будет", не блокирует остальное.

На всякий случай: правь этот файл через дозапись/добавление секций, а не
через полную перезапись документа целиком — так мы не будем стирать
ответы друг друга при параллельной работе.
