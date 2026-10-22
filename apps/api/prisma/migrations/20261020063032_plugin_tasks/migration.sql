-- AlterTable
ALTER TABLE "plugin_installations" ADD COLUMN     "taskDependencyUnavailable" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "plugin_principals" (
    "installationId" TEXT NOT NULL,
    "principalType" TEXT NOT NULL,
    "principalId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,

    CONSTRAINT "plugin_principals_pkey" PRIMARY KEY ("installationId","principalType","principalId")
);

-- CreateTable
CREATE TABLE "plugin_tasks" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "zipHash" TEXT,
    "generation" BIGINT,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "scheduleRequest" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "principalType" TEXT,
    "principalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "runAt" TIMESTAMPTZ(3) NOT NULL,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL,
    "attemptsCharged" INTEGER NOT NULL DEFAULT 0,
    "executionSequence" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL,
    "maxRuntimeSeconds" INTEGER NOT NULL,
    "declaredConcurrency" INTEGER NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "deadlineAt" TIMESTAMPTZ(3),
    "claimedByBootNonce" UUID,
    "claimToken" UUID,
    "fence" BIGINT NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMPTZ(3),
    "progress" JSONB,
    "lastError" JSONB,
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "pauseReason" TEXT,
    "pausedAt" TIMESTAMPTZ(3),
    "cancellationReason" TEXT,
    "previousState" TEXT,
    "cancelRequestedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plugin_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_task_attempts" (
    "taskId" TEXT NOT NULL,
    "executionSequence" INTEGER NOT NULL,
    "chargedAttempt" INTEGER NOT NULL,
    "claimToken" UUID NOT NULL,
    "fence" BIGINT NOT NULL,
    "bootNonce" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "finishedAt" TIMESTAMPTZ(3),
    "outcome" TEXT,
    "safeError" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plugin_task_attempts_pkey" PRIMARY KEY ("taskId","executionSequence")
);

-- CreateTable
CREATE TABLE "plugin_task_final_failures" (
    "taskId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "maxRuntimeSeconds" INTEGER NOT NULL,
    "claimToken" UUID,
    "fence" BIGINT NOT NULL DEFAULT 0,
    "bootNonce" UUID,
    "leaseUntil" TIMESTAMPTZ(3),
    "deadlineAt" TIMESTAMPTZ(3),
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "safeError" JSONB,
    "suppressionReason" TEXT,
    "zipHash" TEXT,
    "generation" BIGINT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plugin_task_final_failures_pkey" PRIMARY KEY ("taskId")
);

-- CreateTable
CREATE TABLE "plugin_task_execution_slots" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "claimToken" UUID NOT NULL,
    "fence" BIGINT NOT NULL,
    "bootNonce" UUID NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastObservedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plugin_task_execution_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_task_scheduler" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "roundSequence" BIGINT NOT NULL DEFAULT 0,
    "policy" JSONB NOT NULL,
    "policyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plugin_task_scheduler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_task_fairness" (
    "installationId" TEXT NOT NULL,
    "lastServedSequence" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plugin_task_fairness_pkey" PRIMARY KEY ("installationId")
);

-- CreateIndex
CREATE INDEX "plugin_tasks_status_nextAttemptAt_id_idx" ON "plugin_tasks"("status", "nextAttemptAt", "id");

-- CreateIndex
CREATE INDEX "plugin_tasks_status_leaseUntil_id_idx" ON "plugin_tasks"("status", "leaseUntil", "id");

-- CreateIndex
CREATE INDEX "plugin_tasks_installationId_status_idx" ON "plugin_tasks"("installationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_tasks_installationId_name_version_idempotencyKey_key" ON "plugin_tasks"("installationId", "name", "version", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_task_attempts_claimToken_key" ON "plugin_task_attempts"("claimToken");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_task_attempts_taskId_fence_key" ON "plugin_task_attempts"("taskId", "fence");

-- CreateIndex
CREATE INDEX "plugin_task_final_failures_status_createdAt_idx" ON "plugin_task_final_failures"("status", "createdAt");

-- CreateIndex
CREATE INDEX "plugin_task_execution_slots_bootNonce_state_idx" ON "plugin_task_execution_slots"("bootNonce", "state");

-- CreateIndex
CREATE INDEX "plugin_task_execution_slots_installationId_name_version_sta_idx" ON "plugin_task_execution_slots"("installationId", "name", "version", "state");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_task_execution_slots_taskId_kind_fence_key" ON "plugin_task_execution_slots"("taskId", "kind", "fence");

-- AddForeignKey
ALTER TABLE "plugin_principals" ADD CONSTRAINT "plugin_principals_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "plugin_installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_tasks" ADD CONSTRAINT "plugin_tasks_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "plugin_installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_tasks" ADD CONSTRAINT "plugin_tasks_claimedByBootNonce_fkey" FOREIGN KEY ("claimedByBootNonce") REFERENCES "core_processes"("bootNonce") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_task_attempts" ADD CONSTRAINT "plugin_task_attempts_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "plugin_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_task_final_failures" ADD CONSTRAINT "plugin_task_final_failures_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "plugin_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_task_execution_slots" ADD CONSTRAINT "plugin_task_execution_slots_bootNonce_fkey" FOREIGN KEY ("bootNonce") REFERENCES "core_processes"("bootNonce") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integrity constraints not expressible in the Prisma datamodel.
ALTER TABLE "plugin_principals" ADD CONSTRAINT "plugin_principals_type_check" CHECK ("principalType" IN ('CUSTOMER','ADMIN'));
ALTER TABLE "plugin_tasks" ADD CONSTRAINT "plugin_tasks_limits_check" CHECK ("maxAttempts" BETWEEN 1 AND 20 AND "maxRuntimeSeconds" BETWEEN 1 AND 600 AND "declaredConcurrency" BETWEEN 1 AND 16 AND "attemptsCharged" >= 0 AND fence >= 0 AND "executionSequence" >= 0);
ALTER TABLE "plugin_tasks" ADD CONSTRAINT "plugin_tasks_json_check" CHECK (octet_length(payload::text) <= 65536 AND (result IS NULL OR octet_length(result::text) <= 65536) AND octet_length("idempotencyKey") BETWEEN 1 AND 128);
ALTER TABLE "plugin_tasks" ADD CONSTRAINT "plugin_tasks_status_check" CHECK (status IN ('PENDING','RUNNING','SUCCEEDED','FAILED','CANCELLED') AND (status <> 'RUNNING' OR ("claimToken" IS NOT NULL AND "claimedByBootNonce" IS NOT NULL AND "leaseUntil" IS NOT NULL AND "deadlineAt" IS NOT NULL)) AND (status = 'RUNNING' OR ("claimToken" IS NULL AND "leaseUntil" IS NULL AND "deadlineAt" IS NULL)));
ALTER TABLE "plugin_tasks" ADD CONSTRAINT "plugin_tasks_principal_check" CHECK (("principalType" IS NULL AND "principalId" IS NULL) OR ("principalType" IN ('CUSTOMER','ADMIN') AND "principalId" IS NOT NULL));
ALTER TABLE "plugin_task_final_failures" ADD CONSTRAINT "plugin_task_final_failures_status_check" CHECK (status IN ('PENDING','RUNNING','SUCCEEDED','FAILED','UNKNOWN','SUPPRESSED') AND "maxRuntimeSeconds" BETWEEN 1 AND 60 AND (status <> 'RUNNING' OR ("claimToken" IS NOT NULL AND "leaseUntil" IS NOT NULL AND "deadlineAt" IS NOT NULL)));
ALTER TABLE "plugin_task_execution_slots" ADD CONSTRAINT "plugin_task_execution_slots_state_check" CHECK (state IN ('ACTIVE','LINGERING','RELEASED') AND kind IN ('TASK','FINAL_FAILURE'));
CREATE INDEX "plugin_tasks_due_partial_idx" ON "plugin_tasks"("nextAttemptAt",id) WHERE status = 'PENDING';
CREATE INDEX "plugin_tasks_lease_partial_idx" ON "plugin_tasks"("leaseUntil",id) WHERE status = 'RUNNING';
