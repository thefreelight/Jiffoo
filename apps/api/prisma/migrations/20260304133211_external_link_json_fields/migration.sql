/*
  Warnings:

  - The `sourcePayloadJson` column on the `external_product_links` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `pendingChangeSummary` column on the `external_product_links` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `sourceAttributesJson` column on the `external_variant_links` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `pendingChangeSummary` column on the `external_variant_links` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "external_product_links" DROP COLUMN "sourcePayloadJson",
ADD COLUMN     "sourcePayloadJson" JSONB,
DROP COLUMN "pendingChangeSummary",
ADD COLUMN     "pendingChangeSummary" JSONB;

-- AlterTable
ALTER TABLE "external_variant_links" DROP COLUMN "sourceAttributesJson",
ADD COLUMN     "sourceAttributesJson" JSONB,
DROP COLUMN "pendingChangeSummary",
ADD COLUMN     "pendingChangeSummary" JSONB;
