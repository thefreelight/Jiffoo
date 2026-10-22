-- CreateTable
CREATE TABLE "plugin_page_sessions" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "zipHash" TEXT NOT NULL,
    "generation" BIGINT NOT NULL,
    "surface" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "principalType" TEXT NOT NULL,
    "principalId" TEXT,
    "sessionVersion" INTEGER,
    "guestSecretHash" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plugin_page_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_purchase_origins" (
    "id" TEXT NOT NULL,
    "installationId" TEXT,
    "pluginSlug" TEXT NOT NULL,
    "generation" BIGINT NOT NULL,
    "customerId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "canonicalPath" TEXT NOT NULL,
    "orderId" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plugin_purchase_origins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plugin_page_sessions_installationId_revokedAt_idx" ON "plugin_page_sessions"("installationId", "revokedAt");

-- CreateIndex
CREATE INDEX "plugin_page_sessions_principalType_principalId_idx" ON "plugin_page_sessions"("principalType", "principalId");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_purchase_origins_orderId_key" ON "plugin_purchase_origins"("orderId");

-- CreateIndex
CREATE INDEX "plugin_purchase_origins_customerId_expiresAt_idx" ON "plugin_purchase_origins"("customerId", "expiresAt");

-- AddForeignKey
ALTER TABLE "plugin_page_sessions" ADD CONSTRAINT "plugin_page_sessions_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "plugin_installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_purchase_origins" ADD CONSTRAINT "plugin_purchase_origins_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "plugin_installations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_purchase_origins" ADD CONSTRAINT "plugin_purchase_origins_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

