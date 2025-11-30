/*
  Warnings:

  - A unique constraint covering the columns `[externalInstallationId]` on the table `plugin_installations` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable: Add external plugin support columns to plugins table
ALTER TABLE "public"."plugins" ADD COLUMN "runtimeType" TEXT DEFAULT 'internal-fastify',
ADD COLUMN "externalBaseUrl" TEXT,
ADD COLUMN "oauthConfig" TEXT,
ADD COLUMN "integrationSecrets" TEXT;

-- AlterTable: Add external installation support columns to plugin_installations table
ALTER TABLE "public"."plugin_installations" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "externalInstallationId" TEXT,
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "plugin_installations_externalInstallationId_idx" ON "public"."plugin_installations"("externalInstallationId");

-- Update existing plugins to set runtimeType to 'internal-fastify'
UPDATE "public"."plugins" SET "runtimeType" = 'internal-fastify' WHERE "runtimeType" IS NULL;


