-- AlterTable
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deadlineWarningSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "bids" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "dispute_files" (
    "disputeId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,

    CONSTRAINT "dispute_files_pkey" PRIMARY KEY ("disputeId","fileId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "deadline_extension_requests" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "newDeadline" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deadline_extension_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "order_templates" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "budgetMin" DECIMAL(12,2) NOT NULL,
    "budgetMax" DECIMAL(12,2),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "frequency" TEXT NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "search_logs" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "client_blocks" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "search_logs_createdAt_idx" ON "search_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "client_blocks_clientId_freelancerId_key" ON "client_blocks"("clientId", "freelancerId");

-- AddForeignKey
ALTER TABLE "dispute_files" ADD CONSTRAINT "dispute_files_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_files" ADD CONSTRAINT "dispute_files_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_extension_requests" ADD CONSTRAINT "deadline_extension_requests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_templates" ADD CONSTRAINT "order_templates_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_templates" ADD CONSTRAINT "order_templates_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_blocks" ADD CONSTRAINT "client_blocks_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_blocks" ADD CONSTRAINT "client_blocks_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
