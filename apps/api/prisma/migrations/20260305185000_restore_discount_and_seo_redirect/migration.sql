-- ============================================================
-- TABLE: seo_redirects
-- ============================================================
CREATE TABLE "public"."seo_redirects" (
    "id" TEXT NOT NULL,
    "fromPath" TEXT NOT NULL,
    "toPath" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_redirects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seo_redirects_fromPath_key" ON "public"."seo_redirects"("fromPath");
CREATE INDEX "seo_redirects_isActive_idx" ON "public"."seo_redirects"("isActive");
CREATE INDEX "seo_redirects_createdAt_idx" ON "public"."seo_redirects"("createdAt");

-- ============================================================
-- TABLE: discounts
-- ============================================================
CREATE TABLE "public"."discounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "minAmount" DECIMAL(18,2),
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "discounts_code_key" ON "public"."discounts"("code");
CREATE INDEX "discounts_isActive_idx" ON "public"."discounts"("isActive");
CREATE INDEX "discounts_code_idx" ON "public"."discounts"("code");

-- ============================================================
-- TABLE: discount_products
-- ============================================================
CREATE TABLE "public"."discount_products" (
    "id" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discount_products_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "public"."discounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "discount_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "discount_products_discountId_productId_key" ON "public"."discount_products"("discountId", "productId");
CREATE INDEX "discount_products_productId_idx" ON "public"."discount_products"("productId");

-- ============================================================
-- TABLE: discount_customer_groups
-- ============================================================
CREATE TABLE "public"."discount_customer_groups" (
    "id" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "customerGroup" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_customer_groups_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discount_customer_groups_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "public"."discounts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "discount_customer_groups_discountId_customerGroup_key" ON "public"."discount_customer_groups"("discountId", "customerGroup");

-- ============================================================
-- TABLE: discount_usages
-- ============================================================
CREATE TABLE "public"."discount_usages" (
    "id" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "discountAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_usages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discount_usages_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "public"."discounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "discount_usages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "discount_usages_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "discount_usages_discountId_orderId_key" ON "public"."discount_usages"("discountId", "orderId");
CREATE INDEX "discount_usages_userId_idx" ON "public"."discount_usages"("userId");
CREATE INDEX "discount_usages_orderId_idx" ON "public"."discount_usages"("orderId");
