-- CreateTable
CREATE TABLE "banned_ips" (
    "ip" TEXT NOT NULL,
    "reason" TEXT,
    "bannedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banned_ips_pkey" PRIMARY KEY ("ip")
);

