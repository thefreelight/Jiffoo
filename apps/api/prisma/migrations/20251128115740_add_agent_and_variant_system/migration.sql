/*
  Warnings:

  - A unique constraint covering the columns `[orderId,productId,variantId]` on the table `inventory_reservations` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."inventory_reservations_orderId_productId_key";

-- AlterTable
ALTER TABLE "inventory_reservations" ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "agentCommissionCalculated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "agentId" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "agentCanDelegate" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "attributes" TEXT,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "baseStock" INTEGER NOT NULL DEFAULT 0,
    "skuCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "agentCanDelegate" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "parentAgentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedByTenantId" INTEGER,
    "invitedByAgentId" TEXT,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "availableBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_mall_configs" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "themeSlug" TEXT,
    "themeConfig" TEXT,
    "settings" TEXT,
    "defaultDomainType" TEXT NOT NULL DEFAULT 'platform',
    "byokConfig" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_mall_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_domains" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "host" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sslConfigured" BOOLEAN NOT NULL DEFAULT false,
    "dnsVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_level_configs" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "maxAgentsPerParent" INTEGER NOT NULL DEFAULT 100,
    "maxProducts" INTEGER,
    "l1ShareRate" DOUBLE PRECISION,
    "l2ShareRate" DOUBLE PRECISION,
    "l3ShareRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_level_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_commissions" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "agentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "agentLevel" INTEGER NOT NULL,
    "sourceAgentId" TEXT,
    "orderAmount" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "settleAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_variant_self_configs" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "canSellSelf" BOOLEAN NOT NULL DEFAULT true,
    "selfPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_variant_self_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_variant_children_configs" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "canDelegateProduct" BOOLEAN NOT NULL DEFAULT true,
    "canDelegateVariant" BOOLEAN NOT NULL DEFAULT true,
    "priceForChildren" DOUBLE PRECISION,
    "priceForChildrenMin" DOUBLE PRECISION,
    "priceForChildrenMax" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_variant_children_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_variants_productId_idx" ON "product_variants"("productId");

-- CreateIndex
CREATE INDEX "product_variants_tenantId_idx" ON "product_variants"("tenantId");

-- CreateIndex
CREATE INDEX "product_variants_skuCode_idx" ON "product_variants"("skuCode");

-- CreateIndex
CREATE INDEX "agents_tenantId_idx" ON "agents"("tenantId");

-- CreateIndex
CREATE INDEX "agents_userId_idx" ON "agents"("userId");

-- CreateIndex
CREATE INDEX "agents_parentAgentId_idx" ON "agents"("parentAgentId");

-- CreateIndex
CREATE INDEX "agents_level_idx" ON "agents"("level");

-- CreateIndex
CREATE INDEX "agents_status_idx" ON "agents"("status");

-- CreateIndex
CREATE UNIQUE INDEX "agents_tenantId_code_key" ON "agents"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "agents_tenantId_userId_key" ON "agents"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_mall_configs_agentId_key" ON "agent_mall_configs"("agentId");

-- CreateIndex
CREATE INDEX "agent_mall_configs_tenantId_idx" ON "agent_mall_configs"("tenantId");

-- CreateIndex
CREATE INDEX "agent_domains_agentId_idx" ON "agent_domains"("agentId");

-- CreateIndex
CREATE INDEX "agent_domains_tenantId_idx" ON "agent_domains"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_domains_host_key" ON "agent_domains"("host");

-- CreateIndex
CREATE INDEX "agent_level_configs_tenantId_idx" ON "agent_level_configs"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_level_configs_tenantId_level_key" ON "agent_level_configs"("tenantId", "level");

-- CreateIndex
CREATE INDEX "agent_commissions_tenantId_idx" ON "agent_commissions"("tenantId");

-- CreateIndex
CREATE INDEX "agent_commissions_agentId_idx" ON "agent_commissions"("agentId");

-- CreateIndex
CREATE INDEX "agent_commissions_orderId_idx" ON "agent_commissions"("orderId");

-- CreateIndex
CREATE INDEX "agent_commissions_status_idx" ON "agent_commissions"("status");

-- CreateIndex
CREATE INDEX "agent_commissions_settleAt_idx" ON "agent_commissions"("settleAt");

-- CreateIndex
CREATE INDEX "agent_variant_self_configs_tenantId_idx" ON "agent_variant_self_configs"("tenantId");

-- CreateIndex
CREATE INDEX "agent_variant_self_configs_ownerType_ownerId_idx" ON "agent_variant_self_configs"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "agent_variant_self_configs_productId_idx" ON "agent_variant_self_configs"("productId");

-- CreateIndex
CREATE INDEX "agent_variant_self_configs_variantId_idx" ON "agent_variant_self_configs"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_variant_self_configs_tenantId_ownerType_ownerId_varia_key" ON "agent_variant_self_configs"("tenantId", "ownerType", "ownerId", "variantId");

-- CreateIndex
CREATE INDEX "agent_variant_children_configs_tenantId_idx" ON "agent_variant_children_configs"("tenantId");

-- CreateIndex
CREATE INDEX "agent_variant_children_configs_ownerType_ownerId_idx" ON "agent_variant_children_configs"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "agent_variant_children_configs_productId_idx" ON "agent_variant_children_configs"("productId");

-- CreateIndex
CREATE INDEX "agent_variant_children_configs_variantId_idx" ON "agent_variant_children_configs"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_variant_children_configs_tenantId_ownerType_ownerId_p_key" ON "agent_variant_children_configs"("tenantId", "ownerType", "ownerId", "productId", "variantId");

-- CreateIndex
CREATE INDEX "cart_items_variantId_idx" ON "cart_items"("variantId");

-- CreateIndex
CREATE INDEX "inventory_reservations_variantId_status_idx" ON "inventory_reservations"("variantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_reservations_orderId_productId_variantId_key" ON "inventory_reservations"("orderId", "productId", "variantId");

-- CreateIndex
CREATE INDEX "order_items_variantId_idx" ON "order_items"("variantId");

-- CreateIndex
CREATE INDEX "orders_agentId_idx" ON "orders"("agentId");

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_parentAgentId_fkey" FOREIGN KEY ("parentAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_mall_configs" ADD CONSTRAINT "agent_mall_configs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_mall_configs" ADD CONSTRAINT "agent_mall_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_domains" ADD CONSTRAINT "agent_domains_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_domains" ADD CONSTRAINT "agent_domains_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_level_configs" ADD CONSTRAINT "agent_level_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_variant_self_configs" ADD CONSTRAINT "agent_variant_self_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_variant_self_configs" ADD CONSTRAINT "agent_variant_self_configs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_variant_self_configs" ADD CONSTRAINT "agent_variant_self_configs_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_variant_children_configs" ADD CONSTRAINT "agent_variant_children_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_variant_children_configs" ADD CONSTRAINT "agent_variant_children_configs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_variant_children_configs" ADD CONSTRAINT "agent_variant_children_configs_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
