-- DropIndex
DROP INDEX "chat_threads_orderId_key";

-- AlterTable: добавляем колонку nullable, чтобы сначала забэкфиллить
ALTER TABLE "chat_threads" ADD COLUMN "freelancerId" TEXT;

-- Backfill: для уже существующих тредов (созданных строго при принятии
-- отклика) фрилансер — это фрилансер принятого отклика заказа.
UPDATE "chat_threads" ct
SET "freelancerId" = b."freelancerId"
FROM "orders" o
JOIN "bids" b ON b."id" = o."acceptedBidId"
WHERE ct."orderId" = o."id";

-- Теперь колонка обязательна — один тред больше не привязан только к
-- заказу, а к паре (заказ, фрилансер), чтобы заказчик мог писать любому
-- откликнувшемуся ещё до принятия отклика.
ALTER TABLE "chat_threads" ALTER COLUMN "freelancerId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "chat_threads_orderId_freelancerId_key" ON "chat_threads"("orderId", "freelancerId");

-- AddForeignKey
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
