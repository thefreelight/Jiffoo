-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OrderItemFulfillmentStatus" AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'failed');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'SHIPPED', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentLedgerEventType" AS ENUM ('CREATED', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "RefundLedgerEventType" AS ENUM ('CREATED', 'SUCCEEDED', 'FAILED');

-- DropIndex
DROP INDEX "payments_paymentIntentId_idx";

-- DropIndex
DROP INDEX "payments_sessionId_idx";

-- DropIndex
DROP INDEX "shipment_items_status_idx";

-- DropIndex
DROP INDEX "shipment_items_trackingNumber_idx";

-- AlterTable
ALTER TABLE "cart_items" ALTER COLUMN "price" SET DATA TYPE DECIMAL(18,2),
DROP COLUMN "fulfillmentData",
ADD COLUMN     "fulfillmentData" JSONB;

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "structuredData",
ADD COLUMN     "structuredData" JSONB;

-- AlterTable
ALTER TABLE "error_logs" ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "external_variant_links" ALTER COLUMN "sourceCostPrice" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "installed_themes" DROP COLUMN "config",
ADD COLUMN     "config" JSONB;

-- AlterTable
ALTER TABLE "inventory_adjustments" DROP COLUMN "metadata",
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "inventory_reservations" DROP COLUMN "status",
ADD COLUMN     "status" "InventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "inventory_transfers" DROP COLUMN "metadata",
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "order_items" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(18,2),
DROP COLUMN "fulfillmentStatus",
ADD COLUMN     "fulfillmentStatus" "OrderItemFulfillmentStatus" NOT NULL DEFAULT 'pending',
DROP COLUMN "fulfillmentData",
ADD COLUMN     "fulfillmentData" JSONB;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "storeId" TEXT NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
DROP COLUMN "paymentStatus",
ADD COLUMN     "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "subtotalAmount" DROP DEFAULT,
ALTER COLUMN "subtotalAmount" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "discountAmount" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "taxAmount" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "providerEventId" TEXT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2),
DROP COLUMN "status",
ADD COLUMN     "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'PENDING',
DROP COLUMN "metadata",
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "plugin_installations" ADD COLUMN     "lifecycleWarning" TEXT,
DROP COLUMN "configJson",
ADD COLUMN     "configJson" JSONB,
DROP COLUMN "grantedPermissions",
ADD COLUMN     "grantedPermissions" JSONB;

-- AlterTable
ALTER TABLE "plugin_installs" DROP COLUMN "manifestJson",
ADD COLUMN     "manifestJson" JSONB,
DROP COLUMN "permissions",
ADD COLUMN     "permissions" JSONB;

-- AlterTable
ALTER TABLE "product_variants" DROP COLUMN "attributes",
ADD COLUMN     "attributes" JSONB,
ALTER COLUMN "salePrice" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "costPrice" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "storeId" TEXT NOT NULL,
DROP COLUMN "typeData",
ADD COLUMN     "typeData" JSONB,
DROP COLUMN "structuredData",
ADD COLUMN     "structuredData" JSONB;

-- AlterTable
ALTER TABLE "refunds" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,2),
DROP COLUMN "status",
ADD COLUMN     "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
DROP COLUMN "metadata",
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "shipment_items" DROP COLUMN "carrier",
DROP COLUMN "deliveredAt",
DROP COLUMN "metadata",
DROP COLUMN "shippedAt",
DROP COLUMN "status",
DROP COLUMN "trackingNumber",
ADD COLUMN     "quantity" INTEGER NOT NULL,
ADD COLUMN     "shipmentId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "system_settings" DROP COLUMN "settings",
ADD COLUMN     "settings" JSONB;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "storeId" TEXT,
ADD COLUMN     "verificationToken" TEXT,
ADD COLUMN     "verificationTokenExpiry" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "supportedLocales" JSONB,
    "settings" JSONB,
    "logo" TEXT,
    "themeConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_shipping_addresses" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "country" TEXT NOT NULL,
    "postalCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_shipping_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "fromPaymentStatus" "OrderPaymentStatus",
    "toPaymentStatus" "OrderPaymentStatus",
    "reason" TEXT,
    "actorType" TEXT,
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_ledger" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "eventType" "PaymentLedgerEventType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "provider" TEXT,
    "providerEventId" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_ledger" (
    "id" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "eventType" "RefundLedgerEventType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "provider" TEXT,
    "providerRefundId" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "stores_domain_key" ON "stores"("domain");

-- CreateIndex
CREATE INDEX "stores_status_idx" ON "stores"("status");

-- CreateIndex
CREATE UNIQUE INDEX "order_shipping_addresses_orderId_key" ON "order_shipping_addresses"("orderId");

-- CreateIndex
CREATE INDEX "order_shipping_addresses_orderId_idx" ON "order_shipping_addresses"("orderId");

-- CreateIndex
CREATE INDEX "order_status_history_orderId_idx" ON "order_status_history"("orderId");

-- CreateIndex
CREATE INDEX "order_status_history_createdAt_idx" ON "order_status_history"("createdAt");

-- CreateIndex
CREATE INDEX "shipments_orderId_idx" ON "shipments"("orderId");

-- CreateIndex
CREATE INDEX "shipments_trackingNumber_idx" ON "shipments"("trackingNumber");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "payment_ledger_paymentId_idx" ON "payment_ledger"("paymentId");

-- CreateIndex
CREATE INDEX "payment_ledger_orderId_idx" ON "payment_ledger"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_ledger_providerEventId_key" ON "payment_ledger"("providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_ledger_idempotencyKey_key" ON "payment_ledger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "refund_ledger_refundId_idx" ON "refund_ledger"("refundId");

-- CreateIndex
CREATE INDEX "refund_ledger_paymentId_idx" ON "refund_ledger"("paymentId");

-- CreateIndex
CREATE INDEX "refund_ledger_orderId_idx" ON "refund_ledger"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "refund_ledger_providerRefundId_key" ON "refund_ledger"("providerRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "refund_ledger_idempotencyKey_key" ON "refund_ledger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "error_logs_storeId_idx" ON "error_logs"("storeId");

-- CreateIndex
CREATE INDEX "inventory_reservations_expiresAt_status_idx" ON "inventory_reservations"("expiresAt", "status");

-- CreateIndex
CREATE INDEX "inventory_reservations_productId_status_idx" ON "inventory_reservations"("productId", "status");

-- CreateIndex
CREATE INDEX "inventory_reservations_variantId_status_idx" ON "inventory_reservations"("variantId", "status");

-- CreateIndex
CREATE INDEX "order_items_fulfillmentStatus_idx" ON "order_items"("fulfillmentStatus");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_paymentStatus_idx" ON "orders"("paymentStatus");

-- CreateIndex
CREATE INDEX "orders_storeId_idx" ON "orders"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "payments_providerEventId_key" ON "payments"("providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentIntentId_key" ON "payments"("paymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_sessionId_key" ON "payments"("sessionId");

-- CreateIndex
CREATE INDEX "products_storeId_idx" ON "products"("storeId");

-- CreateIndex
CREATE INDEX "shipment_items_shipmentId_idx" ON "shipment_items"("shipmentId");

-- CreateIndex
CREATE INDEX "users_storeId_idx" ON "users"("storeId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipping_addresses" ADD CONSTRAINT "order_shipping_addresses_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_ledger" ADD CONSTRAINT "payment_ledger_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_ledger" ADD CONSTRAINT "payment_ledger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_ledger" ADD CONSTRAINT "refund_ledger_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "refunds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_ledger" ADD CONSTRAINT "refund_ledger_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_ledger" ADD CONSTRAINT "refund_ledger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

