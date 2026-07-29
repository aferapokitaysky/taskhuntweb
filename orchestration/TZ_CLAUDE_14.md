# TaskHunt — ТЗ для себя (Claude), раунд 14: закрытие долга раунда 13 + UI/UX-пакет (мега-раунд)

Разделение как обычно: **UI/UX и фронт — мне** (весь раунд, плюс точечный
бэк там, где фичи реально нет вообще), **новый самодостаточный бэкенд —
Gemini** ([`TZ_GEMINI_14.md`](./TZ_GEMINI_14.md)).

## 0. Аудит перед постановкой — раунд 13 оставил долг

Проверено грепом по `apps/web/src` перед этим ТЗ: раунд 13 сдал **10
бэкенд-фич, под которые фронт так и не появился** — эндпоинты рабочие,
задеплоены, но нигде не вызываются. Это не гипотеза, а факт (ноль
совпадений на `similar`, `previous-freelancers`, `endorse`,
`vacationUntil`, `digestFrequency`, `autoWithdraw`, `export.csv`,
`/clone`, `merge-into`, `verifiedPayer` по всему фронту). Закрываю все
десять в этом раунде первым делом (п.1–10) — только после них перехожу
к новым фичам (п.11+).

Также нашёл: `order.status` везде на фронте рендерится сырым английским
enum'ом (`{order.status}` — OPEN/IN_PROGRESS/DISPUTED/EXPIRED...), ни
разу не был локализован ни в одном раунде. Закрываю в п.11.

---

## 1. Похожие заказы

Бэкенд уже есть: `GET /orders/:id/similar` (`orders.service.ts::findSimilar`,
раунд 13, Gemini) — топ-5 по пересечению тэгов/категории.

`apps/web/src/app/orders/[id]/OrderDetailClient.tsx` — новая секция
"Похожие заказы" в конце страницы (после отзывов/чата): `useEffect`
дёргает `/orders/${orderId}/similar`, рендерит компактные карточки
(заголовок, бюджет, категория), ссылки на `/orders/:id`. Если пусто —
секцию не показывать (не создавать пустой блок).

## 2. "Нанять снова"

Бэкенд: `GET /users/me/previous-freelancers` (раунд 13, только для
`CLIENT`) — фрилансеры, с которыми уже был хотя бы один `COMPLETED`
заказ, с `hireCount` и `myAvgRating`.

`apps/web/src/app/dashboard/page.tsx` — новый блок в `<aside>` (только
для `isClient`, видно всегда, не только когда есть `selectedOrder`):
"Нанимали раньше" — карточки фрилансеров (аватар, имя, `hireCount` раз,
рейтинг), клик → `/freelancers/:id`. Если пусто — блок не рендерить.

## 3. Подтверждение навыков (endorsements)

Бэкенд: `POST /orders/:id/endorse` (body `{skillId}`, только клиент
завершённого заказа, только навыки, реально указанные у фрилансера) +
`endorsementCount` уже приходит в `skills[]` и в `getPublicProfile`, и в
`findFreelancers` (раунд 13) — но нигде не читается на фронте.

- `apps/web/src/app/freelancers/[id]/page.tsx` — там, где рендерятся
  `data.profile.skills` пилюлями (строка ~124), добавить
  `{skill.endorsementCount > 0 && <span> · {skill.endorsementCount}</span>}`
  рядом с названием навыка (небольшая приглушённая цифра).
- `apps/web/src/app/orders/[id]/OrderDetailClient.tsx` — в блоке, что
  уже показывается при `order.status === 'COMPLETED'` (там, где сейчас
  форма отзыва/"Спасибо за отзыв", п.7 раунда 12), для `isClient`
  добавить компактный список навыков принятого фрилансера с чекбоксами
  "Подтвердить" → `POST /orders/:id/endorse`, уже подтверждённые — не
  показывать повторно (нужен доп. GET, простейший вариант: подтягивать
  навыки принятого фрилансера из уже загруженного `order.bids`, без
  нового эндпоинта).

## 4. Vacation-режим фрилансера

Бэкенд: `Profile.vacationUntil` + фильтрация в `findFreelancers`/
`recommendFreelancersForOrder` (раунд 13) — поле уже принимает
`UpdateProfileDto.vacationUntil` в `PATCH /users/me/profile`.

`apps/web/src/app/profile/page.tsx` — в блоке рядом с уже существующим
переключателем "Открыт для заказов" (тот же паттерн, `toggleAvailableForWork`,
строка ~140) добавить второй, более гранулярный контрол: чекбокс "Я в
отпуске" → показывает `<input type="date">` ("до какого числа"), при
сохранении шлёт `vacationUntil` в том же PATCH. Дата в прошлом/пусто —
отпуск выключен (бэк уже это умеет, `lt: now` в фильтре).

## 5. Настройка дайджеста уведомлений

Бэкенд: `PATCH /notifications/preferences/digest` body `{frequency: 'NONE'|'DAILY'|'WEEKLY'}`
(раунд 13). `GET /notifications/preferences` уже возвращает список
каналов — нужно проверить, отдаёт ли он заодно `digestFrequency`
пользователя (если нет — маленькая правка в `NotificationsService.getPreferences`,
подмешать `user.digestFrequency` в ответ, это не новая фича, а
завершение уже начатой).

`apps/web/src/app/profile/page.tsx` — новая секция "Уведомления" (или
подсекция в "Безопасность"/отдельная — по месту, там же, где логично
после раунда 13): три радио-кнопки/селект (Не присылать / Раз в день /
Раз в неделю), сохранение через `PATCH /notifications/preferences/digest`.

## 6. Автовывод средств

Бэкенд: `PATCH /wallet/auto-withdraw` body `{threshold, savedAddressId}`
или `{threshold: null}` (раунд 13).

`apps/web/src/app/dashboard/page.tsx` — рядом с существующим блоком
"Вывод средств" (там же, где кнопка "Вывести средства", строка ~330):
сворачиваемая мини-форма "Автовывод": порог (`number`), выбор
сохранённого адреса (уже есть компонент `PayoutAddressBook`,
переиспользовать), чекбокс включить/выключить. Нужно узнать текущее
значение — если `GET /wallet/balance` не отдаёт `autoWithdrawThreshold`/
`autoWithdrawAddressId` (эти поля есть в модели `Wallet`, `getBalances`
скорее всего их уже отдаёт, т.к. возвращает весь объект — проверить на
месте) можно читать прямо оттуда, доп. эндпоинт не нужен.

## 7. CSV-экспорт истории операций

Бэкенд уже есть, `GET /wallet/transactions/export.csv` (раунд 13) —
просто не подключен. `apps/web/src/app/dashboard/page.tsx`, в шапке
секции "История операций" (там же, где кнопка "Показать"/"Скрыть",
рядом с уже добавленной в этом же раунде PDF-кнопкой на строке
элемента) — кнопка "Скачать CSV" через уже существующий `downloadFile()`
хэлпер (`@/lib/api`, добавлен в прошлом раунде специально для этого).

## 8. Клонирование заказа

Бэкенд: `POST /orders/:id/clone` (раунд 13, только владелец, создаёт
`DRAFT`-копию).

`apps/web/src/app/orders/[id]/OrderDetailClient.tsx` — для `isClient` и
`order.status` в `COMPLETED`/`CANCELLED`/`EXPIRED`, кнопка "Повторить
заказ" рядом с заголовком → `POST /orders/:id/clone` → редирект на
`/orders/:newId` (клон в `DRAFT`, там уже есть кнопка "Опубликовать" —
проверить, что страница заказа корректно показывает DRAFT-заказ
владельцу с возможностью его отредактировать/опубликовать; если такого
UI ещё нет для DRAFT — минимально: редирект на `/dashboard` вместо
`/orders/:newId`, с уведомлением "Черновик создан", и публикация через
уже существующую форму редактирования, если она есть, иначе через
`PATCH /orders/:id` с `status: 'OPEN'`, добавить кнопку "Опубликовать"
just для DRAFT-статуса на странице заказа).

## 9. Admin: слияние дублирующихся навыков

Бэкенд: `POST /admin/skills/:id/merge-into/:targetId` (раунд 13).

`apps/web/src/app/admin/page.tsx` — в существующей секции "Навыки"
(строка ~352) рядом с каждым навыком в списке добавить маленькую кнопку
"Объединить с…" → простая инлайн-форма (select с остальными навыками)
→ `POST /admin/skills/:id/merge-into/:targetId` → рефреш списка.

## 10. Бейдж "Проверенный плательщик"

Бэкенд: `verifiedPayer: boolean` уже в `getPublicProfile` и в объекте
`client` внутри ответов `orders.service.ts` (раунд 13).

- `apps/web/src/app/orders/[id]/OrderDetailClient.tsx` — рядом с именем/
  инфо заказчика (если такой блок есть) или в шапке заказа — маленькая
  пилюля "Проверенный плательщик" (новая иконка — см. п.11 общий пул
  иконок, или переиспользовать `ShieldIcon`), только если `order.client?.verifiedPayer`.
- То же на публичном профиле заказчика, если он существует отдельным
  видом (проверить — сейчас `/freelancers/[id]` только для фрилансеров;
  если публичного профиля заказчика не существует, ограничиться карточкой
  заказа, не городить новый вид ради одного бейджа).

### Definition of done (п.1–10)

- Каждый пункт — открыть фичу вживую в браузере под нужной ролью,
  убедиться, что бэкенд реально отвечает (не 404/500), данные
  отображаются и действие (написать/сохранить/подтвердить) проходит
  до конца.
- `tsc --noEmit` в `apps/web` чистый после каждого пункта.

---

## 11. Единая локализация статусов заказа

Сейчас `order.status` рендерится сырым enum'ом минимум в 3 местах
(`dashboard/page.tsx` — строка со статусом в карточке, `orders/[id]` —
шапка заказа, возможно ещё где-то — проверить `grep -rn "order.status}"`
перед стартом). Завести один общий файл:

`apps/web/src/lib/orderStatus.ts` (новый):

```ts
export const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  OPEN: 'Открыт',
  IN_PROGRESS: 'В работе',
  IN_REVIEW: 'На проверке',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
  DISPUTED: 'Спор',
  EXPIRED: 'Просрочен',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-stone-100 text-stone-600',
  OPEN: 'bg-emerald-100 text-emerald-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  IN_REVIEW: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-stone-100 text-stone-500',
  DISPUTED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-stone-100 text-stone-500',
};
```

Заменить везде, где сейчас `{order.status}` голым текстом, на пилюлю
`<span className={\`rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_COLORS[order.status]}\`}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</span>`
(фоллбэк на сырой статус, если появится новый enum-значение, которое
забыли добавить в мапу — не должно ломаться, просто покажет английский).

### Definition of done (п.11)

- `grep -rn "order.status}" apps/web/src` — либо ноль совпадений, либо
  только внутри `orderStatus.ts` самого.

## 12. Toast/snackbar-система

Сейчас много "тихих" действий: оптимистичные обновления без подтверждения
(избранное, лайки, отзывы), ошибки — только `console`/красный текст
внутри формы, ничего глобального. Одна лёгкая система на всё приложение:

`apps/web/src/components/Toast.tsx` (новый) — контекст + провайдер:
```ts
type Toast = { id: string; message: string; variant: 'success' | 'error' };
```
`ToastProvider` в `apps/web/src/app/layout.tsx` (оборачивает `children`),
хук `useToast()` возвращает `showToast(message, variant?)`. Рендер —
фиксированный контейнер `bottom-4 right-4`, стек карточек, автозакрытие
через 4с, анимация появления (переиспользовать паттерн `animate-mascot-pop`
или новый лёгкий fade+slide). Использовать точечно там, где сейчас
тихо — как минимум: избранное (заказы/фрилансеры), сохранение профиля,
ошибки сети в 2-3 самых частых формах (не переписывать вообще всё
приложение на toast — только новые вызовы `showToast` в местах без
обратной связи, не трогать формы, где уже есть inline-текст ошибки).

## 13. Order timeline / прогресс-степпер

`apps/web/src/components/OrderTimeline.tsx` (новый) — горизонтальный
(desktop) / вертикальный (mobile) степпер: Открыт → В работе → На
проверке → Завершён, с точкой-индикатором текущего шага, пройденные шаги
подсвечены terracotta, будущие — серым. Если `order.status === 'DISPUTED'`
— отдельная ветка/бейдж поверх степпера, не встраивать в линейную
последовательность (спор — не обязательный шаг). Вставить в
`OrderDetailClient.tsx` под шапкой заказа.

## 14. Тёмная тема

Дальше всех остальных пунктов по объёму, но нужно продумать заранее —
`prefers-color-scheme` + toggle в `AppHeader`, сохранение в `localStorage`.

- `apps/web/tailwind.config.ts` — `darkMode: 'class'`.
- `apps/web/src/app/globals.css` — CSS-переменные для фона/текста/карточек
  (`--bg`, `--card`, `--ink`, `--muted`), сейчас цвета захардкожены
  Tailwind-классами (`bg-cream`, `text-stone-900`, `bg-white`) — полная
  замена ВСЕХ мест на переменные нереалистична за один раунд, поэтому
  скоуп сознательно ограниченный: тёмная тема покрывает `AppHeader`,
  `/dashboard`, `/profile`, `/orders/[id]` (самые используемые
  страницы), остальные страницы в этом раунде остаются светлыми (не
  ломаются, просто не адаптированы — обычный `dark:` вариант Tailwind
  без `dark:` классов на элементе = светлый вид, это не баг, а explicit
  сужение скоупа).
- Тоггл — иконка солнце/луна в `AppHeader`, рядом с колокольчиком.
- Применение: на `<html>` через маленький inline-скрипт в `layout.tsx`
  (`<head>`), чтобы не было "мигания" светлой темой при загрузке
  (стандартный паттерн, читает `localStorage`/`matchMedia` до гидрации).

### Definition of done (п.14)

- Переключение туда-обратно без перезагрузки, сохраняется между
  сессиями, нет мигания при первой загрузке страницы.

## 15. Skeleton-загрузка

`apps/web/src/components/Skeleton.tsx` (новый) — простой блок
`animate-pulse bg-stone-200 rounded`, принимает `className` для
размеров. Заменить текстовые "Загружаем…" на дашборде (карточки заказов),
странице категории (`/categories/[id]`), профиле фрилансера
(`/freelancers/[id]`) на 2-3 skeleton-карточки нужной формы вместо
одной строки текста — только в этих трёх местах (не переписывать все
`loading`-состояния проекта, слишком много поверхностей).

## 16. Расширенные фильтры каталога фрилансеров

`apps/web/src/app/freelancers/page.tsx` — сейчас фильтры: категория,
навык, поиск (`findFreelancers({categoryId, skillId, search})`). Добавить
на фронте сортировку результатов (без нового эндпоинта — сортировка на
уже полученном массиве): по рейтингу (`successRate` desc), по
"недавно активен" (`lastSeenAt`, если приходит в ответе — проверить,
`findFreelancers` его сейчас не включает в `profile`-объект, добавить
маленькой правкой в `users.service.ts::findFreelancers`, это точечный
бэк). Селект "Сортировать по" сверху списка.

## 17. "Поделиться профилем"

`apps/web/src/app/freelancers/[id]/FreelancerProfileClient.tsx` —
кнопка "Поделиться" рядом с "Пригласить на заказ" (раунд 13): копирует
`window.location.href` в буфер (`navigator.clipboard.writeText`),
показывает toast (п.12) "Ссылка скопирована".

## 18. Виджет "До следующего уровня"

`apps/web/src/app/dashboard/page.tsx` — для `isFreelancer`, маленький
блок в `<aside>`: используя пороги из `computeFreelancerLevel` (раунд
13, `users.service.ts`, там же в `getMe`/`getPublicProfile` эти данные
уже есть) — прогресс-бар "N из 10 завершённых заказов до Top Rated" (если
уже TOP_RATED — не показывать). Нужно, чтобы `getMe()` отдавал
`completedOrders`-счётчик фрилансера — точечная правка (сейчас `getMe`
не считает его вообще, только `getPublicProfile`/`findFreelancers`
считают чужой; добавить туда же, где уже есть `profileCompleteness`).

### Итоговый Definition of done раунда

- `pnpm --filter @taskhunt/web build` чистый после каждого крупного
  пункта (14 особенно — риск сломать другие страницы).
- Каждый пункт проверен вживую в браузере под нужной ролью.
- README-индекс обновлён по факту закрытия раунда.
