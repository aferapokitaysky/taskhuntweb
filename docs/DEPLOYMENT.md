# Деплой на один хост (VPS)

Конфиги для этого гайда: [`deploy/nginx/taskhunt.conf`](../deploy/nginx/taskhunt.conf) (боевой), [`deploy/nginx/taskhunt-bootstrap.conf`](../deploy/nginx/taskhunt-bootstrap.conf) (временный, только для первого выпуска сертификатов), [`docker-compose.prod.yml`](../docker-compose.prod.yml).
Везде ниже `taskhunt.example` — замените на реальный домен.

## Топология поддоменов

| Поддомен                  | Что отдаёт                                   |
| -------------------------- | --------------------------------------------- |
| `taskhunt.example` (apex)  | Фронтенд (Next.js)                            |
| `www.taskhunt.example`     | 301 → apex                                    |
| `api.taskhunt.example`     | Бэкенд (NestJS) + WebSocket (Socket.IO чат)   |
| `admin.taskhunt.example`   | 301 → `apex/admin` (админка — это роут `/admin` внутри того же Next.js-приложения, отдельного сервиса под неё нет) |

## 1. DNS

A-записи (или AAAA для IPv6) на IP сервера:

```
taskhunt.example       A   <IP сервера>
www.taskhunt.example    A   <IP сервера>
api.taskhunt.example    A   <IP сервера>
admin.taskhunt.example  A   <IP сервера>
```

Подождите распространения (обычно до часа, `dig taskhunt.example` должен вернуть ваш IP) прежде чем выпускать сертификаты.

## 2. Сервер: базовые пакеты

```bash
apt update && apt install -y nginx certbot python3-certbot-nginx docker.io docker-compose-plugin
```

## 3. nginx и сертификаты — по шагам, порядок важен

`deploy/nginx/taskhunt.conf` уже ссылается на сертификаты в HTTPS-блоках. Если
положить его целиком ДО того, как сертификаты реально существуют на диске,
`nginx -t` откажется стартовать конфиг вообще (не найдёт файлы
`/etc/letsencrypt/live/...`) — а значит не заработает даже HTTP-часть, через
которую certbot обычно и подтверждает домен. Поэтому сначала — только
HTTP (порт 80), потом сертификаты, потом полный конфиг с HTTPS.

```bash
sed -i 's/taskhunt.example/ваш-реальный-домен/g' deploy/nginx/taskhunt.conf deploy/nginx/taskhunt-bootstrap.conf
mkdir -p /var/www/certbot

# Шаг 1: временный конфиг без ssl_certificate — им certbot подтвердит домены
# через /.well-known/acme-challenge/, которую он и отдаёт.
cp deploy/nginx/taskhunt-bootstrap.conf /etc/nginx/sites-available/taskhunt.conf
ln -sf /etc/nginx/sites-available/taskhunt.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Шаг 2: выпустить сертификат (webroot — не трогает конфиг nginx сам,
# просто читает файл-челлендж из /var/www/certbot, который отдаёт шаг 1)
certbot certonly --webroot -w /var/www/certbot \
  -d taskhunt.example -d www.taskhunt.example \
  -d api.taskhunt.example -d admin.taskhunt.example

# Шаг 3: теперь сертификаты существуют — деплоим полный конфиг с HTTPS
cp deploy/nginx/taskhunt.conf /etc/nginx/sites-available/taskhunt.conf
nginx -t && systemctl reload nginx
```

Один сертификат сразу на все 4 имени — `deploy/nginx/taskhunt.conf` ссылается на один путь `/etc/letsencrypt/live/taskhunt.example/`. Автообновление certbot ставит сам (systemd timer) и просто перевыпускает файлы по тем же путям — конфиг nginx трогать не нужно, только `systemctl reload nginx` после обновления (certbot's deploy-hook может сделать это сам, см. `certbot renew --dry-run` и `/etc/letsencrypt/renewal-hooks/deploy/`).

## 4. `.env` файлы

Скопируйте `.env.example` → `.env` в каждом сервисе (`apps/api`, `apps/web`, `apps/notifications-service`, `apps/fraud-service`) и заполните секреты. Для этой топологии в `apps/api/.env` и `apps/web/.env` важны конкретно:

```bash
# apps/api/.env
API_PUBLIC_URL=https://api.taskhunt.example
WEB_PUBLIC_URL=https://taskhunt.example
NODE_ENV=production
BULL_BOARD_USER=...       # обязателен в prod, иначе /admin/queues откажется стартовать
BULL_BOARD_PASSWORD=...
DATABASE_URL="postgresql://taskhunt:<тот же пароль, что и POSTGRES_PASSWORD ниже>@postgres:5432/taskhunt?schema=public"
```

```bash
# apps/web/.env
NEXT_PUBLIC_API_URL=https://api.taskhunt.example
NEXT_PUBLIC_WEB_URL=https://taskhunt.example
```

`NEXT_PUBLIC_*` и `POSTGRES_PASSWORD` дополнительно нужно передать как shell-переменные (или положить в `.env` в корне репо — `docker compose` читает его сам) перед сборкой/запуском — `docker-compose.prod.yml` пробрасывает первые в build ARG, второй — в контейнер postgres:

```bash
export NEXT_PUBLIC_API_URL=https://api.taskhunt.example
export NEXT_PUBLIC_WEB_URL=https://taskhunt.example
export POSTGRES_PASSWORD=<сгенерированный пароль>   # должен совпадать с паролем в DATABASE_URL выше
```

## 5. Сборка и запуск

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Миграции и сид (один раз при первом деплое, дальше — только миграции при каждом релизе со сменой схемы):

```bash
docker compose exec api pnpm prisma migrate deploy
docker compose exec api pnpm prisma db seed
```

## 6. Проверка

- `curl -I https://taskhunt.example` → 200
- `curl -I https://www.taskhunt.example` → 301 → `https://taskhunt.example/`
- `curl -I https://admin.taskhunt.example` → 301 → `https://taskhunt.example/admin`
- `curl https://api.taskhunt.example/health` → 200
- Открыть `https://taskhunt.example/chats` и отправить сообщение — если WebSocket-проксирование в nginx настроено верно, сообщение доставляется мгновенно, без 15-секундного поллинга (значит апгрейд до WS прошёл, не откатился на polling).

## Обновление на новый релиз

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose exec api pnpm prisma migrate deploy   # если были новые миграции
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
