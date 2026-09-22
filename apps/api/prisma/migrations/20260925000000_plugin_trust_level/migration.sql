CREATE TYPE "PluginTrustLevel" AS ENUM ('builtin', 'signed', 'unsigned');

ALTER TABLE "plugin_installs" ADD COLUMN "trustLevel" "PluginTrustLevel" NOT NULL DEFAULT 'unsigned';

UPDATE "plugin_installs" SET "trustLevel" = 'builtin' WHERE "source" = 'builtin';
UPDATE "plugin_installs" SET "manifestJson" = "manifestJson" - 'trustLevel' WHERE "manifestJson" ? 'trustLevel';
