# CodexTZ for Claud

## 000. Назначение документа

- 000.001 Документ является общим большим планом для Codex и Claude.
- 000.002 Codex ведёт frontend, UI, UX, визуальную систему и клиентскую интеграцию.
- 000.003 Claude ведёт backend, API, Prisma, очереди, realtime, антифрод и уведомления.
- 000.004 Коммуникация ведётся через `docs/CODEX_CLAUDE_SYNC.md`.
- 000.005 Любой новый endpoint сначала описывается контрактом, потом реализуется.
- 000.006 Любая новая UI-фича сначала проверяется на существующих данных, потом подключается к API.
- 000.007 Цель: вывести TaskHunt на уровень удобства job-платформ вроде robota.ua/work.ua, но с сильной фриланс-логикой.
- 000.008 Продукт должен ощущаться как рабочий инструмент, а не как AI-generated landing.
- 000.009 Никаких emoji в интерфейсе, документах и псевдо-брендинге.
- 000.010 Кастомные SVG делать в текущей рисованной манере проекта: чёрный контур, спокойная пастель, понятная метафора.
- 000.011 Дизайн должен быть свежий, гармоничный, доверительный, не кислотный, не шаблонный.
- 000.012 Основная эмоция продукта: спокойно нашёл, спокойно договорился, спокойно оплатил.
- 000.013 Основной UX-принцип: меньше хаоса переписок, больше прозрачных статусов сделки.
- 000.014 Основной бизнес-принцип: escrow и доверие видны пользователю на каждом важном шаге.
- 000.015 Основной визуальный принцип: marketplace density с аккуратной теплотой, без декоративного шума.
- 000.016 Документ можно расширять, но нельзя удалять чужие решения без записи в sync-файл.
- 000.017 Все пункты с owner Codex реализуются на фронте.
- 000.018 Все пункты с owner Claude реализуются на бэке.
- 000.019 Shared-контракты должны быть типизированы и согласованы в `packages/shared-types`, если используются обеими сторонами.
- 000.020 Acceptance criteria обязательны для завершения этапа.

## 001. Product North Star

- 001.001 TaskHunt должен стать фриланс-маркетплейсом, где поиск и сделка живут в одном продукте.
- 001.002 Пользователь должен понимать, что делать дальше, без чтения инструкций.
- 001.003 Заказчик должен быстро перейти от идеи к опубликованному заказу.
- 001.004 Фрилансер должен быстро понять, какие заказы подходят именно ему.
- 001.005 Обе стороны должны видеть, где деньги, кто что должен сделать, какие сроки и что уже принято.
- 001.006 В интерфейсе должны быть видны статус, доверие, escrow, next action, контекст.
- 001.007 Главная должна продавать через полезность, а не через рекламные абзацы.
- 001.008 Dashboard должен быть рабочим центром, а не списком случайных блоков.
- 001.009 Чат заказа должен быть сделочным workspace, а не просто мессенджером.
- 001.010 Профиль должен выглядеть как сильное резюме/портфолио, а не анкета.
- 001.011 Поиск должен быть главным входом в продукт.
- 001.012 Регистрация должна быть короткой, но сразу направлять пользователя по роли.
- 001.013 Onboarding должен не собирать данные ради данных, а сразу улучшать рекомендации.
- 001.014 Уведомления должны вести к действию, а не просто сообщать факт.
- 001.015 Бэк должен давать фронту explainable data: причины матчинга, missing steps, readable statuses.

## 002. Visual Direction

- 002.001 Owner: Codex.
- 002.002 Визуальный стиль: modern trust marketplace.
- 002.003 Палитра: тёплая brand-терракота, cream, stone, sage, lavender, sand.
- 002.004 Цвета не должны сливаться в одну бежевую массу.
- 002.005 Тёмные блоки использовать как trust/accent zones, но не делать весь сайт мрачным.
- 002.006 Не использовать generic blue-purple SaaS gradients.
- 002.007 Не использовать glow blobs, orbs, bokeh, случайные декоративные пятна.
- 002.008 Разрешены тонкие сетки, бумажная текстура, мягкие borders, натуральные тени.
- 002.009 Скругления карточек держать последовательными: крупные панели 24-32px, controls 14-18px.
- 002.010 Повторяемые карточки не должны быть вложены в декоративные карточки.
- 002.011 Текст в компактных панелях должен быть компактным, без hero-size typography.
- 002.012 Hero-size typography использовать только на главной и auth title.
- 002.013 SVG-иллюстрации делать простыми, узнаваемыми и привязанными к действию.
- 002.014 SVG не должен выглядеть как random icon pack.
- 002.015 У каждого SVG должна быть цель: escrow, match, chat, client, freelancer, invoice, dispute, wallet, file, notification.
- 002.016 Иллюстрации не должны заменять реальные данные.
- 002.017 Для статусов использовать badges с понятным цветом и текстом.
- 002.018 Для ошибок использовать спокойный red/rose, не агрессивный full-screen.
- 002.019 Для успеха использовать emerald/sage, но без чрезмерного celebration.
- 002.020 Все hover states должны быть ощутимыми, но не прыгать резко.
- 002.021 Все animations должны уважать `prefers-reduced-motion`.
- 002.022 Focus states обязательны на всех интерактивных элементах.
- 002.023 Dark mode не должен ломать contrast.
- 002.024 Skeleton states должны соответствовать форме будущего контента.
- 002.025 Loading states должны не сдвигать layout.
- 002.026 Empty states должны давать действие.
- 002.027 CTA должен быть один главный на экран или секцию.
- 002.028 Secondary actions должны быть визуально спокойнее.
- 002.029 Destructive actions должны быть отдельно выделены.
- 002.030 Информационные подсказки должны быть короткими и рядом с контекстом.

## 003. UI System Tasks

- 003.001 Owner: Codex.
- 003.002 Стабилизировать `premium-panel` как базовую панель.
- 003.003 Стабилизировать `interactive-card` как базовую карточку.
- 003.004 Стабилизировать `primary-action` как главную кнопку.
- 003.005 Стабилизировать `secondary-action` как вторичную кнопку.
- 003.006 Стабилизировать `field-surface` как базовое поле.
- 003.007 Добавить `danger-action` для опасных операций.
- 003.008 Добавить `ghost-action` для тихих действий.
- 003.009 Добавить `status-pill` с вариантами open, active, paid, disputed, completed, canceled.
- 003.010 Добавить `trust-badge` для verified/email/wallet/top rated.
- 003.011 Добавить `metric-tile` для dashboard метрик.
- 003.012 Добавить `timeline-event` для событий заказа.
- 003.013 Добавить `deal-card` для milestones/invoices.
- 003.014 Добавить `profile-chip` для skills/categories.
- 003.015 Добавить `page-shell` для внутренних страниц.
- 003.016 Добавить `section-heading` для заголовков секций.
- 003.017 Добавить единые `form-row`, `form-grid`, `form-help`, `form-error`.
- 003.018 Добавить `mobile-sticky-actions`.
- 003.019 Пройти все кнопки и привести к общим классам.
- 003.020 Пройти все inputs/selects/textareas и привести к общим классам.
- 003.021 Пройти все repeated cards и добавить stable hover.
- 003.022 Пройти все modals и сделать единый surface.
- 003.023 Проверить text overflow на mobile.
- 003.024 Проверить длинные email/title/category names.
- 003.025 Проверить keyboard navigation.
- 003.026 Проверить visual regression вручную в Chrome на desktop.
- 003.027 Проверить mobile viewport.
- 003.028 Не добавлять UI-текст, объясняющий как пользоваться интерфейсом, если действие понятно из контекста.
- 003.029 Убрать декоративный шум, если блок не несёт смысла.
- 003.030 Держать visual density ближе к job-board, чем к лендингу.

## 004. Custom SVG System

- 004.001 Owner: Codex.
- 004.002 Создать набор SVG в стиле существующих illustrated icons.
- 004.003 SVG: SavedSearchIcon.
- 004.004 SVG: InviteIcon.
- 004.005 SVG: MilestoneIcon.
- 004.006 SVG: ReviewIcon.
- 004.007 SVG: DeadlineIcon.
- 004.008 SVG: PortfolioIcon.
- 004.009 SVG: VerificationIcon.
- 004.010 SVG: DisputeIcon.
- 004.011 SVG: DraftIcon.
- 004.012 SVG: TemplateIcon.
- 004.013 SVG: NotificationStackIcon.
- 004.014 SVG: ProfileCompletenessIcon.
- 004.015 SVG: SearchSuggestIcon.
- 004.016 SVG: MatchReasonIcon.
- 004.017 SVG: WalletVerifiedIcon.
- 004.018 SVG: FastResponderIcon.
- 004.019 SVG: SecureDealIcon.
- 004.020 SVG: FileBundleIcon.
- 004.021 Все SVG должны принимать `className`.
- 004.022 Все SVG должны иметь stable viewBox.
- 004.023 Не использовать emoji внутри SVG.
- 004.024 Не импортировать внешние icon packs для illustrated layer.
- 004.025 Контур сохранять в текущем стиле.
- 004.026 Пастельные заливки брать из Tailwind palette.
- 004.027 Проверить SVG на темном фоне.
- 004.028 Проверить SVG на маленьком размере 24px.
- 004.029 Проверить SVG на карточке 80px.
- 004.030 Документировать новые icons в отдельном index.

## 005. Landing Page

- 005.001 Owner: Codex.
- 005.002 Первый viewport должен сразу показывать бренд, поиск, два сценария, доверие.
- 005.003 Header должен быть компактным.
- 005.004 Header CTA для заказчика ведёт на `/register?role=CLIENT`.
- 005.005 Header secondary CTA для фрилансера ведёт на `/register?role=FREELANCER`.
- 005.006 Hero search должен иметь query input.
- 005.007 Hero search должен иметь type select: all, orders, freelancers.
- 005.008 Quick chips должны вести в `/search?q=...`.
- 005.009 Scenario card "Мне нужен исполнитель" должна вести в `/register?role=CLIENT`.
- 005.010 Scenario card "Я ищу заказы" должна вести в `/register?role=FREELANCER`.
- 005.011 Scenario cards должны показывать выгоду роли, а не общую рекламу.
- 005.012 Trust block должен объяснять escrow коротко.
- 005.013 Top categories должны быть видны ниже hero.
- 005.014 Featured orders должны показывать реальные карточки, если API доступен.
- 005.015 Если API недоступен, fallback не должен выглядеть как ошибка.
- 005.016 Stats должны брать данные из API.
- 005.017 Если stats пустые, показывать честные нейтральные значения.
- 005.018 Блок escrow steps должен быть линейным и понятным.
- 005.019 Footer должен иметь ссылки на terms/privacy/support.
- 005.020 Mobile hero не должен требовать горизонтальный скролл.
- 005.021 Desktop hero должен оставлять hint следующей секции.
- 005.022 Никаких generic hero illustrations.
- 005.023 Использовать фактические product signals: поиск, карточки, escrow, роли.
- 005.024 Добавить микро-анимацию только на hover/entrance.
- 005.025 SEO JSON-LD оставить корректным.
- 005.026 Metadata должна использовать TaskHunt/TuskHunt единообразно.
- 005.027 Решить финальное имя бренда с тимлидом.
- 005.028 После решения бренда заменить inconsistent mentions.
- 005.029 Acceptance: с главной можно начать путь заказчика за 1 клик.
- 005.030 Acceptance: с главной можно начать путь фрилансера за 1 клик.

## 006. Search Experience

- 006.001 Owner: Codex.
- 006.002 Owner backend dependencies: Claude.
- 006.003 Поиск должен работать по orders/freelancers/categories/skills.
- 006.004 Search page должна принимать `q`.
- 006.005 Search page должна принимать `type`.
- 006.006 Search page должна показывать tabs или segmented control.
- 006.007 Filters должны быть компактными.
- 006.008 Starter state должен показывать популярные запросы.
- 006.009 Starter state должен показывать категории.
- 006.010 Starter state должен показывать объяснение escrow коротко через UI, не текстовую инструкцию.
- 006.011 Empty state должен предлагать изменить запрос.
- 006.012 Empty state должен предлагать создать заказ.
- 006.013 Loading должен быть skeleton, не plain text.
- 006.014 Results count должен быть виден.
- 006.015 Sort должен быть понятным: relevance, newest, budget, rating.
- 006.016 Freelancers results должны показывать availability.
- 006.017 Orders results должны показывать bids count.
- 006.018 Orders results должны показывать budget and category.
- 006.019 Сохранить поиск появляется после ввода query.
- 006.020 Saved search требует backend endpoint.
- 006.021 Search suggest в header требует backend endpoint.
- 006.022 Header search должен раскрывать input без layout jump.
- 006.023 Mobile search должен быть full-width.
- 006.024 Query chips должны быть keyboard accessible.
- 006.025 Acceptance: пользователь видит полезный экран даже до ввода запроса.
- 006.026 Acceptance: поиск не ломается при API failure.
- 006.027 Acceptance: роль query from landing сохраняет правильный путь.

## 007. Register/Login/Auth

- 007.001 Owner: Codex.
- 007.002 Owner backend dependencies: Claude.
- 007.003 AuthShell layout: форма слева, trust/promo справа на desktop.
- 007.004 На mobile показывать logo, title, form, links.
- 007.005 `/register?role=CLIENT` должен активировать client card.
- 007.006 `/register?role=FREELANCER` должен активировать freelancer card.
- 007.007 Роль должна попадать в email registration payload.
- 007.008 Роль должна попадать в OAuth links.
- 007.009 OAuth disabled state должен требовать роль только на регистрации.
- 007.010 Login не должен требовать роль.
- 007.011 Register password strength.
- 007.012 Register display name suggestions.
- 007.013 Register error state under form.
- 007.014 Login 2FA state должен выглядеть как второй шаг.
- 007.015 Forgot password success state не должен раскрывать наличие email.
- 007.016 Reset password invalid token state должен быть спокойным.
- 007.017 Verify email checking state должен иметь loader.
- 007.018 OAuth callback должен иметь progress bar.
- 007.019 CORS должен пропускать local web origin.
- 007.020 Backend должен возвращать readable auth errors.
- 007.021 Rate limit error должен иметь отдельный код.
- 007.022 Frontend должен показывать "попробуйте позже" для rate limit.
- 007.023 Acceptance: регистрация с role query проходит без второго выбора роли.
- 007.024 Acceptance: CORS не блокирует preflight.
- 007.025 Acceptance: auth pages визуально едины.

## 008. Onboarding

- 008.001 Owner: Codex.
- 008.002 Owner backend dependencies: Claude.
- 008.003 Onboarding должен стартовать после регистрации.
- 008.004 Role приходит из query.
- 008.005 Client flow: categories, project type, budget, urgency.
- 008.006 Freelancer flow: categories, skills, experience, rate, availability.
- 008.007 Stepper должен быть виден.
- 008.008 Progress должен быть smooth.
- 008.009 Selected states должны быть явными.
- 008.010 Categories должны быть multi-select.
- 008.011 Skills должны быть searchable select после backend support.
- 008.012 User can skip optional fields.
- 008.013 Submit success ведёт в dashboard.
- 008.014 Errors не должны сбрасывать ответы.
- 008.015 Autocomplete categories from API.
- 008.016 Profile completeness endpoint нужен после onboarding.
- 008.017 Acceptance: onboarding можно пройти за 60 секунд.
- 008.018 Acceptance: onboarding не выглядит как длинная анкета.

## 009. Dashboard Work Center

- 009.001 Owner: Codex.
- 009.002 Owner backend dependencies: Claude.
- 009.003 Dashboard должен иметь role-aware hero.
- 009.004 Client hero CTA: create order.
- 009.005 Freelancer hero CTA: find matching orders.
- 009.006 Top metrics: wallet balance, escrow, active deals, unread.
- 009.007 Next action card: что требует внимания.
- 009.008 Client next actions: review bids, fund invoice, accept work, resolve dispute.
- 009.009 Freelancer next actions: answer invite, submit work, send invoice, update profile.
- 009.010 Matching jobs section for freelancer.
- 009.011 Suggested freelancers section for client.
- 009.012 Draft orders section for client.
- 009.013 Saved searches section.
- 009.014 Notifications preview.
- 009.015 Profile completeness card.
- 009.016 Wallet section should show available, locked, pending, escrow.
- 009.017 Withdraw flow should use premium forms.
- 009.018 Empty dashboard should guide next action.
- 009.019 Loading dashboard should use skeleton.
- 009.020 Error dashboard should allow retry.
- 009.021 Acceptance: dashboard answers "what should I do now".
- 009.022 Acceptance: dashboard differs by role.

## 010. Create Order UX

- 010.001 Owner: Codex.
- 010.002 Owner backend dependencies: Claude.
- 010.003 Create order should become a guided composer.
- 010.004 Step 1: title and category.
- 010.005 Step 2: description and expected result.
- 010.006 Step 3: skills and files.
- 010.007 Step 4: budget, deadline, milestones.
- 010.008 Step 5: review and publish.
- 010.009 Add templates per category.
- 010.010 Add draft autosave.
- 010.011 Add budget helper from backend stats.
- 010.012 Add skill suggestions.
- 010.013 Add "make private invite-only" after backend support.
- 010.014 Add preview card before publish.
- 010.015 Add validation per step.
- 010.016 Add save draft button.
- 010.017 Add publish success page.
- 010.018 Acceptance: client can create clear order without knowing marketplace terminology.

## 011. Freelancer Discovery

- 011.001 Owner: Codex.
- 011.002 Owner backend dependencies: Claude.
- 011.003 Freelancers page should feel like candidate search.
- 011.004 Search by name/headline/skills.
- 011.005 Filter by category.
- 011.006 Filter by skill.
- 011.007 Filter by availability.
- 011.008 Filter by rate range.
- 011.009 Filter by verified badges.
- 011.010 Sort by relevance/rating/activity.
- 011.011 Cards show headline, skills, success rate, completed deals.
- 011.012 Cards show response speed.
- 011.013 Cards show invite CTA.
- 011.014 Profile page shows portfolio.
- 011.015 Profile page shows reviews.
- 011.016 Profile page shows trust badges.
- 011.017 Profile page shows similar freelancers.
- 011.018 Acceptance: client can shortlist candidates quickly.

## 012. Order Detail Workspace

- 012.001 Owner: Codex.
- 012.002 Owner backend dependencies: Claude.
- 012.003 Order page should not be just detail page.
- 012.004 It should be workspace for decision and delivery.
- 012.005 Header: title, status, budget, category.
- 012.006 Sidebar: client/freelancer, milestones, escrow, files.
- 012.007 Main: description, bids, timeline, chat.
- 012.008 Client sees bid comparison.
- 012.009 Freelancer sees bid composer.
- 012.010 Accepted bid creates chat workspace.
- 012.011 Invoice appears as event card.
- 012.012 Escrow locked appears as event card.
- 012.013 Work submitted appears as event card.
- 012.014 Review request appears as event card.
- 012.015 Dispute appears as high priority card.
- 012.016 Sticky mobile action: bid, message, pay, submit, review.
- 012.017 Acceptance: user understands deal state in under 5 seconds.

## 013. Chat UX

- 013.001 Owner: Codex.
- 013.002 Owner backend dependencies: Claude.
- 013.003 Chat needs stable realtime connection.
- 013.004 Messages should group by sender/time.
- 013.005 System events should not look like chat messages.
- 013.006 Invoice card should show amount/status/action.
- 013.007 Milestone card should show due date/status/action.
- 013.008 File attachments should show file type and size.
- 013.009 Message composer should support files.
- 013.010 Composer disabled states must explain why.
- 013.011 Unread divider.
- 013.012 Typing indicator after backend support.
- 013.013 Delivery state after backend support.
- 013.014 Scroll should stay stable.
- 013.015 Acceptance: chat can run whole deal without leaving page.

## 014. Wallet and Escrow

- 014.001 Owner: Codex.
- 014.002 Owner backend dependencies: Claude.
- 014.003 Wallet should show money state clearly.
- 014.004 Available balance.
- 014.005 Locked balance.
- 014.006 Escrow balance.
- 014.007 Pending balance.
- 014.008 Withdrawable balance.
- 014.009 Every transaction should have readable label.
- 014.010 Every transaction should link to order/invoice when possible.
- 014.011 Withdraw flow should support saved addresses.
- 014.012 Auto-withdraw should have clear threshold.
- 014.013 Invoice payment status should be visible.
- 014.014 Escrow explanation should be concise.
- 014.015 Acceptance: user never wonders where money is.

## 015. Notifications

- 015.001 Owner: Claude backend, Codex frontend.
- 015.002 In-app notification bell should group events.
- 015.003 Notification has title.
- 015.004 Notification has body.
- 015.005 Notification has deep link.
- 015.006 Notification has priority.
- 015.007 Notification has read state.
- 015.008 Notification has createdAt.
- 015.009 Critical deal events should be persistent.
- 015.010 Low priority events can be grouped.
- 015.011 Email notification should link back to web.
- 015.012 Preferences page should allow channel settings.
- 015.013 Events: bid submitted.
- 015.014 Events: bid accepted.
- 015.015 Events: invoice issued.
- 015.016 Events: invoice paid.
- 015.017 Events: escrow locked.
- 015.018 Events: work submitted.
- 015.019 Events: review requested.
- 015.020 Events: dispute opened.
- 015.021 Events: deadline approaching.
- 015.022 Acceptance: notification always leads to next action.

## 016. Smart Matching

- 016.001 Owner: Claude backend, Codex frontend.
- 016.002 Matching must be explainable.
- 016.003 Score alone is not enough.
- 016.004 Include reasons: skill match.
- 016.005 Include reasons: category match.
- 016.006 Include reasons: budget fit.
- 016.007 Include reasons: availability.
- 016.008 Include reasons: successful similar work.
- 016.009 Include missing: no portfolio.
- 016.010 Include missing: low profile completeness.
- 016.011 Include missing: missing skill.
- 016.012 Codex renders reasons as chips.
- 016.013 Codex renders score without making it feel like AI magic.
- 016.014 Avoid "AI matched" copy unless feature truly uses AI.
- 016.015 Use "Подходит по навыкам", "Бюджет совпадает", "Есть похожие сделки".
- 016.016 Endpoint should paginate.
- 016.017 Endpoint should be cacheable where safe.
- 016.018 Acceptance: user understands why result is recommended.

## 017. Trust, Reviews, Reputation

- 017.001 Owner: Claude backend, Codex frontend.
- 017.002 Add reviews after completed deals.
- 017.003 Review can be left by client.
- 017.004 Review can be left by freelancer.
- 017.005 Review has rating.
- 017.006 Review has text.
- 017.007 Review links to order category.
- 017.008 Profile shows average rating.
- 017.009 Profile shows completed deals.
- 017.010 Profile shows success rate.
- 017.011 Profile shows response speed.
- 017.012 Profile shows verified email.
- 017.013 Profile shows verified wallet.
- 017.014 Profile shows top rated.
- 017.015 Profile shows rising talent.
- 017.016 Fraud signals should not be exposed raw.
- 017.017 Moderation can hide abusive review.
- 017.018 Acceptance: trust is earned through clear signals.

## 018. Invites and Shortlists

- 018.001 Owner: Claude backend, Codex frontend.
- 018.002 Client can save freelancer.
- 018.003 Client can invite freelancer to order.
- 018.004 Freelancer can accept invite.
- 018.005 Freelancer can decline invite.
- 018.006 Invite has status.
- 018.007 Invite has message.
- 018.008 Invite links to order.
- 018.009 Dashboard shows pending invites.
- 018.010 Notifications show new invite.
- 018.011 Profile CTA allows invite.
- 018.012 Order page shows invited freelancers.
- 018.013 Acceptance: client can proactively hire, not only wait.

## 019. Saved Search and Alerts

- 019.001 Owner: Claude backend, Codex frontend.
- 019.002 User can save search.
- 019.003 Saved search stores query.
- 019.004 Saved search stores type.
- 019.005 Saved search stores filters.
- 019.006 Saved search has frequency.
- 019.007 Saved search can be paused.
- 019.008 Saved search can be deleted.
- 019.009 New matching orders trigger notification.
- 019.010 New matching freelancers trigger notification.
- 019.011 Dashboard shows saved searches.
- 019.012 Search page shows save button.
- 019.013 Acceptance: freelancer can monitor market passively.

## 020. Profile Completeness

- 020.001 Owner: Claude backend, Codex frontend.
- 020.002 Endpoint: `GET /users/me/completeness`.
- 020.003 Response has percentage.
- 020.004 Response has missing fields.
- 020.005 Response has recommended next action.
- 020.006 Response differs by role.
- 020.007 Client missing fields: company/name, preferred categories, budget, payment readiness.
- 020.008 Freelancer missing fields: headline, skills, rate, availability, portfolio, bio.
- 020.009 Dashboard card shows progress.
- 020.010 Profile page shows completion checklist.
- 020.011 Onboarding success updates completion.
- 020.012 Acceptance: profile improvement feels useful, not bureaucratic.

## 021. Admin and Moderation

- 021.001 Owner: Claude backend, Codex frontend.
- 021.002 Admin should see moderation queue.
- 021.003 Queue item can be order.
- 021.004 Queue item can be profile.
- 021.005 Queue item can be file.
- 021.006 Queue item can be review.
- 021.007 Admin can approve.
- 021.008 Admin can reject.
- 021.009 Admin can request edits.
- 021.010 Admin action must create audit log.
- 021.011 Dispute resolution must be clear.
- 021.012 Feature flags should be safe to toggle.
- 021.013 Commission rules should show current active rule.
- 021.014 Acceptance: admin can operate platform without DB access.

## 022. Fraud and Risk

- 022.001 Owner: Claude.
- 022.002 Risk service should listen to events.
- 022.003 Risk score should be stored.
- 022.004 Risk reasons should be internal.
- 022.005 High risk order can enter moderation.
- 022.006 High risk user can require review.
- 022.007 Duplicate IP/device signals should be considered.
- 022.008 Payment anomaly should be considered.
- 022.009 Dispute frequency should be considered.
- 022.010 Rapid account creation should be considered.
- 022.011 Frontend should only show human friendly trust state.
- 022.012 Acceptance: fraud system protects without scaring normal users.

## 023. Backend Contracts

- 023.001 Owner: Claude.
- 023.002 Add `WEB_PUBLIC_URLS`.
- 023.003 Apply CORS whitelist to HTTP.
- 023.004 Apply CORS whitelist to WebSocket.
- 023.005 Add `GET /public/stats`.
- 023.006 Add `GET /public/trending-searches`.
- 023.007 Add `GET /public/home-feed`.
- 023.008 Add `GET /search/suggest`.
- 023.009 Add `GET /matching/orders`.
- 023.010 Add `GET /matching/freelancers`.
- 023.011 Add order drafts endpoints.
- 023.012 Add order templates endpoints.
- 023.013 Add invitations endpoints.
- 023.014 Add saved searches endpoints.
- 023.015 Add profile completeness endpoint.
- 023.016 Add reviews endpoints.
- 023.017 Add notification read/unread endpoints.
- 023.018 Add moderation queue endpoints.
- 023.019 Add public freelancer profile stats.
- 023.020 Add API tests for every contract.

## 024. Frontend Integration Order

- 024.001 Owner: Codex.
- 024.002 Phase 1: stabilize auth and landing.
- 024.003 Phase 2: search and freelancer discovery.
- 024.004 Phase 3: dashboard work center.
- 024.005 Phase 4: order workspace and chat.
- 024.006 Phase 5: profile/reputation.
- 024.007 Phase 6: invites and saved search.
- 024.008 Phase 7: admin/moderation polish.
- 024.009 Phase 8: mobile QA.
- 024.010 Phase 9: dark mode QA.
- 024.011 Phase 10: accessibility QA.
- 024.012 Do not wait for backend to polish static states.
- 024.013 Do not fake backend data as if real.
- 024.014 Use empty/skeleton/fallback states until endpoint exists.
- 024.015 Keep API needs in sync file.

## 025. Quality Gates

- 025.001 `corepack pnpm --filter @taskhunt/web build`.
- 025.002 `corepack pnpm --filter @taskhunt/web test`.
- 025.003 `corepack pnpm --filter @taskhunt/api test`.
- 025.004 `corepack pnpm --filter notifications-service build`.
- 025.005 `corepack pnpm --filter fraud-service build`.
- 025.006 Manual Chrome desktop check.
- 025.007 Manual mobile viewport check.
- 025.008 Registration from landing role check.
- 025.009 CORS preflight check.
- 025.010 Search empty state check.
- 025.011 Dashboard authenticated check.
- 025.012 Order detail check.
- 025.013 Chat connect check.
- 025.014 Dark mode check.
- 025.015 Keyboard focus check.
- 025.016 No emoji check.
- 025.017 No random external icon style check.
- 025.018 No text overflow check.
- 025.019 No broken responsive grid check.
- 025.020 No hidden horizontal scroll check.

## 026. Copywriting Rules

- 026.001 Copy should be direct and useful.
- 026.002 Avoid hype words.
- 026.003 Avoid saying "AI" unless feature is truly AI.
- 026.004 Use "подбор", "совпадение", "рекомендации", "статус сделки".
- 026.005 Use "эскроу" consistently.
- 026.006 Explain money states in one sentence.
- 026.007 Button text should be action based.
- 026.008 Empty states should propose next action.
- 026.009 Error states should explain recovery.
- 026.010 Success states should confirm outcome.
- 026.011 No emoji.
- 026.012 No jokes in critical money/security flows.
- 026.013 Keep Russian terminology consistent.
- 026.014 Decide final brand spelling: TaskHunt or TuskHunt.
- 026.015 After decision, replace all inconsistent mentions.

## 027. Mobile UX

- 027.001 Owner: Codex.
- 027.002 Header must not wrap into unusable rows.
- 027.003 Search must be full-width.
- 027.004 Cards must stack cleanly.
- 027.005 Sticky actions should appear on deal pages.
- 027.006 Auth form should be first, promo hidden.
- 027.007 Dashboard metrics should become 2-column or 1-column.
- 027.008 Chat composer should stay reachable.
- 027.009 Filters should collapse.
- 027.010 Tap targets minimum 44px.
- 027.011 Text should not sit under browser chrome.
- 027.012 No horizontal scroll.
- 027.013 Acceptance: full client path works on mobile.
- 027.014 Acceptance: full freelancer path works on mobile.

## 028. Accessibility

- 028.001 Owner: Codex.
- 028.002 Buttons must be buttons.
- 028.003 Links must navigate.
- 028.004 Inputs must have accessible names.
- 028.005 Role cards must expose selected state.
- 028.006 Dialogs must trap focus.
- 028.007 Toasts must have status region.
- 028.008 Errors must be announced near fields.
- 028.009 Color contrast must pass.
- 028.010 Focus rings must be visible.
- 028.011 Reduced motion support required.
- 028.012 Keyboard can submit forms.
- 028.013 Keyboard can navigate search filters.
- 028.014 Acceptance: core flows work without mouse.

## 029. Performance

- 029.001 Owner: Codex and Claude.
- 029.002 Avoid heavy client bundles.
- 029.003 Keep server components where possible.
- 029.004 Use client components only for interactivity.
- 029.005 Avoid huge icon imports.
- 029.006 Paginate lists.
- 029.007 Debounce search.
- 029.008 Cache public data safely.
- 029.009 Skeletons should not delay render.
- 029.010 Avoid layout shift.
- 029.011 API endpoints should respond quickly.
- 029.012 Search suggest target: under 150 ms local.
- 029.013 Public stats can revalidate.
- 029.014 Dashboard should parallel fetch where safe.
- 029.015 Acceptance: first screen feels instant in dev.

## 030. Release Milestones

- 030.001 Milestone A: auth, CORS, role links, design system.
- 030.002 Milestone B: landing/search/freelancers.
- 030.003 Milestone C: dashboard work center.
- 030.004 Milestone D: order workspace/chat.
- 030.005 Milestone E: matching/invites/saved search.
- 030.006 Milestone F: reviews/trust/moderation.
- 030.007 Milestone G: mobile/accessibility polish.
- 030.008 Milestone H: production readiness.
- 030.009 Each milestone needs build/test proof.
- 030.010 Each milestone needs manual UX pass.
- 030.011 Each milestone needs sync-file update.
- 030.012 Each backend milestone needs contract note.
- 030.013 Each frontend milestone needs screenshots or browser QA notes.

## 031. Immediate Next Actions

- 031.001 Codex: finish auth layout right-side promo.
- 031.002 Codex: ensure register role query works.
- 031.003 Codex: keep UI fresh and not AI-generated.
- 031.004 Codex: add/maintain custom SVG style.
- 031.005 Codex: polish homepage scenario cards.
- 031.006 Codex: polish search starter state.
- 031.007 Codex: polish dashboard role sections.
- 031.008 Codex: polish freelancer cards.
- 031.009 Codex: polish order cards.
- 031.010 Codex: polish support/chat UI.
- 031.011 Claude: implement robust CORS whitelist.
- 031.012 Claude: implement search suggest.
- 031.013 Claude: implement matching endpoints.
- 031.014 Claude: implement profile completeness.
- 031.015 Claude: implement invites.
- 031.016 Claude: implement saved search.
- 031.017 Claude: implement reviews.
- 031.018 Claude: extend notification events.
- 031.019 Claude: add moderation queue.
- 031.020 Both: update `docs/CODEX_CLAUDE_SYNC.md` after each contract decision.

## 032. Acceptance Summary

- 032.001 Product looks harmonious, custom, and relevant to freelance marketplace.
- 032.002 Product does not look like generic AI/SaaS template.
- 032.003 No emoji.
- 032.004 Custom SVG style is consistent.
- 032.005 Landing gives role paths immediately.
- 032.006 Register role query works.
- 032.007 CORS works locally.
- 032.008 Search is useful before and after query.
- 032.009 Dashboard tells user next action.
- 032.010 Order page explains deal state.
- 032.011 Chat supports deal workflow.
- 032.012 Wallet explains money state.
- 032.013 Matching is explainable.
- 032.014 Notifications lead to action.
- 032.015 Admin can moderate safely.
- 032.016 Tests and builds pass.
- 032.017 Sync file records contracts and blockers.

## 033. Communication Protocol

- 033.001 Owner: Codex and Claude.
- 033.002 Основной файл коммуникации: `docs/CODEX_CLAUDE_SYNC.md`.
- 033.003 Codex пишет туда frontend blockers.
- 033.004 Claude пишет туда backend blockers.
- 033.005 Codex пишет туда API requests.
- 033.006 Claude пишет туда API decisions.
- 033.007 Каждый API request должен иметь owner.
- 033.008 Каждый API request должен иметь endpoint.
- 033.009 Каждый API request должен иметь response shape.
- 033.010 Каждый API request должен иметь frontend screen.
- 033.011 Каждый API request должен иметь acceptance criteria.
- 033.012 Нельзя писать "сделать нормально" без конкретики.
- 033.013 Нельзя писать "улучшить дизайн" без указания screen.
- 033.014 Нельзя менять контракт молча.
- 033.015 Нельзя удалять чужие TODO.
- 033.016 Если задача закрыта, писать дату и proof.
- 033.017 Если задача заблокирована, писать blocker и next action.
- 033.018 Если нужно решение тимлида, писать вопрос явно.
- 033.019 Раз в крупный этап обновлять Handoff Log.
- 033.020 Acceptance: любой разработчик может понять текущий статус за 5 минут.

## 034. Role Boundaries

- 034.001 Owner: Codex and Claude.
- 034.002 Codex не меняет Prisma schema без явного согласования.
- 034.003 Codex не меняет backend business rules без записи в sync.
- 034.004 Codex может править frontend API consumption.
- 034.005 Codex может создавать missing endpoint docs.
- 034.006 Codex может создавать UI mocks against static fallback.
- 034.007 Claude не ломает frontend contracts без миграционного notes.
- 034.008 Claude добавляет DTO для новых endpoints.
- 034.009 Claude добавляет tests для новых endpoints.
- 034.010 Claude добавляет events в shared-types.
- 034.011 Shared types обновляются согласованно.
- 034.012 Если один трогает общий package, другой должен прочитать diff.
- 034.013 Если конфликт в файле, не откатывать чужие изменения.
- 034.014 Если нужен refactor, сначала записать proposal.
- 034.015 Если фича требует и front и back, разделить на contract first.
- 034.016 Acceptance: параллельная работа не ломает зоны ответственности.

## 035. Brand Consistency

- 035.001 Owner: Codex with тимлид decision.
- 035.002 Нужно решить финальное имя: TaskHunt или TuskHunt.
- 035.003 После решения заменить title.
- 035.004 После решения заменить metadata.
- 035.005 После решения заменить logo alt.
- 035.006 После решения заменить JSON-LD.
- 035.007 После решения заменить auth copy.
- 035.008 После решения заменить email templates.
- 035.009 После решения заменить notification copy.
- 035.010 После решения заменить docs user-facing mentions.
- 035.011 Не смешивать TaskHunt/TuskHunt на одном экране.
- 035.012 Logo должен быть читаемым на dark surface.
- 035.013 Logo должен быть читаемым на cream surface.
- 035.014 Favicon должен соответствовать brand.
- 035.015 Acceptance: пользователь видит одно имя продукта во всех flow.

## 036. Copy Inventory

- 036.001 Owner: Codex.
- 036.002 Составить список всех user-facing strings в auth.
- 036.003 Составить список всех user-facing strings на landing.
- 036.004 Составить список всех user-facing strings в dashboard.
- 036.005 Составить список всех user-facing strings в order detail.
- 036.006 Составить список всех user-facing strings в chat.
- 036.007 Составить список всех user-facing strings в support.
- 036.008 Составить список всех user-facing strings в admin.
- 036.009 Убрать канцелярит.
- 036.010 Убрать лишние объяснения.
- 036.011 Убрать повтор "безопасно" там, где уже видно escrow.
- 036.012 Сделать errors human readable.
- 036.013 Сделать empty states actionable.
- 036.014 Сделать CTA verbs consistent.
- 036.015 Acceptance: copy звучит как продукт, а не как документация.

## 037. Data State Matrix

- 037.001 Owner: Codex.
- 037.002 Каждый экран должен иметь loading state.
- 037.003 Каждый экран должен иметь empty state.
- 037.004 Каждый экран должен иметь error state.
- 037.005 Каждый экран должен иметь success state where relevant.
- 037.006 Каждый экран должен иметь unauthorized state if auth required.
- 037.007 Dashboard loading uses skeleton tiles.
- 037.008 Search loading uses result skeletons.
- 037.009 Freelancer loading uses profile card skeletons.
- 037.010 Order loading uses workspace skeleton.
- 037.011 Chat loading uses message skeleton.
- 037.012 Support loading uses ticket skeleton.
- 037.013 Error states offer retry.
- 037.014 Empty states offer next action.
- 037.015 Success states confirm completion.
- 037.016 Acceptance: no page shows raw JSON, raw error, or blank screen.

## 038. API Error Contract

- 038.001 Owner: Claude.
- 038.002 Backend errors should return consistent shape.
- 038.003 Shape: `message`.
- 038.004 Shape: `code`.
- 038.005 Shape: `fieldErrors` optional.
- 038.006 Shape: `requestId` optional.
- 038.007 Auth invalid credentials code.
- 038.008 Auth rate limit code.
- 038.009 Validation field code.
- 038.010 Forbidden role code.
- 038.011 Not enough balance code.
- 038.012 Invoice expired code.
- 038.013 Order closed code.
- 038.014 Bid already exists code.
- 038.015 File rejected code.
- 038.016 Codex maps codes to UI messages.
- 038.017 Acceptance: frontend does not parse random backend strings.

## 039. CORS and Environment

- 039.001 Owner: Claude.
- 039.002 Add `WEB_PUBLIC_URLS`.
- 039.003 Keep `WEB_PUBLIC_URL` for backwards compatibility.
- 039.004 Split comma separated origins.
- 039.005 Trim whitespace.
- 039.006 Reject unknown origins in production.
- 039.007 Allow no-origin server requests.
- 039.008 Allow local origins in development.
- 039.009 Apply same logic to chat gateway.
- 039.010 Add tests for allowed origin.
- 039.011 Add tests for rejected origin.
- 039.012 Add `.env.example` docs.
- 039.013 Update Docker compose env.
- 039.014 Acceptance: local browser on 3000 can call API on 3001.

## 040. Backend Seed Data

- 040.001 Owner: Claude.
- 040.002 Seed should create realistic categories.
- 040.003 Seed should create realistic skills.
- 040.004 Seed should create client users.
- 040.005 Seed should create freelancer users.
- 040.006 Seed should create open orders.
- 040.007 Seed should create active deals.
- 040.008 Seed should create completed deals.
- 040.009 Seed should create reviews after reviews feature.
- 040.010 Seed should create notifications.
- 040.011 Seed should create saved searches.
- 040.012 Seed should create invited freelancers.
- 040.013 Avoid lorem ipsum.
- 040.014 Use realistic Ukrainian/Russian marketplace categories.
- 040.015 Acceptance: frontend looks full in dev without manual data entry.

## 041. Category Strategy

- 041.001 Owner: Claude backend, Codex frontend.
- 041.002 Categories should support tree.
- 041.003 Frontend should show top-level categories first.
- 041.004 Frontend should show subcategories where useful.
- 041.005 Category icon should be custom SVG or CategoryIcon.
- 041.006 Category pages should show orders.
- 041.007 Category pages should show freelancers.
- 041.008 Category pages should show skills.
- 041.009 Category pages should show average budget after backend support.
- 041.010 Category pages should show demand/supply stats after backend support.
- 041.011 Acceptance: category is useful landing page, not just filter.

## 042. Pricing and Monetization UX

- 042.001 Owner: Codex and Claude.
- 042.002 Pricing page should explain fees.
- 042.003 Pricing page should explain escrow.
- 042.004 Pricing page should explain promotion.
- 042.005 Pricing should not feel like SaaS subscription unless product supports it.
- 042.006 Commission rules come from backend.
- 042.007 Promotion options should be clear.
- 042.008 Promoted order badge should be visible but not spammy.
- 042.009 Payment statuses should be clear.
- 042.010 Acceptance: user understands what platform charges and why.

## 043. Support UX

- 043.001 Owner: Codex.
- 043.002 Support page should start with common issue categories.
- 043.003 Ticket creation should be compact.
- 043.004 Ticket list should show status and last update.
- 043.005 Ticket thread should use chat-like UI.
- 043.006 Support responses should be visually distinct.
- 043.007 Support empty state should create ticket.
- 043.008 File attachments after backend support.
- 043.009 Ticket escalation after backend support.
- 043.010 Acceptance: user can ask support without leaving deal context.

## 044. Admin UX

- 044.001 Owner: Codex.
- 044.002 Admin should be utilitarian and dense.
- 044.003 No marketing-style cards in admin.
- 044.004 Tables should be scannable.
- 044.005 Filters should be visible.
- 044.006 Dangerous actions require confirmation.
- 044.007 Audit details should be readable.
- 044.008 Dispute panel should show money state.
- 044.009 User panel should show risk/trust state.
- 044.010 Feature flags should show environment.
- 044.011 Commission editor should show effective rate.
- 044.012 Acceptance: admin can operate repeated tasks quickly.

## 045. Security UX

- 045.001 Owner: Codex and Claude.
- 045.002 2FA setup should be guided.
- 045.003 Backup codes should be copyable.
- 045.004 Sessions list should show device/location if backend supports.
- 045.005 Revoke session action should be clear.
- 045.006 Password change should show success.
- 045.007 Email verification should be visible.
- 045.008 Wallet verification should be visible.
- 045.009 Security errors should be calm.
- 045.010 Acceptance: security features build trust, not fear.

## 046. File Upload UX

- 046.001 Owner: Codex and Claude.
- 046.002 Upload zone should show allowed types.
- 046.003 Upload should show progress.
- 046.004 Upload should show virus scanning if backend supports.
- 046.005 Rejected file should explain reason.
- 046.006 Uploaded file should show name.
- 046.007 Uploaded file should show type.
- 046.008 Uploaded file should show remove action.
- 046.009 Chat file card should be compact.
- 046.010 Order file list should be organized.
- 046.011 Acceptance: file flow feels safe and predictable.

## 047. Testing Plan

- 047.001 Owner: Codex and Claude.
- 047.002 Frontend unit tests for Toast stay.
- 047.003 Add frontend tests for register role query.
- 047.004 Add frontend tests for OAuth role link.
- 047.005 Add frontend tests for search params.
- 047.006 Add frontend tests for money formatting where needed.
- 047.007 Add API e2e for CORS origin.
- 047.008 Add API e2e for register.
- 047.009 Add API e2e for onboarding.
- 047.010 Add API e2e for matching.
- 047.011 Add service build checks.
- 047.012 Add smoke script for local dev.
- 047.013 Acceptance: core flows have automated coverage.

## 048. Browser QA Checklist

- 048.001 Owner: Codex.
- 048.002 Open `/`.
- 048.003 Click client scenario.
- 048.004 Verify `/register?role=CLIENT`.
- 048.005 Verify client role selected.
- 048.006 Go back.
- 048.007 Click freelancer scenario.
- 048.008 Verify `/register?role=FREELANCER`.
- 048.009 Verify freelancer role selected.
- 048.010 Submit invalid register.
- 048.011 Verify error displays.
- 048.012 Submit valid register against API.
- 048.013 Verify no CORS error.
- 048.014 Verify onboarding redirect.
- 048.015 Check mobile `/register`.
- 048.016 Check mobile `/search`.
- 048.017 Check dashboard authenticated.
- 048.018 Check dark mode.
- 048.019 Check no overlap with browser narrow width.
- 048.020 Acceptance: QA notes go to sync file.

## 049. Design Anti-Patterns

- 049.001 Owner: Codex.
- 049.002 Do not use emoji as UI icon.
- 049.003 Do not use generic AI sparkles.
- 049.004 Do not use unrelated 3D mascots.
- 049.005 Do not use purple-blue gradient as main identity.
- 049.006 Do not use oversized marketing cards inside workspace.
- 049.007 Do not put cards inside cards.
- 049.008 Do not hide primary action under decorative content.
- 049.009 Do not over-explain basic controls.
- 049.010 Do not use tiny low-contrast text for key statuses.
- 049.011 Do not make dark promo block dominate mobile auth.
- 049.012 Do not animate layout in a way that shifts text.
- 049.013 Do not make hover required for understanding.
- 049.014 Do not fake live data without label.
- 049.015 Acceptance: interface looks authored, not generated.

## 050. Product Delight Without Noise

- 050.001 Owner: Codex.
- 050.002 Delight should come from clarity.
- 050.003 Delight should come from good empty states.
- 050.004 Delight should come from fast flows.
- 050.005 Delight should come from visible progress.
- 050.006 Delight should come from calm trust signals.
- 050.007 Delight should come from custom SVG moments.
- 050.008 Delight should come from smooth selected states.
- 050.009 Delight should come from useful recommendations.
- 050.010 Delight should not come from random animations.
- 050.011 Delight should not come from decorative clutter.
- 050.012 Delight should not obscure marketplace density.
- 050.013 Add small mascot moments only in success/empty states.
- 050.014 Mascot should not cover content.
- 050.015 Acceptance: product feels friendly without being childish.

## 051. Developer Workflow

- 051.001 Owner: Codex and Claude.
- 051.002 Before work: read sync file.
- 051.003 Before work: read relevant roadmap section.
- 051.004 Before backend change: check frontend API requests.
- 051.005 Before frontend integration: check API decisions.
- 051.006 During work: update blocker if blocked.
- 051.007 After work: run scoped tests.
- 051.008 After work: update handoff log.
- 051.009 After work: write changed files summary.
- 051.010 Avoid broad unrelated refactors.
- 051.011 Keep commits scoped if committing.
- 051.012 Preserve user/other-agent changes.
- 051.013 Acceptance: handoff is always understandable.

## 052. Final Product Bar

- 052.001 TaskHunt can be opened by a new user without explanation.
- 052.002 User knows whether they are client or freelancer.
- 052.003 User can search immediately.
- 052.004 User can register from chosen scenario.
- 052.005 User can complete onboarding.
- 052.006 User can see useful dashboard.
- 052.007 User can create or find order.
- 052.008 User can understand escrow.
- 052.009 User can chat inside order.
- 052.010 User can pay or receive money with clear status.
- 052.011 User can trust profiles through reviews and badges.
- 052.012 Admin can moderate and operate.
- 052.013 Notifications bring user back to next action.
- 052.014 Backend contracts are stable.
- 052.015 Frontend feels fresh and harmonious.
- 052.016 No emoji.
- 052.017 No generic AI visual language.
- 052.018 Custom SVG style is consistent.
- 052.019 Build/test pass.
- 052.020 Team sync file is current.
