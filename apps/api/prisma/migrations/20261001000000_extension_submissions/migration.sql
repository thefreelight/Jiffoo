-- Create ExtensionSubmission model for the third-party extension submission pipeline
CREATE TABLE "ExtensionSubmission" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "contractVersion" TEXT,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "developerName" TEXT NOT NULL,
    "developerEmail" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "manifestJson" JSONB NOT NULL,
    "artifactUrl" TEXT,
    "checksumSha256" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "validationJson" JSONB,
    "reviewNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "catalogRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtensionSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExtensionSubmission_slug_version_key" ON "ExtensionSubmission"("slug", "version");
CREATE INDEX "ExtensionSubmission_status_idx" ON "ExtensionSubmission"("status");
CREATE INDEX "ExtensionSubmission_developerEmail_idx" ON "ExtensionSubmission"("developerEmail");
