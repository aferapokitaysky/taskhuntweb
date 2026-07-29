-- AlterTable
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "availableForWork" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE IF NOT EXISTS "saved_freelancers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_freelancers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "saved_freelancers_userId_freelancerId_key" ON "saved_freelancers"("userId", "freelancerId");

-- AddForeignKey
ALTER TABLE "saved_freelancers" ADD CONSTRAINT "saved_freelancers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_freelancers" ADD CONSTRAINT "saved_freelancers_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
