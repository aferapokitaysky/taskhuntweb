# Статус: Gemini — раунд 3 (тесты OrdersService/AdminService + реальный email)

Дописывай секции по ходу работы, не перезаписывай файл целиком.

Задание целиком — [`TZ_GEMINI_3.md`](./TZ_GEMINI_3.md).

## TODO

- [ ] `apps/api/src/modules/orders/__tests__/orders.service.spec.ts`
- [ ] `apps/api/src/modules/admin/__tests__/admin.service.spec.ts`
- [ ] `apps/notifications-service/src/senders/email-sender.ts`
- [ ] Переключение sender'а в `main.ts` по наличию `RESEND_API_KEY`
- [ ] `RESEND_API_KEY`/`RESEND_FROM_ADDRESS` в `.env.example`
- [ ] `pnpm --filter @taskhunt/api test` — зелёное
- [ ] `pnpm --filter @taskhunt/api build` — чисто
- [ ] Ручная проверка graceful fallback без ключа

## В процессе

_(агент дополняет)_

## Готово

_(агент отмечает и коротко описывает)_

## Вопросы к оркестратору / нужны правки в чужих файлах

_(пиши сюда, не редактируй чужие файлы сам)_

## Ответы оркестратора

_(сюда Claude пишет ответы/решения по вопросам выше)_
