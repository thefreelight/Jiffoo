-- CreateTable
CREATE TABLE "order_purchase_claims" (
    "orderId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_purchase_claims_pkey" PRIMARY KEY ("orderId")
);

-- AddForeignKey
ALTER TABLE "order_purchase_claims" ADD CONSTRAINT "order_purchase_claims_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
