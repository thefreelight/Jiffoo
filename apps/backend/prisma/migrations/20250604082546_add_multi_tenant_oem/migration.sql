-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "agencyFee" REAL NOT NULL,
    "agencyFeePaid" BOOLEAN NOT NULL DEFAULT false,
    "agencyLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "domain" TEXT,
    "subdomain" TEXT,
    "branding" TEXT NOT NULL,
    "settings" TEXT NOT NULL,
    "contractStart" DATETIME,
    "contractEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tenant_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tenant_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tenant_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "price_controls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productType" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "basePrice" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "minMargin" REAL NOT NULL DEFAULT 0,
    "maxDiscount" REAL NOT NULL DEFAULT 0,
    "effectiveDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tenant_pricing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "priceControlId" TEXT NOT NULL,
    "sellingPrice" REAL NOT NULL,
    "marginAmount" REAL NOT NULL,
    "marginPercent" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tenant_pricing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tenant_pricing_priceControlId_fkey" FOREIGN KEY ("priceControlId") REFERENCES "price_controls" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tenant_licenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "licenseType" TEXT NOT NULL,
    "authorizedFeatures" TEXT NOT NULL,
    "brandingRights" BOOLEAN NOT NULL DEFAULT false,
    "resaleRights" BOOLEAN NOT NULL DEFAULT false,
    "maxUsers" INTEGER,
    "maxInstances" INTEGER,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tenant_licenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productType" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "tenantId" TEXT,
    "sellingPrice" REAL NOT NULL,
    "basePrice" REAL NOT NULL,
    "marginAmount" REAL NOT NULL,
    "marginPercent" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "jiffooRevenue" REAL NOT NULL,
    "tenantRevenue" REAL,
    "platformFee" REAL NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "licenseId" TEXT,
    "licenseType" TEXT NOT NULL,
    "saleDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sales_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tenant_data_sync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "syncEndpoint" TEXT NOT NULL,
    "syncFrequency" TEXT NOT NULL DEFAULT 'daily',
    "syncFormat" TEXT NOT NULL DEFAULT 'json',
    "encryptionKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" DATETIME,
    "lastSyncStatus" TEXT,
    "syncCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tenant_data_sync_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "revenue_sharing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "jiffooShare" REAL NOT NULL,
    "tenantShare" REAL NOT NULL,
    "platformFee" REAL NOT NULL,
    "settlementStatus" TEXT NOT NULL DEFAULT 'pending',
    "settlementDate" DATETIME,
    "settlementMethod" TEXT,
    "settlementReference" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "revenue_sharing_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "revenue_sharing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_contactEmail_key" ON "tenants"("contactEmail");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_domain_key" ON "tenants"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_subdomain_key" ON "tenants"("subdomain");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- CreateIndex
CREATE INDEX "tenants_agencyFeePaid_idx" ON "tenants"("agencyFeePaid");

-- CreateIndex
CREATE INDEX "tenants_domain_idx" ON "tenants"("domain");

-- CreateIndex
CREATE INDEX "tenant_users_tenantId_idx" ON "tenant_users"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_users_userId_idx" ON "tenant_users"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_tenantId_userId_key" ON "tenant_users"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "price_controls_productType_idx" ON "price_controls"("productType");

-- CreateIndex
CREATE INDEX "price_controls_productId_idx" ON "price_controls"("productId");

-- CreateIndex
CREATE INDEX "price_controls_isActive_idx" ON "price_controls"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "price_controls_productType_productId_key" ON "price_controls"("productType", "productId");

-- CreateIndex
CREATE INDEX "tenant_pricing_tenantId_idx" ON "tenant_pricing"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_pricing_priceControlId_idx" ON "tenant_pricing"("priceControlId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_pricing_tenantId_priceControlId_key" ON "tenant_pricing"("tenantId", "priceControlId");

-- CreateIndex
CREATE INDEX "tenant_licenses_tenantId_idx" ON "tenant_licenses"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_licenses_productType_idx" ON "tenant_licenses"("productType");

-- CreateIndex
CREATE INDEX "tenant_licenses_productId_idx" ON "tenant_licenses"("productId");

-- CreateIndex
CREATE INDEX "tenant_licenses_isActive_idx" ON "tenant_licenses"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_licenses_tenantId_productType_productId_key" ON "tenant_licenses"("tenantId", "productType", "productId");

-- CreateIndex
CREATE INDEX "sales_channel_idx" ON "sales"("channel");

-- CreateIndex
CREATE INDEX "sales_tenantId_idx" ON "sales"("tenantId");

-- CreateIndex
CREATE INDEX "sales_customerId_idx" ON "sales"("customerId");

-- CreateIndex
CREATE INDEX "sales_productType_idx" ON "sales"("productType");

-- CreateIndex
CREATE INDEX "sales_productId_idx" ON "sales"("productId");

-- CreateIndex
CREATE INDEX "sales_paymentStatus_idx" ON "sales"("paymentStatus");

-- CreateIndex
CREATE INDEX "sales_saleDate_idx" ON "sales"("saleDate");

-- CreateIndex
CREATE INDEX "tenant_data_sync_tenantId_idx" ON "tenant_data_sync"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_data_sync_syncType_idx" ON "tenant_data_sync"("syncType");

-- CreateIndex
CREATE INDEX "tenant_data_sync_isActive_idx" ON "tenant_data_sync"("isActive");

-- CreateIndex
CREATE INDEX "tenant_data_sync_lastSyncAt_idx" ON "tenant_data_sync"("lastSyncAt");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_data_sync_tenantId_syncType_key" ON "tenant_data_sync"("tenantId", "syncType");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_sharing_saleId_key" ON "revenue_sharing"("saleId");

-- CreateIndex
CREATE INDEX "revenue_sharing_tenantId_idx" ON "revenue_sharing"("tenantId");

-- CreateIndex
CREATE INDEX "revenue_sharing_settlementStatus_idx" ON "revenue_sharing"("settlementStatus");

-- CreateIndex
CREATE INDEX "revenue_sharing_settlementDate_idx" ON "revenue_sharing"("settlementDate");
