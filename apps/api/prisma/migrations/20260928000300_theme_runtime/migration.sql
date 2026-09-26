CREATE TABLE "theme_active" (
    "target" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "theme_active_pkey" PRIMARY KEY ("target")
);

CREATE TABLE "theme_activations" (
    "id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "theme_activations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "theme_configurations" (
    "slug" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "values" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "theme_configurations_pkey" PRIMARY KEY ("slug")
);

CREATE TABLE "theme_config_revisions" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "values" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "theme_config_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_audit_events" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "theme_activations_target_createdAt_idx" ON "theme_activations"("target", "createdAt");
CREATE UNIQUE INDEX "theme_config_revisions_slug_revision_key" ON "theme_config_revisions"("slug", "revision");
CREATE INDEX "admin_audit_events_targetType_targetId_createdAt_idx" ON "admin_audit_events"("targetType", "targetId", "createdAt");

ALTER TABLE "theme_configurations" ADD CONSTRAINT "theme_configurations_slug_fkey" FOREIGN KEY ("slug") REFERENCES "themes"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "theme_config_revisions" ADD CONSTRAINT "theme_config_revisions_slug_fkey" FOREIGN KEY ("slug") REFERENCES "themes"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
