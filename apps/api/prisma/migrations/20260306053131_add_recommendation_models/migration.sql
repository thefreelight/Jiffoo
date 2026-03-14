-- AlterTable
ALTER TABLE "product_variants" ALTER COLUMN "salePrice" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "shipment_items" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "stock_alerts" ALTER COLUMN "alertType" SET DEFAULT 'LOW_STOCK';

-- CreateTable
CREATE TABLE "recommendation_interactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "productId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "recommendationType" TEXT NOT NULL,
    "sourceProductId" TEXT,
    "sourceContext" TEXT,
    "action" TEXT NOT NULL,
    "algorithmVariant" TEXT,
    "testGroupId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recommendationType" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trafficPercentage" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "parameters" JSONB,
    "metricsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_affinities" (
    "id" TEXT NOT NULL,
    "productAId" TEXT NOT NULL,
    "productBId" TEXT NOT NULL,
    "affinityScore" DOUBLE PRECISION NOT NULL,
    "coOccurrences" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" DOUBLE PRECISION,
    "affinityType" TEXT NOT NULL,
    "lastCalculated" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_affinities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recommendation_interactions_userId_idx" ON "recommendation_interactions"("userId");

-- CreateIndex
CREATE INDEX "recommendation_interactions_sessionId_idx" ON "recommendation_interactions"("sessionId");

-- CreateIndex
CREATE INDEX "recommendation_interactions_productId_idx" ON "recommendation_interactions"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_affinities_productAId_productBId_affinityType_key" ON "product_affinities"("productAId", "productBId", "affinityType");

-- AddForeignKey
ALTER TABLE "product_affinities" ADD CONSTRAINT "product_affinities_productAId_fkey" FOREIGN KEY ("productAId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_affinities" ADD CONSTRAINT "product_affinities_productBId_fkey" FOREIGN KEY ("productBId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
