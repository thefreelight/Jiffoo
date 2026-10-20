-- Artifact local storage columns for ExtensionSubmission
ALTER TABLE "ExtensionSubmission" ADD COLUMN "artifactStoragePath" TEXT;
ALTER TABLE "ExtensionSubmission" ADD COLUMN "artifactFilename" TEXT;
ALTER TABLE "ExtensionSubmission" ADD COLUMN "artifactSize" INTEGER;
