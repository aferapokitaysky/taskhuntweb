-- CreateTable
CREATE TABLE "wallet_deposits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "nowPaymentsPaymentId" TEXT,
    "payAddress" TEXT,
    "payAmount" DECIMAL(18,8),
    "payCurrency" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_deposits_nowPaymentsPaymentId_key" ON "wallet_deposits"("nowPaymentsPaymentId");

-- CreateIndex
CREATE INDEX "wallet_deposits_userId_idx" ON "wallet_deposits"("userId");

-- CreateIndex
CREATE INDEX "wallet_deposits_status_idx" ON "wallet_deposits"("status");

-- AddForeignKey
ALTER TABLE "wallet_deposits" ADD CONSTRAINT "wallet_deposits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
