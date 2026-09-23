-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "shippingAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "shippingMethod" JSONB,
ADD COLUMN     "taxInclusive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unpaidExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "actionJson" JSONB;

-- CreateIndex
CREATE INDEX "orders_paymentStatus_unpaidExpiresAt_idx" ON "orders"("paymentStatus", "unpaidExpiresAt");
