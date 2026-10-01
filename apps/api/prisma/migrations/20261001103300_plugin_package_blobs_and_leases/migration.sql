-- CreateTable
CREATE TABLE "plugin_package_blobs" (
    "id" TEXT NOT NULL,
    "pluginSlug" TEXT NOT NULL,
    "zipHash" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_package_blobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_operation_leases" (
    "slug" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_operation_leases_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE UNIQUE INDEX "plugin_package_blobs_pluginSlug_zipHash_key" ON "plugin_package_blobs"("pluginSlug", "zipHash");

-- AddForeignKey
ALTER TABLE "plugin_package_blobs" ADD CONSTRAINT "plugin_package_blobs_pluginSlug_fkey" FOREIGN KEY ("pluginSlug") REFERENCES "plugin_installs"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
