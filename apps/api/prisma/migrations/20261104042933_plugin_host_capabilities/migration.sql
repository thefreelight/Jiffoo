-- AlterTable
ALTER TABLE "plugin_file_cleanup" ADD COLUMN     "operationId" TEXT;

-- AlterTable
ALTER TABLE "plugin_files" ADD COLUMN     "publicationRevision" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "plugin_file_publications" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "revision" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "plugin_file_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_file_references" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMPTZ(3),

    CONSTRAINT "plugin_file_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_file_operations" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "result" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "plugin_file_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_policy_authorities" (
    "principalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_policy_authorities_pkey" PRIMARY KEY ("principalId")
);

-- CreateTable
CREATE TABLE "plugin_action_grants" (
    "installationId" TEXT NOT NULL,
    "principalId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_action_grants_pkey" PRIMARY KEY ("installationId","principalId","action")
);

-- CreateIndex
CREATE INDEX "plugin_file_publications_installationId_fileId_status_idx" ON "plugin_file_publications"("installationId", "fileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_file_references_installationId_fileId_key_key" ON "plugin_file_references"("installationId", "fileId", "key");

-- CreateIndex
CREATE INDEX "plugin_file_operations_installationId_fileId_idx" ON "plugin_file_operations"("installationId", "fileId");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_file_operations_installationId_idempotencyKey_key" ON "plugin_file_operations"("installationId", "idempotencyKey");

