DROP TABLE IF EXISTS "plugin_runtime_migrations";
-- CreateEnum
CREATE TYPE "PluginMigrationAttemptStatus" AS ENUM ('SUCCESS', 'FAILED', 'UNKNOWN', 'ABORTED');

-- CreateTable
CREATE TABLE "plugin_namespaces" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "schemaName" TEXT NOT NULL,
    "publisherKind" TEXT NOT NULL,
    "publisherId" TEXT,
    "provisionedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_namespaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_migration_successes" (
    "id" TEXT NOT NULL,
    "namespaceId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "migrationId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "packageHash" TEXT NOT NULL,
    "packageVersion" TEXT NOT NULL,
    "manifestDigest" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL,

    CONSTRAINT "plugin_migration_successes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_migration_attempts" (
    "id" TEXT NOT NULL,
    "namespaceId" INTEGER NOT NULL,
    "operationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "migrationId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" "PluginMigrationAttemptStatus" NOT NULL DEFAULT 'UNKNOWN',
    "sqlstate" TEXT,
    "errorCode" TEXT,
    "resolution" TEXT,

    CONSTRAINT "plugin_migration_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_migration_operations" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "packageHash" TEXT NOT NULL,
    "packageVersion" TEXT NOT NULL,
    "manifestDigest" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "declarations" JSONB NOT NULL,
    "expectedInstall" JSONB NOT NULL,
    "installOptions" JSONB NOT NULL,
    "artifactBytes" BYTEA,
    "leaseToken" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'QUEUED',
    "committedPrefix" INTEGER NOT NULL DEFAULT 0,
    "recoveryState" TEXT NOT NULL DEFAULT 'NONE',
    "confirmed" BOOLEAN NOT NULL,
    "result" JSONB,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "plugin_migration_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plugin_namespaces_slug_key" ON "plugin_namespaces"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_namespaces_schemaName_key" ON "plugin_namespaces"("schemaName");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_migration_successes_namespaceId_order_key" ON "plugin_migration_successes"("namespaceId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_migration_successes_namespaceId_migrationId_key" ON "plugin_migration_successes"("namespaceId", "migrationId");

-- CreateIndex
CREATE INDEX "plugin_migration_attempts_operationId_order_idx" ON "plugin_migration_attempts"("operationId", "order");

-- CreateIndex
CREATE INDEX "plugin_migration_operations_slug_createdAt_idx" ON "plugin_migration_operations"("slug", "createdAt");

-- CreateIndex
CREATE INDEX "plugin_migration_operations_phase_idx" ON "plugin_migration_operations"("phase");

-- AddForeignKey
ALTER TABLE "plugin_migration_successes" ADD CONSTRAINT "plugin_migration_successes_namespaceId_fkey" FOREIGN KEY ("namespaceId") REFERENCES "plugin_namespaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_migration_successes" ADD CONSTRAINT "plugin_migration_successes_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "plugin_migration_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_migration_attempts" ADD CONSTRAINT "plugin_migration_attempts_namespaceId_fkey" FOREIGN KEY ("namespaceId") REFERENCES "plugin_namespaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_migration_attempts" ADD CONSTRAINT "plugin_migration_attempts_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "plugin_migration_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

