-- AlterTable
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE IF NOT EXISTS "saved_payout_addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "saved_payout_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "saved_payout_addresses_userId_idx" ON "saved_payout_addresses"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "saved_payout_addresses_userId_network_address_key" ON "saved_payout_addresses"("userId", "network", "address");

-- AddForeignKey
ALTER TABLE "saved_payout_addresses" ADD CONSTRAINT "saved_payout_addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
