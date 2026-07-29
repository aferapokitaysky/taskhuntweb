-- CreateEnum
CREATE TYPE "DigestFrequency" AS ENUM ('NONE', 'DAILY', 'WEEKLY');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "digestFrequency" "DigestFrequency" NOT NULL DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS "lastDigestSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "vacationUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "autoWithdrawThreshold" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "autoWithdrawAddressId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "skill_endorsements" (
    "id" TEXT NOT NULL,
    "endorserId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_endorsements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "skill_endorsements_endorserId_targetId_skillId_orderId_key" ON "skill_endorsements"("endorserId", "targetId", "skillId", "orderId");

-- AddForeignKey
ALTER TABLE "skill_endorsements" ADD CONSTRAINT "skill_endorsements_endorserId_fkey" FOREIGN KEY ("endorserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_endorsements" ADD CONSTRAINT "skill_endorsements_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_endorsements" ADD CONSTRAINT "skill_endorsements_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_endorsements" ADD CONSTRAINT "skill_endorsements_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
