-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN     "disputeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_disputeId_key" ON "support_tickets"("disputeId");

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "disputes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

