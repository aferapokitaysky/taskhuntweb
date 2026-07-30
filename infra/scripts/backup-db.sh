#!/usr/bin/env bash
# Бэкап Postgres в S3-совместимое хранилище (тот же S3_* набор переменных,
# что уже используется в apps/api/.env для аплоада файлов — R2/Spaces/S3,
# любой S3-совместимый провайдер подходит).
#
# Использование (cron, ежедневно в 03:00):
#   0 3 * * * DATABASE_URL=... S3_BUCKET=... S3_ACCESS_KEY_ID=... \
#     S3_SECRET_ACCESS_KEY=... S3_REGION=... /path/to/backup-db.sh
#
# Требует: pg_dump (postgresql-client), aws-cli (или совместимый s3cmd/rclone
# — здесь используется aws cli как самый распространённый вариант).
#
# ВАЖНО: этот скрипт не запускался и не тестировался против реального
# облачного хранилища в этой сессии (нет staging S3-бакета под рукой) —
# перед первым продовым запуском проверьте вручную один раз, что
# аплоад/скачивание реально работают с вашими S3-креденшлами.

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL не задан}"
: "${S3_BUCKET:?S3_BUCKET не задан}"
: "${S3_ACCESS_KEY_ID:?S3_ACCESS_KEY_ID не задан}"
: "${S3_SECRET_ACCESS_KEY:?S3_SECRET_ACCESS_KEY не задан}"
: "${S3_REGION:?S3_REGION не задан}"

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
DUMP_FILE="/tmp/taskhunt-db-${TIMESTAMP}.sql.gz"
S3_KEY="db-backups/taskhunt-db-${TIMESTAMP}.sql.gz"

echo "[backup-db] Дамп БД → ${DUMP_FILE}"
pg_dump "${DATABASE_URL}" | gzip > "${DUMP_FILE}"

echo "[backup-db] Загрузка в s3://${S3_BUCKET}/${S3_KEY}"
AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}" \
AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}" \
AWS_DEFAULT_REGION="${S3_REGION}" \
  aws s3 cp "${DUMP_FILE}" "s3://${S3_BUCKET}/${S3_KEY}"

rm -f "${DUMP_FILE}"

echo "[backup-db] Удаление бэкапов старше ${RETENTION_DAYS} дней"
CUTOFF_EPOCH="$(date -u -d "-${RETENTION_DAYS} days" +%s 2>/dev/null || date -u -v-"${RETENTION_DAYS}"d +%s)"

AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}" \
AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}" \
AWS_DEFAULT_REGION="${S3_REGION}" \
  aws s3api list-objects-v2 --bucket "${S3_BUCKET}" --prefix "db-backups/" \
  --query "Contents[?LastModified<='$(date -u -d "-${RETENTION_DAYS} days" -Iseconds 2>/dev/null || date -u -v-"${RETENTION_DAYS}"d -Iseconds)'].Key" \
  --output text | tr '\t' '\n' | while read -r key; do
    [ -z "${key}" ] && continue
    echo "[backup-db] Удаляю старый бэкап: ${key}"
    AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}" \
    AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}" \
    AWS_DEFAULT_REGION="${S3_REGION}" \
      aws s3 rm "s3://${S3_BUCKET}/${key}"
  done

echo "[backup-db] Готово: ${S3_KEY}"
