-- AlterTable
ALTER TABLE "plugin_migration_operations" ADD COLUMN     "ownerBootNonce" UUID;

-- AlterTable
ALTER TABLE "plugin_operation_leases" ADD COLUMN     "ownerBootNonce" UUID;

-- CreateTable
CREATE TABLE "core_processes" (
    "bootNonce" UUID NOT NULL,
    "instanceId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "pid" INTEGER NOT NULL,
    "databaseRole" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" TEXT NOT NULL DEFAULT 'LIVE',
    "drainedAt" TIMESTAMP(3),
    "deathConfirmedAt" TIMESTAMP(3),
    "deathProof" JSONB,

    CONSTRAINT "core_processes_pkey" PRIMARY KEY ("bootNonce")
);

-- CreateIndex
CREATE INDEX "core_processes_state_heartbeatAt_idx" ON "core_processes"("state", "heartbeatAt");

-- CreateIndex
CREATE INDEX "plugin_migration_operations_phase_createdAt_id_idx" ON "plugin_migration_operations"("phase", "createdAt", "id");

-- CreateIndex
CREATE INDEX "plugin_operation_leases_operation_ownerBootNonce_idx" ON "plugin_operation_leases"("operation", "ownerBootNonce");

-- AddForeignKey
ALTER TABLE "plugin_operation_leases" ADD CONSTRAINT "plugin_operation_leases_ownerBootNonce_fkey" FOREIGN KEY ("ownerBootNonce") REFERENCES "core_processes"("bootNonce") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_migration_operations" ADD CONSTRAINT "plugin_migration_operations_ownerBootNonce_fkey" FOREIGN KEY ("ownerBootNonce") REFERENCES "core_processes"("bootNonce") ON DELETE RESTRICT ON UPDATE CASCADE;

