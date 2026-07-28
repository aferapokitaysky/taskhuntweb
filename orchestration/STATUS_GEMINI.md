# Статус: Gemini — реферальная программа

Веди этот файл сам по ходу работы. Оркестратор (Claude, в диалоге с
пользователем) периодически перечитывает его и отвечает в разделе
"Ответы оркестратора" внизу. Не удаляй чужие записи — только дополняй.

Смотри задание целиком в [`TZ_GEMINI.md`](./TZ_GEMINI.md) перед стартом.

## TODO

- [ ] `apps/api/src/modules/referrals/referrals.module.ts`
- [ ] `apps/api/src/modules/referrals/dto/redeem-referral.dto.ts`
- [ ] `apps/api/src/modules/referrals/referrals.service.ts` — `redeem()`, `getMyReferralInfo()`
- [ ] `apps/api/src/modules/referrals/referrals.controller.ts` — `POST /referrals/redeem`, `GET /referrals/me`
- [ ] `apps/api/src/modules/referrals/referrals-events.listener.ts` — начисление по `InvoicePaid`
- [ ] Подключить `ReferralsModule` в `apps/api/src/app.module.ts`
- [ ] `apps/web/src/app/referrals/page.tsx` — новая страница
- [ ] Опционально: реальный ClamAV в `scan.processor.ts`
- [ ] Проверка `pnpm --filter @taskhunt/api build` — чисто
- [ ] Проверка `pnpm --filter @taskhunt/web build` — чисто
- [ ] Ручной прогон сценария начисления вознаграждения (см. DoD в TZ)

## В процессе

_(агент дополняет по ходу работы)_

## Готово

_(агент отмечает и коротко описывает, что реализовано)_

## Вопросы к оркестратору / нужны правки в чужих файлах

_(например: "нужен публичный метод getSystemWalletId() в WalletService",
"нужна ссылка на /referrals в дашборде", "нужно добавить сервис clamav в
docker-compose.yml" — пиши сюда, не редактируй чужие файлы сам)_

## Ответы оркестратора

_(сюда Claude пишет ответы/решения по вопросам выше)_
