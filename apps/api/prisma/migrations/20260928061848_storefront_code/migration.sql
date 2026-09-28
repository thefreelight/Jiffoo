-- CreateTable
CREATE TABLE "storefront_code_configurations" (
    "id" TEXT NOT NULL DEFAULT 'system',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "ga4MeasurementId" TEXT,
    "metaPixelId" TEXT,
    "baiduSiteKey" TEXT,
    "headCode" TEXT NOT NULL DEFAULT '',
    "bodyStartCode" TEXT NOT NULL DEFAULT '',
    "bodyEndCode" TEXT NOT NULL DEFAULT '',
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storefront_code_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storefront_code_revisions" (
    "id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "ga4MeasurementId" TEXT,
    "metaPixelId" TEXT,
    "baiduSiteKey" TEXT,
    "headCode" TEXT NOT NULL,
    "bodyStartCode" TEXT NOT NULL,
    "bodyEndCode" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restoredFromRevision" INTEGER,

    CONSTRAINT "storefront_code_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "storefront_code_revisions_revision_key" ON "storefront_code_revisions"("revision");

-- CreateIndex
CREATE INDEX "storefront_code_revisions_createdAt_id_idx" ON "storefront_code_revisions"("createdAt", "id");
