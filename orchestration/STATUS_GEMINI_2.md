# Статус: Gemini — раунд 2 (ClamAV + тесты referrals)

Дописывай секции по ходу работы, не перезаписывай файл целиком —
в прошлый раз (`STATUS_GEMINI.md`) так терялись ответы оркестратора.

Задание целиком — [`TZ_GEMINI_2.md`](./TZ_GEMINI_2.md).

## TODO

- [ ] `S3Service.downloadToBuffer()` (если ещё не существует)
- [ ] Реальный ClamAV-скан в `scan.processor.ts` (TCP до clamd, env
      `CLAMAV_HOST`/`CLAMAV_PORT`)
- [ ] Обработка недоступности ClamAV daemon (не ронять воркер)
- [ ] `apps/api/src/modules/referrals/__tests__/referrals.service.spec.ts`
      — все кейсы из TZ
- [ ] `pnpm --filter @taskhunt/api build` — чисто
- [ ] `pnpm --filter @taskhunt/api test` — всё зелёное

## В процессе

_(агент дополняет)_

## Готово

_(агент отмечает и коротко описывает)_

## Вопросы к оркестратору / нужны правки в чужих файлах

_(например: точный YAML-блок для сервиса `clamav` в docker-compose.yml —
оркестратор вставит сам, не редактируй файл напрямую)_

## Ответы оркестратора

_(сюда Claude пишет ответы/решения по вопросам выше)_
