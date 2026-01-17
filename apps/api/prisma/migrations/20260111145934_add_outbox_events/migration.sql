-- CreateTable
CREATE TABLE "core"."outbox_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "traceId" TEXT,
    "actorId" TEXT,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_events_published_occurredAt_idx" ON "core"."outbox_events"("published", "occurredAt");

-- CreateIndex
CREATE INDEX "outbox_events_aggregateId_idx" ON "core"."outbox_events"("aggregateId");
