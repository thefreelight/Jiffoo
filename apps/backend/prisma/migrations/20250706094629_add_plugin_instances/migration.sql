-- CreateTable
CREATE TABLE "plugin_instances" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "tenantId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INSTALLED',
    "version" TEXT NOT NULL,
    "config" TEXT,
    "metadata" TEXT,
    "routes" TEXT,
    "dependencies" TEXT,
    "resources" TEXT,
    "errorMessage" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plugin_instances_pluginId_idx" ON "plugin_instances"("pluginId");

-- CreateIndex
CREATE INDEX "plugin_instances_tenantId_idx" ON "plugin_instances"("tenantId");

-- CreateIndex
CREATE INDEX "plugin_instances_status_idx" ON "plugin_instances"("status");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_instances_pluginId_tenantId_key" ON "plugin_instances"("pluginId", "tenantId");
