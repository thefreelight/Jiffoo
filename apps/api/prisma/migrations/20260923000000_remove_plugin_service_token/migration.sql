-- DropForeignKey
ALTER TABLE "plugin_service_tokens" DROP CONSTRAINT "plugin_service_tokens_installationId_fkey";

-- DropTable
DROP TABLE "plugin_service_tokens";
