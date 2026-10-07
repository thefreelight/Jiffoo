DELETE FROM "theme_activations";
DELETE FROM "theme_active";
DELETE FROM "theme_config_revisions";
DELETE FROM "theme_configurations";
DELETE FROM "themes";

-- AlterTable
ALTER TABLE "theme_activations" ADD COLUMN     "packageHash" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "theme_active" ADD COLUMN     "packageHash" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "theme_package_blobs" (
    "id" TEXT NOT NULL,
    "themeSlug" TEXT NOT NULL,
    "packageHash" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "theme_package_blobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "theme_package_blobs_themeSlug_packageHash_key" ON "theme_package_blobs"("themeSlug", "packageHash");

-- AddForeignKey
ALTER TABLE "theme_package_blobs" ADD CONSTRAINT "theme_package_blobs_themeSlug_fkey" FOREIGN KEY ("themeSlug") REFERENCES "themes"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
