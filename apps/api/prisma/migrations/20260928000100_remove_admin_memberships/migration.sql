-- DropForeignKey
ALTER TABLE "admin_memberships" DROP CONSTRAINT "admin_memberships_userId_fkey";

-- DropTable
DROP TABLE "admin_memberships";
