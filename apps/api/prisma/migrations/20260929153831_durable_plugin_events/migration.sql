-- CreateEnum
CREATE TYPE "EventDeliveryStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'SKIPPED', 'FAILED');

-- DropForeignKey
ALTER TABLE "webhook_dead_letters" DROP CONSTRAINT "webhook_dead_letters_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "webhook_delivery_logs" DROP CONSTRAINT "webhook_delivery_logs_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "webhook_subscriptions" DROP CONSTRAINT "webhook_subscriptions_installationId_fkey";

-- DropTable
DROP TABLE "outbox_events";

-- DropTable
DROP TABLE "webhook_dead_letters";

-- DropTable
DROP TABLE "webhook_delivery_logs";

-- DropTable
DROP TABLE "webhook_subscriptions";

-- CreateTable
CREATE TABLE "event_records" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "traceId" TEXT,
    "actorId" TEXT,

    CONSTRAINT "event_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_deliveries" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "status" "EventDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMPTZ(3),
    "claimToken" TEXT,
    "claimedBy" TEXT,
    "lastError" TEXT,
    "skipReason" TEXT,
    "finishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_event_subscriptions" (
    "pluginSlug" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,

    CONSTRAINT "plugin_event_subscriptions_pkey" PRIMARY KEY ("pluginSlug","eventType","version")
);

-- CreateIndex
CREATE INDEX "event_records_occurredAt_id_idx" ON "event_records"("occurredAt", "id");

-- CreateIndex
CREATE INDEX "event_records_aggregateId_idx" ON "event_records"("aggregateId");

-- CreateIndex
CREATE INDEX "event_deliveries_status_installationId_nextAttemptAt_id_idx" ON "event_deliveries"("status", "installationId", "nextAttemptAt", "id");

-- CreateIndex
CREATE INDEX "event_deliveries_status_leaseUntil_idx" ON "event_deliveries"("status", "leaseUntil");

-- CreateIndex
CREATE INDEX "event_deliveries_status_finishedAt_idx" ON "event_deliveries"("status", "finishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "event_deliveries_eventId_installationId_key" ON "event_deliveries"("eventId", "installationId");

-- CreateIndex
CREATE INDEX "plugin_event_subscriptions_eventType_version_pluginSlug_idx" ON "plugin_event_subscriptions"("eventType", "version", "pluginSlug");

-- AddForeignKey
ALTER TABLE "event_deliveries" ADD CONSTRAINT "event_deliveries_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_event_subscriptions" ADD CONSTRAINT "plugin_event_subscriptions_pluginSlug_fkey" FOREIGN KEY ("pluginSlug") REFERENCES "plugin_installs"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
