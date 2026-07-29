# TaskHunt — ТЗ для Gemini, раунд 10: портфолио фрилансера + счётчик просмотров профиля

Твоя зона ответственности в Раунде 10 — портфолио фрилансера (`PortfolioItem`) и счётчик просмотров профилей пользователей (`profileViewsCount`).

## 1. Портфолио фрилансера (`PortfolioItem`)

### Миграция и модель в `apps/api/prisma/schema.prisma`

Добавь модель `PortfolioItem`:

```prisma
model PortfolioItem {
  id          String   @id @default(uuid())
  profileId   String
  profile     Profile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
  title       String
  description String?
  imageUrl    String?
  projectUrl  String?
  tags        String[] @default([])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([profileId])
  @@map("portfolio_items")
}
```

В модель `Profile` добавь:
- `portfolioItems PortfolioItem[]`
- `viewsCount Int @default(0)`

### DTOs (`apps/api/src/modules/users/dto/`)

Создай:
1. `create-portfolio-item.dto.ts`:
   - `title`: `@IsString() @IsNotEmpty()`
   - `description`: `@IsOptional() @IsString()`
   - `imageUrl`: `@IsOptional() @IsString()`
   - `projectUrl`: `@IsOptional() @IsString()`
   - `tags`: `@IsOptional() @IsArray() @IsString({ each: true })`
2. `update-portfolio-item.dto.ts`: `@PartialType(CreatePortfolioItemDto)`

### Методы в `UsersService` и эндпоинты в `UsersController`

В `UsersService`:
- `addPortfolioItem(userId: string, dto: CreatePortfolioItemDto)` — находит/создаёт профиль пользователя, создает запись работы в портфолио.
- `updatePortfolioItem(userId: string, itemId: string, dto: UpdatePortfolioItemDto)` — проверяет владение (`item.profile.userId === userId`, иначе `NotFoundException`), обновляет работу.
- `deletePortfolioItem(userId: string, itemId: string)` — проверяет владение, удаляет работу.
- `recordProfileView(targetUserId: string, viewerUserId?: string)` — инкрементирует `viewsCount` на `Profile` получателя (если `viewerUserId !== targetUserId`).

В `UsersController`:
- `@UseGuards(JwtAuthGuard)`
- `@Post('me/portfolio')` — добавление работы в портфолио
- `@Patch('me/portfolio/:id')` — обновление работы
- `@Delete('me/portfolio/:id')` — удаление работы

Обнови `getPublicProfile(id)` и `getMe(id)` — включай `portfolioItems: { orderBy: { createdAt: 'desc' } }`, и в `getPublicProfile(id)` вызови `recordProfileView(id)`.

## Definition of done

- `pnpm --filter @taskhunt/api test` — зелёное, добавь юнит-тесты на методы `UsersService` (добавление, редактирование, удаление работ, просмотр профиля).
- `pnpm --filter @taskhunt/api build` — чисто.
- Отмечай прогресс в `STATUS_GEMINI_10.md` по мере готовности каждого пункта.
