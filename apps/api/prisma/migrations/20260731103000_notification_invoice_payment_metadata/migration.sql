ALTER TABLE "invoices"
  ADD COLUMN "payAddress" TEXT,
  ADD COLUMN "payAmount" DECIMAL(18,8),
  ADD COLUMN "payCurrency" TEXT;

ALTER TABLE "notifications"
  ADD COLUMN "metadata" JSONB;
