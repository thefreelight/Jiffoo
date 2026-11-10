-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('UNKNOWN', 'DELIVERED', 'DELAYED', 'BOUNCED', 'COMPLAINED', 'FAILED');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "deliveryStatus" "NotificationDeliveryStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "deliveryUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "notification_receipts" (
    "id" TEXT NOT NULL,
    "providerSlug" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadHash" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,

    CONSTRAINT "notification_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_receipts_providerSlug_providerMessageId_recipi_idx" ON "notification_receipts"("providerSlug", "providerMessageId", "recipient");

-- CreateIndex
CREATE INDEX "notification_receipts_notificationId_occurredAt_idx" ON "notification_receipts"("notificationId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_receipts_providerSlug_eventId_key" ON "notification_receipts"("providerSlug", "eventId");

-- CreateIndex
CREATE INDEX "notifications_deliveryStatus_createdAt_idx" ON "notifications"("deliveryStatus", "createdAt");

-- AddForeignKey
ALTER TABLE "notification_receipts" ADD CONSTRAINT "notification_receipts_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

