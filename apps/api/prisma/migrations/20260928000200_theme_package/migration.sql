-- CreateTable
CREATE TABLE "themes" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manifestJson" JSONB NOT NULL,
    "packageHash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "trustLevel" "PluginTrustLevel" NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "themes_slug_key" ON "themes"("slug");
