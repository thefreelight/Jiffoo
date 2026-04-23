-- CreateTable
CREATE TABLE "public"."admin_staff_audit_logs" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "staffEmail" TEXT NOT NULL,
    "staffUsername" TEXT,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "actorUsername" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_staff_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_staff_audit_logs_staffUserId_createdAt_idx"
ON "public"."admin_staff_audit_logs"("staffUserId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_staff_audit_logs_action_createdAt_idx"
ON "public"."admin_staff_audit_logs"("action", "createdAt");
