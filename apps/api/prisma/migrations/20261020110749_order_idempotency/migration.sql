-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "idempotencyFingerprint" TEXT,
ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotencyKey_key" ON "orders"("idempotencyKey");
