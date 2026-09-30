-- AlterTable
ALTER TABLE "plugin_installs" ADD COLUMN     "publisherCertificateFingerprint" TEXT,
ADD COLUMN     "publisherId" TEXT,
ADD COLUMN     "publisherName" TEXT;
