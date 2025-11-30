/*
  Warnings:

  - A unique constraint covering the columns `[referralCode]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."orders" ADD COLUMN     "commissionCalculated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referrerId" TEXT;

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "availableBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "customCommissionRate" DOUBLE PRECISION,
ADD COLUMN     "invitedBy" TEXT,
ADD COLUMN     "pendingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalReferrals" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."commissions" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
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

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tenant_commission_configs" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultRate" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "settlementDays" INTEGER NOT NULL DEFAULT 7,
    "minPayoutAmount" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_commission_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payouts" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "accountInfo" TEXT,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "failureReason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commissions_tenantId_idx" ON "public"."commissions"("tenantId");

-- CreateIndex
CREATE INDEX "commissions_userId_idx" ON "public"."commissions"("userId");

-- CreateIndex
CREATE INDEX "commissions_orderId_idx" ON "public"."commissions"("orderId");

-- CreateIndex
CREATE INDEX "commissions_status_idx" ON "public"."commissions"("status");

-- CreateIndex
CREATE INDEX "commissions_settleAt_idx" ON "public"."commissions"("settleAt");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_commission_configs_tenantId_key" ON "public"."tenant_commission_configs"("tenantId");

-- CreateIndex
CREATE INDEX "payouts_tenantId_idx" ON "public"."payouts"("tenantId");

-- CreateIndex
CREATE INDEX "payouts_userId_idx" ON "public"."payouts"("userId");

-- CreateIndex
CREATE INDEX "payouts_status_idx" ON "public"."payouts"("status");

-- CreateIndex
CREATE INDEX "orders_referrerId_idx" ON "public"."orders"("referrerId");

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "public"."users"("referralCode");

-- CreateIndex
CREATE INDEX "users_referralCode_idx" ON "public"."users"("referralCode");

-- CreateIndex
CREATE INDEX "users_invitedBy_idx" ON "public"."users"("invitedBy");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commissions" ADD CONSTRAINT "commissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commissions" ADD CONSTRAINT "commissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commissions" ADD CONSTRAINT "commissions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_commission_configs" ADD CONSTRAINT "tenant_commission_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payouts" ADD CONSTRAINT "payouts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payouts" ADD CONSTRAINT "payouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable for PluginLicense (Buy-out model for affiliate plugin)
CREATE TABLE "public"."plugin_licenses" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "pluginId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 29,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for PluginLicense
CREATE UNIQUE INDEX "plugin_licenses_tenantId_pluginId_key" ON "public"."plugin_licenses"("tenantId", "pluginId");

-- CreateIndex for PluginLicense status
CREATE INDEX "plugin_licenses_status_idx" ON "public"."plugin_licenses"("status");

-- CreateIndex for PluginLicense tenantId
CREATE INDEX "plugin_licenses_tenantId_idx" ON "public"."plugin_licenses"("tenantId");

-- AddForeignKey for PluginLicense
ALTER TABLE "public"."plugin_licenses" ADD CONSTRAINT "plugin_licenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey for PluginLicense
ALTER TABLE "public"."plugin_licenses" ADD CONSTRAINT "plugin_licenses_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "public"."plugins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
