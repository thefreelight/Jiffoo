-- CreateTable
CREATE TABLE "plugin_files" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "sha256" TEXT,
    "contentType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL DEFAULT 0,
    "reservedBytes" BIGINT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'RESERVED',
    "reservationExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_storage_quotas" (
    "installationId" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "reservedBytes" BIGINT NOT NULL DEFAULT 0,
    "usedBytes" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "plugin_storage_quotas_pkey" PRIMARY KEY ("installationId","ownerType","ownerId")
);

-- CreateTable
CREATE TABLE "plugin_file_cleanup" (
    "id" TEXT NOT NULL,
    "fileId" TEXT,
    "installationId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimToken" UUID,
    "leaseUntil" TIMESTAMPTZ(3),
    "lastError" TEXT,

    CONSTRAINT "plugin_file_cleanup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plugin_files_objectKey_key" ON "plugin_files"("objectKey");

-- CreateIndex
CREATE INDEX "plugin_files_installationId_ownerType_ownerId_state_idx" ON "plugin_files"("installationId", "ownerType", "ownerId", "state");

-- CreateIndex
CREATE INDEX "plugin_files_state_reservationExpiresAt_idx" ON "plugin_files"("state", "reservationExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_file_cleanup_objectKey_key" ON "plugin_file_cleanup"("objectKey");

-- CreateIndex
CREATE INDEX "plugin_file_cleanup_nextAttemptAt_leaseUntil_idx" ON "plugin_file_cleanup"("nextAttemptAt", "leaseUntil");

-- AddForeignKey
ALTER TABLE "plugin_storage_quotas" ADD CONSTRAINT "plugin_storage_quotas_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "plugin_installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE public.plugin_files ADD CONSTRAINT plugin_files_state_check CHECK (state IN ('RESERVED','READY','DELETING')),
  ADD CONSTRAINT plugin_files_owner_check CHECK ("ownerType" IN ('CUSTOMER','ADMIN')),
  ADD CONSTRAINT plugin_files_size_check CHECK ("sizeBytes" >= 0 AND "reservedBytes" >= 0),
  ADD CONSTRAINT plugin_files_ready_check CHECK (state <> 'READY' OR (sha256 IS NOT NULL AND sha256 ~ '^[a-f0-9]{64}$' AND "reservedBytes" = 0));
ALTER TABLE public.plugin_storage_quotas ADD CONSTRAINT plugin_storage_quotas_nonnegative CHECK ("reservedBytes" >= 0 AND "usedBytes" >= 0),
  ADD CONSTRAINT plugin_storage_quotas_owner_check CHECK (("ownerType" = 'INSTALLATION' AND "ownerId" = '') OR ("ownerType" IN ('CUSTOMER','ADMIN') AND "ownerId" <> ''));
ALTER TABLE public.plugin_file_cleanup ADD CONSTRAINT plugin_file_cleanup_attempts_check CHECK (attempts >= 0);
