-- CreateTable
CREATE TABLE "plugin_service_calls" (
    "id" TEXT NOT NULL,
    "callerInstallationId" TEXT NOT NULL,
    "callerSlug" TEXT NOT NULL,
    "providerInstallationId" TEXT NOT NULL,
    "providerSlug" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "response" JSONB,
    "safeError" JSONB,
    "callerGeneration" BIGINT NOT NULL,
    "providerGeneration" BIGINT NOT NULL,
    "principalType" TEXT,
    "principalId" TEXT,
    "claimToken" UUID NOT NULL,
    "deadlineAt" TIMESTAMPTZ(3) NOT NULL,
    "reconciliationClaimToken" UUID,
    "reconciliationDeadlineAt" TIMESTAMPTZ(3),
    "reconciliationSequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plugin_service_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plugin_service_calls_status_deadlineAt_idx" ON "plugin_service_calls"("status", "deadlineAt");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_service_calls_callerInstallationId_providerInstallat_key" ON "plugin_service_calls"("callerInstallationId", "providerInstallationId", "service", "version", "method", "idempotencyKey");

