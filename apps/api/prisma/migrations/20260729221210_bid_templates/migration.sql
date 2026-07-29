-- CreateTable
CREATE TABLE "bid_templates" (
    "id" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "defaultDeliveryDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bid_templates_freelancerId_idx" ON "bid_templates"("freelancerId");

-- AddForeignKey
ALTER TABLE "bid_templates" ADD CONSTRAINT "bid_templates_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

