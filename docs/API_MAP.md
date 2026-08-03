# TaskHunt — Карта API (API Endpoints Reference)

Полный перечень REST-эндпоинтов NestJS-монолита `apps/api`, сверенный напрямую с кодом контроллеров (не аспирационный список — если эндпоинт здесь есть, он реально существует и работает именно так). Нет глобального префикса `/api` — пути ниже ровно такие, какими они видны снаружи.

Обозначения доступа:
- **Public** — без токена, может дёрнуть кто угодно.
- **Public (Optional)** — работает и без токена, и с ним; если токен есть и валиден, обработчик знает personality вызывающего (`OptionalJwtAuthGuard`).
- **Auth** — обязателен валидный JWT (`JwtAuthGuard`).
- **Auth+Role:X** — JWT + `RolesGuard` + `@Roles('CLIENT' | 'FREELANCER')` (роль пользователя в маркетплейсе).
- **Auth+Permission:X** — JWT + `PermissionsGuard` + `@RequirePermissions(...)` (гранулярные права staff-аккаунта, независимые от CLIENT/FREELANCER — см. `StaffRole`/`Permission` в [ARCHITECTURE.md](ARCHITECTURE.md)).
- **Internal** — не для пользователей вообще, дергается только `fraud-service` по общему секрету (`InternalSecretGuard`).

---

## Auth (`/auth`)

| Метод | Путь | Доступ | Описание |
| :--- | :--- | :--- | :--- |
| POST | `/auth/register` | Public (5/мин) | Регистрация (email + пароль), сразу шлёт письмо верификации |
| POST | `/auth/login` | Public (5/мин) | Вход по email/паролю, при включённой 2FA возвращает `requiresTotp` |
| POST | `/auth/refresh` | Public | Обновление пары токенов по refresh-токену |
| GET | `/auth/verify-email` | Public | Подтверждение email по токену из письма (`?token=`) |
| POST | `/auth/resend-verification` | Auth (3/мин) | Повторная отправка письма верификации |
| POST | `/auth/forgot-password` | Public (5/мин) | Запрос ссылки сброса пароля (ответ не палит, зарегистрирован ли email) |
| POST | `/auth/reset-password` | Public (5/мин) | Установка нового пароля по токену из письма |
| POST | `/auth/change-password` | Auth (5/мин) | Смена пароля — требует текущий |
| POST | `/auth/set-password` | Auth (5/мин) | Первичная установка пароля для OAuth-аккаунта без пароля — падает, если пароль уже есть |
| POST | `/auth/2fa/enroll` | Auth | Старт включения TOTP (QR-код + секрет) |
| POST | `/auth/2fa/enroll/confirm` | Auth | Подтверждение TOTP-кодом, включает 2FA и выдаёт бэкап-коды |
| POST | `/auth/2fa/disable` | Auth | Отключение 2FA (требует пароль) |
| POST | `/auth/2fa/verify` | Public (10/мин) | Ввод TOTP-кода на втором шаге логина |
| GET | `/auth/sessions` | Auth | Список активных сессий |
| DELETE | `/auth/sessions/:id` | Auth | Отозвать конкретную сессию |
| POST | `/auth/sessions/revoke-others` | Auth | Отозвать все сессии, кроме текущей |
| GET | `/auth/google` | Public | Редирект на Google OAuth |
| GET | `/auth/google/callback` | Public | Google OAuth callback → редирект на фронт с токенами |
| GET | `/auth/github` | Public | Редирект на GitHub OAuth |
| GET | `/auth/github/callback` | Public | GitHub OAuth callback → редирект на фронт с токенами |
| GET | `/auth/apple` | Public | Редирект на Apple OAuth |
| POST | `/auth/apple/callback` | Public | Apple OAuth callback (form_post) → редирект на фронт с токенами |

---

## Users & Profiles (`/users`, `/freelancers`)

| Метод | Путь | Доступ | Описание |
| :--- | :--- | :--- | :--- |
| GET | `/users/me` | Auth | Профиль текущего пользователя (+ `hasPassword`, `profileCompleteness`) |
| GET | `/users/me/completeness` | Auth | Детальный скор заполненности профиля |
| GET | `/users/me/previous-freelancers` | Auth+Role:CLIENT | Фрилансеры, с которыми клиент уже работал |
| GET | `/users/me/export` | Auth | Экспорт всех данных пользователя (JSON) |
| DELETE | `/users/me` | Auth (3/мин) | Удаление аккаунта (требует пароль) |
| PATCH | `/users/me/profile` | Auth | Обновление полей профиля |
| POST | `/users/me/onboarding` | Auth | Сохранение анкеты онбординга (не трогает статус верификации) |
| POST | `/users/me/avatar` | Auth (10/мин) | Загрузка аватара |
| POST | `/users/me/portfolio` | Auth | Добавить работу в портфолио |
| PATCH | `/users/me/portfolio/:id` | Auth | Изменить работу в портфолио |
| DELETE | `/users/me/portfolio/:id` | Auth | Удалить работу из портфолио |
| GET | `/users/me/bid-templates` | Auth | Список шаблонов откликов |
| POST | `/users/me/bid-templates` | Auth | Создать шаблон отклика |
| PATCH | `/users/me/bid-templates/:id` | Auth | Изменить шаблон отклика |
| DELETE | `/users/me/bid-templates/:id` | Auth | Удалить шаблон отклика |
| GET | `/users/saved/freelancers` | Auth | Избранные фрилансеры текущего пользователя |
| POST | `/users/:id/favorite` | Auth | Добавить фрилансера в избранное |
| DELETE | `/users/:id/favorite` | Auth | Убрать фрилансера из избранного |
| GET | `/users/:id/avatar` | Public | Бинарник аватара пользователя |
| GET | `/users/:id` | Public (Optional) | Публичный профиль пользователя |
| POST | `/users/me/order-templates` | Auth+Role:CLIENT | Создать шаблон регулярного заказа |
| GET | `/users/me/order-templates` | Auth+Role:CLIENT | Список шаблонов регулярных заказов |
| PATCH | `/users/me/order-templates/:id` | Auth+Role:CLIENT | Изменить шаблон регулярного заказа |
| DELETE | `/users/me/order-templates/:id` | Auth+Role:CLIENT | Удалить шаблон регулярного заказа |
| POST | `/users/me/blocks/:freelancerId` | Auth+Role:CLIENT | Заблокировать фрилансера (не может откликаться/приглашаться) |
| DELETE | `/users/me/blocks/:freelancerId` | Auth+Role:CLIENT | Разблокировать фрилансера |
| GET | `/users/me/blocks` | Auth+Role:CLIENT | Список заблокированных фрилансеров |
| GET | `/freelancers` | Public | Поиск/листинг фрилансеров (категория, навык, текст) — исключает staff-аккаунты |
| GET | `/freelancers/me/recommended-orders` | Auth+Role:FREELANCER | Персональная лента рекомендованных заказов |

---

## Catalog (`/categories`, `/skills`)

| Метод | Путь | Доступ | Описание |
| :--- | :--- | :--- | :--- |
| GET | `/categories` | Public | Все категории с вложенными нишами |
| GET | `/skills` | Public | Все навыки |
| POST | `/skills` | Auth (8/мин) | Найти или создать навык по имени |

---

## Orders & Bids (`/orders`)

| Метод | Путь | Доступ | Описание |
| :--- | :--- | :--- | :--- |
| GET | `/orders` | Public (Optional) | Список/поиск заказов с фильтрами — свои заказы staff скрыты у анонимов |
| GET | `/orders/:id` | Public (Optional) | Детали заказа — `bids[].message` виден только заказчику и автору конкретного отклика |
| GET | `/orders/saved/mine` | Auth | Избранные заказы |
| GET | `/orders/bids/mine` | Auth+Role:FREELANCER | Свои отклики |
| GET | `/orders/drafts/mine` | Auth+Role:CLIENT | Свои черновики заказов |
| POST | `/orders/drafts` | Auth+Role:CLIENT | Создать черновик |
| POST | `/orders/drafts/:id/publish` | Auth+Role:CLIENT | Опубликовать черновик |
| DELETE | `/orders/drafts/:id` | Auth+Role:CLIENT | Удалить черновик |
| GET | `/orders/invites/mine` | Auth | Приглашения на заказы |
| PATCH | `/orders/invites/:inviteId/respond` | Auth | Принять/отклонить приглашение |
| POST | `/orders/:id/invite` | Auth+Role:CLIENT | Пригласить фрилансера на заказ |
| POST | `/orders/:id/favorite` | Auth | Добавить заказ в избранное |
| DELETE | `/orders/:id/favorite` | Auth | Убрать заказ из избранного |
| GET | `/orders/:id/recommended-freelancers` | Auth+Role:CLIENT | Ранжированные отклики по своему заказу |
| POST | `/orders` | Auth+Role:CLIENT | Создать заказ |
| PATCH | `/orders/:id` | Auth+Role:CLIENT | Изменить заказ |
| POST | `/orders/:id/bids` | Auth+Role:FREELANCER | Откликнуться на заказ |
| POST | `/orders/:id/bids/:bidId/accept` | Auth+Role:CLIENT | Принять отклик |
| POST | `/orders/:id/bids/:bidId/reject` | Auth+Role:CLIENT | Отклонить отклик (с причиной) |
| POST | `/orders/:id/disputes` | Auth | Открыть спор |
| POST | `/orders/:id/milestones` | Auth+Role:CLIENT | Создать этап |
| GET | `/orders/:id/milestones` | Public | Этапы заказа |
| POST | `/orders/:id/deliver` | Auth+Role:FREELANCER | Сдать работу целиком (без этапов) |
| POST | `/orders/:id/milestones/:milestoneId/deliver` | Auth+Role:FREELANCER | Сдать работу по этапу |
| POST | `/orders/:id/approve` | Auth+Role:CLIENT | Принять работу целиком (релизит эскроу) |
| POST | `/orders/:id/milestones/:milestoneId/approve` | Auth+Role:CLIENT | Принять этап |
| POST | `/orders/:id/reviews` | Auth | Оставить отзыв |
| GET | `/orders/reviews/:userId` | Public | Отзывы о пользователе |
| GET | `/orders/:id/similar` | Public | Похожие заказы |
| POST | `/orders/:id/clone` | Auth+Role:CLIENT | Клонировать заказ |
| POST | `/orders/:id/endorse` | Auth | Наградить навыком по итогам заказа |
| POST | `/orders/:id/disputes/:disputeId/attach` | Auth | Прикрепить файл к спору |
| GET | `/orders/disputes/:id/files` | Auth | Файлы спора |
| POST | `/orders/:id/deadline-extension` | Auth+Role:FREELANCER | Запросить продление дедлайна |
| POST | `/orders/:id/deadline-extension/:requestId/respond` | Auth+Role:CLIENT | Принять/отклонить продление |
| GET | `/orders/:id/invoices` | Auth | Инвойсы заказа |
| GET | `/orders/:id/invoices/export.csv` | Auth | Экспорт инвойсов в CSV |

---

## Chat & Invoices (`/orders/:orderId/chat`, `/chat`)

| Метод | Путь | Доступ | Описание |
| :--- | :--- | :--- | :--- |
| GET | `/orders/:orderId/chat/threads` | Auth | Треды чата по заказу |
| GET | `/orders/:orderId/chat/messages` | Auth | Сообщения треда |
| POST | `/orders/:orderId/chat/messages` | Auth | Отправить текстовое сообщение (+ WebSocket broadcast) |
| POST | `/orders/:orderId/chat/messages/file` | Auth | Отправить файл (+ WebSocket broadcast) |
| POST | `/orders/:orderId/chat/read` | Auth | Отметить тред прочитанным |
| DELETE | `/orders/:orderId/chat/messages/:messageId` | Auth | Мягкое удаление сообщения |
| GET | `/chat/threads` | Auth | Инбокс — все треды текущего пользователя |

---

## Wallet, Escrow & Ledger (`/wallet`)

| Метод | Путь | Доступ | Описание |
| :--- | :--- | :--- | :--- |
| GET | `/wallet/balance` | Auth | Балансы по всем подбалансам |
| GET | `/wallet/withdrawal-fee-info` | Auth | Комиссии на вывод |
| GET | `/wallet/transactions` | Auth | История транзакций (курсорная пагинация) |
| GET | `/wallet/transactions/export.csv` | Auth | Экспорт истории в CSV |
| GET | `/wallet/transactions/:entryId/receipt.pdf` | Auth | PDF-чек по записи леджера |
| PATCH | `/wallet/auto-withdraw` | Auth | Настройка порога/адреса авто-вывода |
| POST | `/wallet/withdraw` | Auth | Запрос вывода крипты (ставит job в очередь выплат) |
| POST | `/wallet/deposits` | Auth (10/мин) | Создать депозит через NOWPayments |
| GET | `/wallet/deposits/:id/payment` | Auth | Детали оплаты депозита |
| POST | `/wallet/invoices` | Auth (10/мин) | Выставить инвойс |
| GET | `/wallet/invoices/:id/payment` | Auth | Детали оплаты инвойса |
| POST | `/wallet/invoices/:id/pay-from-balance` | Auth (10/мин) | Оплатить инвойс с баланса кошелька |
| GET | `/wallet/invoices/:id/receipt.pdf` | Auth | PDF-чек по инвойсу |
| GET | `/wallet/payout-addresses` | Auth | Сохранённые адреса вывода |
| POST | `/wallet/payout-addresses` | Auth | Сохранить адрес вывода |
| PATCH | `/wallet/payout-addresses/:id` | Auth | Изменить сохранённый адрес |
| DELETE | `/wallet/payout-addresses/:id` | Auth | Удалить сохранённый адрес |
| POST | `/wallet/nowpayments/ipn` | Public (подпись проверяется) | Вебхук NOWPayments — подтверждает депозит/инвойс, лочит эскроу |

---

## Subscriptions & Promotions (`/subscriptions`, `/promotions`)

| Метод | Путь | Доступ | Описание |
| :--- | :--- | :--- | :--- |
| GET | `/subscriptions/tiers` | Public | Тарифы (Starter/Pro/Premium) |
| GET | `/subscriptions/me` | Auth | Текущая эффективная подписка |
| POST | `/subscriptions/checkout` | Auth (5/мин) | Крипто-оплата тарифа через NOWPayments |
| POST | `/subscriptions/checkout/from-balance` | Auth (5/мин) | Оплата тарифа с баланса кошелька |
| POST | `/subscriptions/nowpayments/ipn` | Public (подпись проверяется) | Вебхук NOWPayments для подписок |
| GET | `/promotions/active` | Public | Активные буст-продвижения для сущности |
| POST | `/promotions/checkout` | Auth (10/мин) | Крипто-оплата буста заказа/профиля |
| POST | `/promotions/nowpayments/ipn` | Public (подпись проверяется) | Вебхук NOWPayments для бустов |

---

## Search & Matching (`/search`, `/matching`)

| Метод | Путь | Доступ | Описание |
| :--- | :--- | :--- | :--- |
| GET | `/search` | Public (30/мин) | Полнотекстовый поиск (заказы + фрилансеры) |
| GET | `/search/trending` | Public | Популярные запросы за 7 дней |
| GET | `/search/suggest` | Public (60/мин) | Автодополнение в шапке |
| GET | `/matching/orders` | Auth+Role:FREELANCER | Рекомендованные заказы под навыки фрилансера |
| GET | `/matching/freelancers` | Auth+Role:CLIENT | Ранжирование откликов на свой заказ |

---

## Referrals & Saved Searches (`/referrals`, `/saved-searches`)

| Метод | Путь | Доступ | Описание |
| :--- | :--- | :--- | :--- |
| POST | `/referrals/redeem` | Auth | Активировать реферальный код |
| GET | `/referrals/me` | Auth | Свои реферальные данные/статистика |
| GET | `/saved-searches` | Auth | Сохранённые фильтры поиска |
| POST | `/saved-searches` | Auth | Сохранить фильтр поиска |
| DELETE | `/saved-searches/:id` | Auth | Удалить сохранённый фильтр |

---

## Notifications (`/notifications`)

| Метод | Путь | Доступ | Описание |
| :--- | :--- | :--- | :--- |
| GET | `/notifications/preferences` | Auth | Настройки каналов уведомлений |
| PATCH | `/notifications/preferences` | Auth | Включить/выключить канал |
| PATCH | `/notifications/preferences/digest` | Auth | Частота дайджест-писем |
| GET | `/notifications/me` | Auth | Список уведомлений (опц. только непрочитанные) |
| PATCH | `/notifications/read-all` | Auth | Отметить все прочитанными |
| PATCH | `/notifications/:id/read` | Auth | Отметить одно прочитанным |

---

## Support (`/support/tickets`)

| Метод | Путь | Доступ | Описание |
| :--- | :--- | :--- | :--- |
| POST | `/support/tickets` | Auth | Создать тикет |
| GET | `/support/tickets/mine` | Auth | Свои тикеты |
| GET | `/support/tickets/:id` | Auth | Тикет (владелец или staff) |
| POST | `/support/tickets/:id/messages` | Auth | Сообщение в тикет |
| GET | `/support/tickets` | Auth+Permission:DisputeView | Очередь всех тикетов (staff) |
| PATCH | `/support/tickets/:id/assign` | Auth+Permission:DisputeAssign | Взять тикет в работу |
| PATCH | `/support/tickets/:id/status` | Auth+Permission:DisputeView | Изменить статус тикета |

---

## Files (`/files`)

| Метод | Путь | Доступ | Описание |
| :--- | :--- | :--- | :--- |
| POST | `/files/upload` | Auth | Загрузить файл (multipart, антивирус-скан ClamAV) |
| GET | `/files/:id/download-url` | Auth | Подписанная ссылка на скачивание |

---

## Public Stats & Health (`/public`, `/health`)

| Метод | Путь | Доступ | Описание |
| :--- | :--- | :--- | :--- |
| GET | `/public/stats` | Public (кэш 5 мин) | Счётчики для лендинга — исключает staff |
| GET | `/public/trending-searches` | Public | Алиас `/search/trending` |
| GET | `/public/home-feed` | Public (кэш 5 мин) | Заказы + категории + статистика одним запросом |
| GET | `/health` | Public | Liveness/readiness (пинг БД и Redis) |

---

## Admin (`/admin`) — все роуты требуют `@RequirePermissions(...)`

| Метод | Путь | Право | Описание |
| :--- | :--- | :--- | :--- |
| GET | `/admin/metrics` | FinanceViewReports | Общие метрики |
| GET | `/admin/metrics/revenue-timeseries` | FinanceViewReports | Выручка по дням |
| GET | `/admin/metrics/funnel` | FinanceViewReports | Воронка конверсии |
| GET | `/admin/metrics/top-categories` | FinanceViewReports | Топ категорий по обороту |
| GET | `/admin/metrics/top-freelancers` | FinanceViewReports | Топ фрилансеров по обороту |
| GET | `/admin/users` | UserView | Список пользователей (фильтр по статусу) |
| POST | `/admin/users/:id/ban` | UserBan | Забанить |
| POST | `/admin/users/:id/suspend` | UserBan | Приостановить |
| POST | `/admin/users/bulk-suspend` | UserBan | Массовая приостановка |
| POST | `/admin/users/:id/reset-2fa` | UserBan | Сбросить 2FA пользователю |
| GET | `/admin/disputes` | DisputeView | Список споров |
| PATCH | `/admin/disputes/:id/assign` | DisputeAssign | Взять спор в работу |
| PATCH | `/admin/disputes/:id/resolve` | DisputeResolve + EscrowRelease | Решить спор |
| GET | `/admin/feature-flags` | FeatureFlagToggle | Список фича-флагов |
| PATCH | `/admin/feature-flags/:key` | FeatureFlagToggle | Переключить флаг |
| GET | `/admin/commission-rules` | FinanceConfigureCommissions | Правила комиссий |
| PATCH | `/admin/commission-rules/:type` | FinanceConfigureCommissions | Изменить комиссию |
| POST/PATCH/DELETE | `/admin/categories(/:id)` | CatalogManage | Управление категориями |
| POST/PATCH/DELETE | `/admin/skills(/:id)` | CatalogManage | Управление навыками |
| POST | `/admin/skills/:id/merge-into/:targetId` | CatalogManage | Слияние навыков |
| GET | `/admin/fraud-flags` | FraudReview | Фрод-флаги (курсорная пагинация) |
| PATCH | `/admin/fraud-flags/:id` | FraudReview | Обновить статус флага |
| GET | `/admin/moderation-queue` | ContentModerate | Очередь модерации |
| PATCH | `/admin/moderation-queue/orders/:id` | OrderModerate | Решить флаг заказа |
| PATCH | `/admin/moderation-queue/profiles/:id` | ContentModerate | Решить флаг профиля |
| PATCH | `/admin/moderation-queue/reviews/:id` | ContentModerate | Решить флаг отзыва |
| GET | `/admin/finance/overview` | FinanceViewReports | Финансовый обзор |
| GET | `/admin/subscriptions` | FinanceViewReports | Список подписок |
| POST | `/admin/subscriptions/:userId/grant` | WalletAdjust | Выдать подписку вручную |
| POST | `/admin/subscriptions/:userId/revoke` | WalletAdjust | Отозвать подписку |
| GET | `/admin/audit-logs` | FinanceViewReports | Журнал аудита |
| GET | `/admin/chats` | DisputeView | Поиск чат-тредов (арбитраж) |
| GET | `/admin/chats/:threadId/messages` | DisputeView | Сообщения треда (арбитраж) |

Полный список `PermissionCode` и ролей (`OWNER`, `FINANCE`, `SUPPORT`, `MODERATOR`, `ARBITRATOR`, `ANALYST`) — `packages/shared-types/src/permissions.ts`. Как выдать роль `OWNER` первому аккаунту — см. [DEPLOYMENT.md](DEPLOYMENT.md#первый-admin-аккаунт).

---

## Internal (не для пользователей)

| Метод | Путь | Доступ | Описание |
| :--- | :--- | :--- | :--- |
| POST | `/internal/fraud/flags` | Internal (общий секрет) | `fraud-service` присылает рассчитанный риск-флаг обратно в монолит |
