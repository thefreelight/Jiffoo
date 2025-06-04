-- CreateTable
CREATE TABLE "saas_instances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "instanceName" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "customDomain" TEXT,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "region" TEXT NOT NULL DEFAULT 'us-east-1',
    "version" TEXT NOT NULL DEFAULT 'latest',
    "settings" TEXT NOT NULL,
    "resources" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "saas_instances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "saas_instances_planId_fkey" FOREIGN KEY ("planId") REFERENCES "saas_plans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "saas_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billing" TEXT NOT NULL,
    "features" TEXT NOT NULL,
    "limits" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stripePriceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "saas_backups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instanceId" TEXT NOT NULL,
    "backupType" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "storageUrl" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "saas_backups_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "saas_instances" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "saas_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instanceId" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saas_metrics_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "saas_instances" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "pricing" TEXT NOT NULL,
    "features" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "demoUrl" TEXT,
    "downloadUrl" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "author" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "rating" REAL NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "template_purchases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "licenseType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "maxDownloads" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "template_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "template_purchases_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "saas_instances_subdomain_key" ON "saas_instances"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "saas_instances_customDomain_key" ON "saas_instances"("customDomain");

-- CreateIndex
CREATE INDEX "saas_instances_userId_idx" ON "saas_instances"("userId");

-- CreateIndex
CREATE INDEX "saas_instances_subdomain_idx" ON "saas_instances"("subdomain");

-- CreateIndex
CREATE INDEX "saas_instances_status_idx" ON "saas_instances"("status");

-- CreateIndex
CREATE UNIQUE INDEX "saas_plans_stripePriceId_key" ON "saas_plans"("stripePriceId");

-- CreateIndex
CREATE INDEX "saas_backups_instanceId_idx" ON "saas_backups"("instanceId");

-- CreateIndex
CREATE INDEX "saas_backups_status_idx" ON "saas_backups"("status");

-- CreateIndex
CREATE INDEX "saas_backups_createdAt_idx" ON "saas_backups"("createdAt");

-- CreateIndex
CREATE INDEX "saas_metrics_instanceId_idx" ON "saas_metrics"("instanceId");

-- CreateIndex
CREATE INDEX "saas_metrics_metricType_idx" ON "saas_metrics"("metricType");

-- CreateIndex
CREATE INDEX "saas_metrics_timestamp_idx" ON "saas_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "templates_category_idx" ON "templates"("category");

-- CreateIndex
CREATE INDEX "templates_status_idx" ON "templates"("status");

-- CreateIndex
CREATE INDEX "templates_downloads_idx" ON "templates"("downloads");

-- CreateIndex
CREATE INDEX "templates_rating_idx" ON "templates"("rating");

-- CreateIndex
CREATE INDEX "template_purchases_userId_idx" ON "template_purchases"("userId");

-- CreateIndex
CREATE INDEX "template_purchases_templateId_idx" ON "template_purchases"("templateId");

-- CreateIndex
CREATE INDEX "template_purchases_status_idx" ON "template_purchases"("status");
