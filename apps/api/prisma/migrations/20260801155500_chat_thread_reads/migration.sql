-- Track per-user read state for order chat threads.
CREATE TABLE "chat_thread_reads" (
  "threadId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "chat_thread_reads_pkey" PRIMARY KEY ("threadId", "userId")
);

CREATE INDEX "chat_thread_reads_userId_lastReadAt_idx" ON "chat_thread_reads"("userId", "lastReadAt");

ALTER TABLE "chat_thread_reads"
  ADD CONSTRAINT "chat_thread_reads_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_thread_reads"
  ADD CONSTRAINT "chat_thread_reads_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
