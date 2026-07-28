-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'EMAIL', 'TELEGRAM', 'IN_APP', 'SMS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_userId_channel_key" ON "notification_preferences"("userId", "channel");
