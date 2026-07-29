# TaskHunt — ТЗ для Gemini, раунд 11: весь бэкенд — счётчики категорий/навыков + общий поиск

В этом раунде необычное разделение: весь бэкенд — твой (обычно я забирал
денежное/реалтайм и часть бэка себе, сейчас нет ни того ни другого —
только справочные данные и поиск), я (оркестратор) делаю только
фронтенд ([`TZ_CLAUDE_11.md`](./TZ_CLAUDE_11.md)) — три новые страницы
(`/categories`, `/skills`, `/search`), которые рассчитаны на то, что ты
опишешь ниже. Три задачи, все независимые друг от друга и от чужих
файлов (кроме `catalog.controller.ts`/`catalog.service.ts` — это файл, в
котором в прошлом раунде я добавил `POST /skills`, аккуратно дописывай
рядом, не переписывай существующие методы).

**Перед стартом**: `git pull`/`git status` — я мог уже закоммитить
что-то в `catalog.*` до тебя, свериться.

## 1. `GET /categories` — счётчик открытых заказов

`apps/api/src/modules/catalog/catalog.service.ts::listCategories()` —
сейчас возвращает `{ id, name, slug, parentId, children }[]`. Добавь
`orderCount: number` — количество заказов со `status: 'OPEN'` в этой
категории — **и топ-категориям, и подкатегориям** (фронт показывает
счётчик у каждой карточки, включая чипы подкатегорий).

Не делай N+1 (по запросу на категорию) — один
`prisma.order.groupBy({ by: ['categoryId'], where: { status: 'OPEN' }, _count: true })`,
дальше в JS смапить counts на дерево категорий (`Map<categoryId, count>`,
дефолт 0 для категорий без заказов).

## 2. `GET /skills` — счётчик использования

`catalog.service.ts::listSkills()` — добавь `usageCount: number` —
количество `ProfileSkill`, ссылающихся на этот навык (сколько
фрилансеров указали его себе). Тоже один агрегирующий запрос, не N+1:

```ts
const counts = await this.prisma.profileSkill.groupBy({ by: ['skillId'], _count: true });
```

смапить на список навыков так же, как в п.1.

## 3. `GET /search?q=` — общий поиск по заказам и фрилансерам

Новый эндпоинт, публичный (без гварда — как `GET /orders` и
`GET /freelancers` сейчас). Новый модуль
`apps/api/src/modules/search/` (`search.module.ts`, `search.service.ts`,
`search.controller.ts`) — **не дублируй логику фильтрации заказов/
фрилансеров, переиспользуй существующие сервисы**:

```ts
@Injectable()
export class SearchService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly usersService: UsersService,
  ) {}

  async search(query: string) {
    if (!query || query.trim().length < 2) return { orders: [], freelancers: [] };

    const [orders, freelancers] = await Promise.all([
      this.ordersService.findMany({ search: query }),
      this.usersService.findFreelancers({ search: query }),
    ]);

    return { orders: orders.slice(0, 10), freelancers: freelancers.slice(0, 10) };
  }
}
```

`SearchModule` импортирует `OrdersModule` и `UsersModule` (проверь, что
оба экспортируют свои сервисы из `providers`/`exports` — если
`OrdersService`/`UsersService` сейчас не в `exports` соответствующих
модулей, добавь их туда, это чисто механическая правка). Ответ
контроллера: `{ orders: [...], freelancers: [...] }` — ничего сверху не
оборачивать, фронт ждёт ровно такую форму (см. `TZ_CLAUDE_11.md`, п.4).

`search.controller.ts`:

```ts
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query('q') q?: string) {
    return this.searchService.search(q ?? '');
  }
}
```

Зарегистрировать `SearchModule` в `app.module.ts::imports`.

### Анти-абуз (эндпоинт публичный, без авторизации)

`GET /orders`/`GET /freelancers` и так публичны и уже это выдерживают,
но `/search` дороже (два запроса за раз) и обращён прямо к пользователю
на видном месте (в шапке) — добавь `@Throttle({ default: { limit: 30, ttl: 60000 } })`
на роут (см. `@nestjs/throttler`, тот же паттерн, что в `wallet.controller.ts`/
`catalog.controller.ts::createSkill`) — с запасом больше, чем реальный
человек нажмёт Enter за минуту, но заметно ниже глобального лимита
100/мин, чтобы не превращать шапку в вектор для скрапинга каталога.

## Definition of done

- `pnpm --filter @taskhunt/api test` зелёное — юнит-тесты:
  `catalog.service.spec.ts` на `orderCount`/`usageCount` (мок
  `groupBy`, проверка что категории/навыки без заказов/использования
  получают `0`, не `undefined`); `search.service.spec.ts` на пустой
  запрос (`''`/один символ) → `{ orders: [], freelancers: [] }` без
  похода в БД, обрезку до 10 на каждый список.
- `pnpm --filter @taskhunt/api build` чисто.
- Живой прогон: `curl 'localhost:3001/categories'` — у каждой категории
  и подкатегории есть `orderCount`; `curl 'localhost:3001/search?q=react'`
  — в ответе реально есть и заказы, и фрилансеры, если они существуют
  в тестовых данных с этим словом.
- Отмечай прогресс в `STATUS_GEMINI_11.md`.
