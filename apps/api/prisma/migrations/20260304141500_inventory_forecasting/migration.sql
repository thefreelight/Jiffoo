-- CreateTable
CREATE TABLE "inventory_forecasts" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "forecastDate" TIMESTAMP(3) NOT NULL,
    "predictedDemand" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "seasonalFactors" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_accuracy" (
    "id" TEXT NOT NULL,
    "forecastId" TEXT NOT NULL,
    "actualDemand" DOUBLE PRECISION NOT NULL,
    "predictedDemand" DOUBLE PRECISION NOT NULL,
    "mae" DOUBLE PRECISION,
    "mape" DOUBLE PRECISION,
    "rmse" DOUBLE PRECISION,
    "evaluationDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forecast_accuracy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reorder_alerts" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION,
    "currentStock" INTEGER NOT NULL,
    "recommendedOrder" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reorder_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_forecasts_productId_idx" ON "inventory_forecasts"("productId");

-- CreateIndex
CREATE INDEX "inventory_forecasts_variantId_idx" ON "inventory_forecasts"("variantId");

-- CreateIndex
CREATE INDEX "inventory_forecasts_forecastDate_idx" ON "inventory_forecasts"("forecastDate");

-- CreateIndex
CREATE INDEX "forecast_accuracy_forecastId_idx" ON "forecast_accuracy"("forecastId");

-- CreateIndex
CREATE INDEX "forecast_accuracy_evaluationDate_idx" ON "forecast_accuracy"("evaluationDate");

-- CreateIndex
CREATE INDEX "reorder_alerts_productId_idx" ON "reorder_alerts"("productId");

-- CreateIndex
CREATE INDEX "reorder_alerts_variantId_idx" ON "reorder_alerts"("variantId");

-- CreateIndex
CREATE INDEX "reorder_alerts_alertType_idx" ON "reorder_alerts"("alertType");

-- CreateIndex
CREATE INDEX "reorder_alerts_status_idx" ON "reorder_alerts"("status");

-- CreateIndex
CREATE INDEX "reorder_alerts_createdAt_idx" ON "reorder_alerts"("createdAt");

-- AddForeignKey
ALTER TABLE "forecast_accuracy" ADD CONSTRAINT "forecast_accuracy_forecastId_fkey" FOREIGN KEY ("forecastId") REFERENCES "inventory_forecasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
