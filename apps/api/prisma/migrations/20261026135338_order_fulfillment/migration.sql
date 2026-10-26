-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "fulfillmentId" TEXT,
ADD COLUMN     "fulfillmentStatus" TEXT;

-- CreateIndex
CREATE INDEX "shipments_fulfillmentId_idx" ON "shipments"("fulfillmentId");
