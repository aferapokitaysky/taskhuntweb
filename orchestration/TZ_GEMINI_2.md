# TaskHunt — ТЗ для Gemini, раунд 2: ClamAV + тесты на ReferralsModule

Продолжение [`TZ_GEMINI.md`](./TZ_GEMINI.md) — реферальную программу ты
уже сдал (см. `orchestration/STATUS_GEMINI.md`), она в `main`. Это новое,
отдельное задание.

Прочитай `git log --oneline -15` перед стартом — с прошлого раза
появились: `pnpm-lock.yaml` закоммичен, в `apps/api` настроен Jest
(`apps/api/src/modules/wallet/__tests__/*.spec.ts` — используй как образец
паттерна тестирования: мокается `PrismaService`/`LedgerService`/
`EventBusService` через `jest.fn()`, без реальной БД).

## Твоя зона на этот раз

Оба пункта — изолированные файлы, которые никто параллельно не
редактирует (Codex сейчас активно работает только в `apps/web` над
онбордингом/дашбордом — туда не лезем).

### 1. Реальный ClamAV вместо заглушки в `scan.processor.ts`

Файл: `apps/api/src/modules/files/scan.processor.ts`. Сейчас
`process()` сразу помечает файл `CLEAN` без проверки — так пришлось
сделать в Phase 1, чтобы не блокировать остальной флоу.

Что сделать:
1. Добавь зависимость `clamscan` (npm) в `apps/api/package.json` (после
   правки не забудь `npx pnpm install --filter @taskhunt/api`).
2. В `scan.processor.ts`: подключиться к ClamAV daemon по TCP
   (`clamdscan`, хост/порт — из env, добавь `CLAMAV_HOST`/`CLAMAV_PORT`
   в `apps/api/.env.example`, дефолт `clamav`/`3310` — имя хоста
   рассчитано на будущий сервис `clamav` в docker-compose, см. пункт 3).
3. Скачать файл из S3 (используй уже существующий `S3Service` —
   смотри `apps/api/src/modules/files/s3.service.ts`, добавь туда метод
   `downloadToBuffer(key: string): Promise<Buffer>` через `GetObjectCommand`,
   если такого метода ещё нет) и просканировать буфер/временный файл.
4. По результату — `scanStatus: 'CLEAN'` или `'INFECTED'` в `FileAsset`
   (обновление `prisma.fileAsset.update`, как уже сделано в заглушке).
5. Если ClamAV daemon недоступен (например, локальная разработка без
   поднятого контейнера) — не роняй весь воркер: залогируй ошибку и
   оставь файл в статусе `PENDING` (BullMQ сам переретраит job по
   `attempts: 3`, это уже настроено в `files.service.ts` при постановке
   в очередь).

**Не трогай `docker-compose.yml` напрямую.** Нужен новый сервис
`clamav` (образ `clamav/clamav-debian`, порт `3310`, healthcheck на
готовность демона) — опиши точный YAML-блок, который нужно добавить, в
`STATUS_GEMINI_2.md`, оркестратор вставит сам.

### 2. Тесты на `ReferralsService`

По образцу `apps/api/src/modules/wallet/__tests__/wallet.service.spec.ts`
— мокай `PrismaService`, `LedgerService`, `WalletService` через `jest.fn()`.

Файл: `apps/api/src/modules/referrals/__tests__/referrals.service.spec.ts`.

Обязательные кейсы:
- `redeem()`: бросает `NotFoundException`, если код не найден
- `redeem()`: бросает `BadRequestException`, если пользователь активирует
  свой же код (`referralCode.ownerId === userId`)
- `redeem()`: бросает `BadRequestException`, если у пользователя уже есть
  `ReferralUse` (повторная активация)
- `processReferralReward()`: ничего не делает (не дёргает
  `ledgerService.applyTransaction`), если у плательщика нет `ReferralUse`
- `processReferralReward()`: ничего не делает повторно, если
  `rewardLedgerTxId` уже не `null` (идемпотентность — это самое важное
  свойство, которое нельзя случайно сломать будущими правками)
- `processReferralReward()`: считает сумму вознаграждения по проценту из
  `CommissionRule` (или по `DEFAULT_REFERRAL_FEE_PERCENT`, если правила
  нет), и вызывает `ledgerService.applyTransaction` со сбалансированными
  entries (`DEBIT system.MAIN` / `CREDIT referrer.MAIN` на одну и ту же
  сумму)
- `getMyReferralInfo()`: генерирует код при первом вызове, при повторном
  — переиспользует существующий (не создаёт новый)

## Definition of done

- [ ] `pnpm --filter @taskhunt/api build` — чисто
- [ ] `pnpm --filter @taskhunt/api test` — все тесты (твои новые + уже
      существующие ledger/wallet) зелёные
- [ ] `STATUS_GEMINI_2.md` заполнен, включая точный YAML-блок для
      docker-compose.yml, если дошёл до пункта 1

## Как отчитываться

Веди [`STATUS_GEMINI_2.md`](./STATUS_GEMINI_2.md) — **дописывай** секции,
не переписывай файл целиком (в прошлый раз так терялись ответы
оркестратора, см. историю в `STATUS_GEMINI.md`).
