-- CreateTable
CREATE TABLE IF NOT EXISTS "fraud_signals" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "reasons" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fraud_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "fraud_signals_orderId_key" ON "fraud_signals"("orderId");
