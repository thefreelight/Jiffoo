-- AlterTable
ALTER TABLE "plugin_installations" ADD COLUMN     "lastFailureAt" TIMESTAMP(3),
ADD COLUMN     "lastFailureMessage" TEXT;
