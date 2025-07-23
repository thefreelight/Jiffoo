-- AlterTable
ALTER TABLE "plugin_instances" ADD COLUMN     "marketplaceId" TEXT;

-- CreateTable
CREATE TABLE "plugin_developers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "description" TEXT,
    "avatar" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "revenueShare" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_developers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_marketplace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "longDescription" TEXT,
    "icon" TEXT,
    "screenshots" TEXT,
    "developerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "currentVersion" TEXT NOT NULL,
    "minCoreVersion" TEXT NOT NULL,
    "maxCoreVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "reviewNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "pricing" TEXT NOT NULL,
    "licenseType" TEXT NOT NULL,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "activeInstalls" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "dependencies" TEXT,
    "permissions" TEXT,
    "compatibility" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_marketplace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_versions" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "changelog" TEXT,
    "downloadUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "signature" TEXT,
    "minCoreVersion" TEXT NOT NULL,
    "maxCoreVersion" TEXT,
    "dependencies" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isPrerelease" BOOLEAN NOT NULL DEFAULT false,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_reviews" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "version" TEXT NOT NULL,
    "helpful" INTEGER NOT NULL DEFAULT 0,
    "reported" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PluginMarketplaceToPluginTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "plugin_developers_userId_key" ON "plugin_developers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_developers_email_key" ON "plugin_developers"("email");

-- CreateIndex
CREATE INDEX "plugin_developers_verified_idx" ON "plugin_developers"("verified");

-- CreateIndex
CREATE INDEX "plugin_developers_status_idx" ON "plugin_developers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_categories_name_key" ON "plugin_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_categories_slug_key" ON "plugin_categories"("slug");

-- CreateIndex
CREATE INDEX "plugin_categories_parentId_idx" ON "plugin_categories"("parentId");

-- CreateIndex
CREATE INDEX "plugin_categories_sortOrder_idx" ON "plugin_categories"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_tags_name_key" ON "plugin_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_tags_slug_key" ON "plugin_tags"("slug");

-- CreateIndex
CREATE INDEX "plugin_tags_usageCount_idx" ON "plugin_tags"("usageCount");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_marketplace_slug_key" ON "plugin_marketplace"("slug");

-- CreateIndex
CREATE INDEX "plugin_marketplace_developerId_idx" ON "plugin_marketplace"("developerId");

-- CreateIndex
CREATE INDEX "plugin_marketplace_categoryId_idx" ON "plugin_marketplace"("categoryId");

-- CreateIndex
CREATE INDEX "plugin_marketplace_status_idx" ON "plugin_marketplace"("status");

-- CreateIndex
CREATE INDEX "plugin_marketplace_reviewStatus_idx" ON "plugin_marketplace"("reviewStatus");

-- CreateIndex
CREATE INDEX "plugin_marketplace_isPublished_idx" ON "plugin_marketplace"("isPublished");

-- CreateIndex
CREATE INDEX "plugin_marketplace_downloads_idx" ON "plugin_marketplace"("downloads");

-- CreateIndex
CREATE INDEX "plugin_marketplace_rating_idx" ON "plugin_marketplace"("rating");

-- CreateIndex
CREATE INDEX "plugin_versions_pluginId_idx" ON "plugin_versions"("pluginId");

-- CreateIndex
CREATE INDEX "plugin_versions_status_idx" ON "plugin_versions"("status");

-- CreateIndex
CREATE INDEX "plugin_versions_downloads_idx" ON "plugin_versions"("downloads");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_versions_pluginId_version_key" ON "plugin_versions"("pluginId", "version");

-- CreateIndex
CREATE INDEX "plugin_reviews_pluginId_idx" ON "plugin_reviews"("pluginId");

-- CreateIndex
CREATE INDEX "plugin_reviews_userId_idx" ON "plugin_reviews"("userId");

-- CreateIndex
CREATE INDEX "plugin_reviews_rating_idx" ON "plugin_reviews"("rating");

-- CreateIndex
CREATE INDEX "plugin_reviews_createdAt_idx" ON "plugin_reviews"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_reviews_pluginId_userId_key" ON "plugin_reviews"("pluginId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "_PluginMarketplaceToPluginTag_AB_unique" ON "_PluginMarketplaceToPluginTag"("A", "B");

-- CreateIndex
CREATE INDEX "_PluginMarketplaceToPluginTag_B_index" ON "_PluginMarketplaceToPluginTag"("B");

-- CreateIndex
CREATE INDEX "plugin_instances_marketplaceId_idx" ON "plugin_instances"("marketplaceId");

-- AddForeignKey
ALTER TABLE "plugin_developers" ADD CONSTRAINT "plugin_developers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_categories" ADD CONSTRAINT "plugin_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "plugin_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_marketplace" ADD CONSTRAINT "plugin_marketplace_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "plugin_developers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_marketplace" ADD CONSTRAINT "plugin_marketplace_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "plugin_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_versions" ADD CONSTRAINT "plugin_versions_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugin_marketplace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_reviews" ADD CONSTRAINT "plugin_reviews_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugin_marketplace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_reviews" ADD CONSTRAINT "plugin_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_instances" ADD CONSTRAINT "plugin_instances_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "plugin_marketplace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PluginMarketplaceToPluginTag" ADD CONSTRAINT "_PluginMarketplaceToPluginTag_A_fkey" FOREIGN KEY ("A") REFERENCES "plugin_marketplace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PluginMarketplaceToPluginTag" ADD CONSTRAINT "_PluginMarketplaceToPluginTag_B_fkey" FOREIGN KEY ("B") REFERENCES "plugin_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
