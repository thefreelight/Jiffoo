-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");
CREATE INDEX "users_email_idx" ON "public"."users"("email");
CREATE INDEX "users_role_idx" ON "public"."users"("role");

-- ============================================================
-- TABLE: categories
-- ============================================================
CREATE TABLE "public"."categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "canonicalUrl" TEXT,
    "structuredData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categories_slug_key" ON "public"."categories"("slug");
CREATE INDEX "categories_parentId_idx" ON "public"."categories"("parentId");

-- ============================================================
-- TABLE: products
-- ============================================================
CREATE TABLE "public"."products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "productType" TEXT NOT NULL DEFAULT 'physical',
    "typeData" TEXT,
    "weight" DOUBLE PRECISION,
    "length" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "requiresShipping" BOOLEAN NOT NULL DEFAULT true,
    "shippingClass" TEXT,
    "categoryId" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "canonicalUrl" TEXT,
    "structuredData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "products_slug_key" ON "public"."products"("slug");
CREATE INDEX "products_categoryId_idx" ON "public"."products"("categoryId");
CREATE INDEX "products_productType_idx" ON "public"."products"("productType");

-- ============================================================
-- TABLE: product_variants
-- ============================================================
CREATE TABLE "public"."product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attributes" TEXT,
    "salePrice" DOUBLE PRECISION NOT NULL,
    "costPrice" DOUBLE PRECISION,
    "baseStock" INTEGER NOT NULL DEFAULT 0,
    "skuCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_variants_productId_idx" ON "public"."product_variants"("productId");
CREATE INDEX "product_variants_skuCode_idx" ON "public"."product_variants"("skuCode");

-- ============================================================
-- TABLE: product_translations
-- ============================================================
CREATE TABLE "public"."product_translations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_translations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_translations_productId_idx" ON "public"."product_translations"("productId");
CREATE INDEX "product_translations_locale_idx" ON "public"."product_translations"("locale");
CREATE UNIQUE INDEX "product_translations_productId_locale_key" ON "public"."product_translations"("productId", "locale");

-- ============================================================
-- TABLE: orders
-- ============================================================
CREATE TABLE "public"."orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "lastPaymentAttemptAt" TIMESTAMP(3),
    "paymentAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastPaymentMethod" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "subtotalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "customerEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "orders_status_idx" ON "public"."orders"("status");
CREATE INDEX "orders_paymentStatus_idx" ON "public"."orders"("paymentStatus");
CREATE INDEX "orders_expiresAt_idx" ON "public"."orders"("expiresAt");
CREATE INDEX "orders_userId_idx" ON "public"."orders"("userId");

-- ============================================================
-- TABLE: order_items
-- ============================================================
CREATE TABLE "public"."order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',

    -- Shipping address (per item)
    "shippingFirstName" TEXT,
    "shippingLastName" TEXT,
    "shippingPhone" TEXT,
    "shippingEmail" TEXT,
    "shippingAddressLine1" TEXT,
    "shippingAddressLine2" TEXT,
    "shippingCity" TEXT,
    "shippingState" TEXT,
    "shippingCountry" TEXT,
    "shippingPostalCode" TEXT,

    -- Fulfillment
    "fulfillmentStatus" TEXT NOT NULL DEFAULT 'pending',
    "fulfillmentData" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_items_orderId_idx" ON "public"."order_items"("orderId");
CREATE INDEX "order_items_variantId_idx" ON "public"."order_items"("variantId");
CREATE INDEX "order_items_fulfillmentStatus_idx" ON "public"."order_items"("fulfillmentStatus");
CREATE INDEX "order_items_shippingCountry_idx" ON "public"."order_items"("shippingCountry");

-- ============================================================
-- TABLE: shipment_items
-- One record per shipment attempt per order item.
-- Multiple records = full shipment history (re-ship, return, etc.)
-- ============================================================
CREATE TABLE "public"."shipment_items" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shipment_items_orderItemId_idx" ON "public"."shipment_items"("orderItemId");
CREATE INDEX "shipment_items_trackingNumber_idx" ON "public"."shipment_items"("trackingNumber");
CREATE INDEX "shipment_items_status_idx" ON "public"."shipment_items"("status");

-- ============================================================
-- TABLE: inventory_reservations
-- ============================================================
CREATE TABLE "public"."inventory_reservations" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inventory_reservations_expiresAt_status_idx" ON "public"."inventory_reservations"("expiresAt", "status");
CREATE INDEX "inventory_reservations_productId_status_idx" ON "public"."inventory_reservations"("productId", "status");
CREATE INDEX "inventory_reservations_variantId_status_idx" ON "public"."inventory_reservations"("variantId", "status");
CREATE UNIQUE INDEX "inventory_reservations_orderId_productId_variantId_key" ON "public"."inventory_reservations"("orderId", "productId", "variantId");

-- ============================================================
-- TABLE: carts
-- ============================================================
CREATE TABLE "public"."carts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "carts_userId_key" ON "public"."carts"("userId");
CREATE INDEX "carts_userId_idx" ON "public"."carts"("userId");
CREATE INDEX "carts_status_idx" ON "public"."carts"("status");

-- ============================================================
-- TABLE: cart_items
-- ============================================================
CREATE TABLE "public"."cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "variantId" TEXT NOT NULL,

    -- Shipping address draft (per item, nullable until user fills in)
    "shippingFirstName" TEXT,
    "shippingLastName" TEXT,
    "shippingPhone" TEXT,
    "shippingEmail" TEXT,
    "shippingAddressLine1" TEXT,
    "shippingAddressLine2" TEXT,
    "shippingCity" TEXT,
    "shippingState" TEXT,
    "shippingCountry" TEXT,
    "shippingPostalCode" TEXT,

    "fulfillmentData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cart_items_cartId_idx" ON "public"."cart_items"("cartId");
CREATE INDEX "cart_items_productId_idx" ON "public"."cart_items"("productId");
CREATE INDEX "cart_items_variantId_idx" ON "public"."cart_items"("variantId");

-- ============================================================
-- TABLE: payments
-- ============================================================
CREATE TABLE "public"."payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "sessionId" TEXT,
    "sessionUrl" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payments_paymentIntentId_idx" ON "public"."payments"("paymentIntentId");
CREATE INDEX "payments_sessionId_idx" ON "public"."payments"("sessionId");
CREATE INDEX "payments_orderId_attemptNumber_idx" ON "public"."payments"("orderId", "attemptNumber");

-- ============================================================
-- TABLE: refunds
-- ============================================================
CREATE TABLE "public"."refunds" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "provider" TEXT,
    "providerRefundId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refunds_providerRefundId_key" ON "public"."refunds"("providerRefundId");
CREATE UNIQUE INDEX "refunds_idempotencyKey_key" ON "public"."refunds"("idempotencyKey");
CREATE INDEX "refunds_paymentId_idx" ON "public"."refunds"("paymentId");
CREATE INDEX "refunds_orderId_idx" ON "public"."refunds"("orderId");

-- ============================================================
-- TABLE: system_settings
-- Single-row table (id = 'system') — stores global site config
-- ============================================================
CREATE TABLE "public"."system_settings" (
    "id" TEXT NOT NULL DEFAULT 'system',
    "isInstalled" BOOLEAN NOT NULL DEFAULT false,
    "installedAt" TIMESTAMP(3),
    "installedBy" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "lastUpdatedAt" TIMESTAMP(3),
    "siteName" TEXT NOT NULL DEFAULT 'Jiffoo Mall',
    "siteDescription" TEXT,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "allowRegistration" BOOLEAN NOT NULL DEFAULT true,
    "requireEmailVerification" BOOLEAN NOT NULL DEFAULT true,
    "settings" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- TABLE: plugin_installs
-- ============================================================
CREATE TABLE "public"."plugin_installs" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "author" TEXT,
    "authorUrl" TEXT,
    "description" TEXT,
    "category" TEXT,
    "runtimeType" TEXT NOT NULL DEFAULT 'internal-fastify',
    "entryModule" TEXT,
    "externalBaseUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'local-zip',
    "installPath" TEXT,
    "zipHash" TEXT,
    "manifestJson" TEXT,
    "permissions" TEXT,
    "deletedAt" TIMESTAMP(3),
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_installs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plugin_installs_slug_key" ON "public"."plugin_installs"("slug");
CREATE INDEX "plugin_installs_category_idx" ON "public"."plugin_installs"("category");
CREATE INDEX "plugin_installs_runtimeType_idx" ON "public"."plugin_installs"("runtimeType");
CREATE INDEX "plugin_installs_zipHash_idx" ON "public"."plugin_installs"("zipHash");
CREATE INDEX "plugin_installs_deletedAt_idx" ON "public"."plugin_installs"("deletedAt");

-- ============================================================
-- TABLE: plugin_installations
-- ============================================================
CREATE TABLE "public"."plugin_installations" (
    "id" TEXT NOT NULL,
    "pluginSlug" TEXT NOT NULL,
    "instanceKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configJson" TEXT,
    "grantedPermissions" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_installations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "plugin_installations_pluginSlug_idx" ON "public"."plugin_installations"("pluginSlug");
CREATE INDEX "plugin_installations_enabled_idx" ON "public"."plugin_installations"("enabled");
CREATE INDEX "plugin_installations_deletedAt_idx" ON "public"."plugin_installations"("deletedAt");
CREATE UNIQUE INDEX "plugin_installations_pluginSlug_instanceKey_key" ON "public"."plugin_installations"("pluginSlug", "instanceKey");

-- ============================================================
-- TABLE: installed_themes
-- ============================================================
CREATE TABLE "public"."installed_themes" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "author" TEXT,
    "description" TEXT,
    "source" TEXT NOT NULL DEFAULT 'local-zip',
    "installPath" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installed_themes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "installed_themes_target_idx" ON "public"."installed_themes"("target");
CREATE INDEX "installed_themes_isActive_idx" ON "public"."installed_themes"("isActive");
CREATE UNIQUE INDEX "installed_themes_slug_target_key" ON "public"."installed_themes"("slug", "target");

-- ============================================================
-- TABLE: outbox_events
-- ============================================================
CREATE TABLE "public"."outbox_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "traceId" TEXT,
    "actorId" TEXT,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outbox_events_published_occurredAt_idx" ON "public"."outbox_events"("published", "occurredAt");
CREATE INDEX "outbox_events_aggregateId_idx" ON "public"."outbox_events"("aggregateId");

-- ============================================================
-- TABLE: warehouses
-- ============================================================
CREATE TABLE "public"."warehouses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "warehouses_code_key" ON "public"."warehouses"("code");
CREATE INDEX "warehouses_code_idx" ON "public"."warehouses"("code");
CREATE INDEX "warehouses_isActive_idx" ON "public"."warehouses"("isActive");
CREATE INDEX "warehouses_isDefault_idx" ON "public"."warehouses"("isDefault");

-- ============================================================
-- TABLE: warehouse_inventories
-- ============================================================
CREATE TABLE "public"."warehouse_inventories" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL DEFAULT 0,
    "lowStock" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_inventories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "warehouse_inventories_warehouseId_idx" ON "public"."warehouse_inventories"("warehouseId");
CREATE INDEX "warehouse_inventories_variantId_idx" ON "public"."warehouse_inventories"("variantId");
CREATE INDEX "warehouse_inventories_quantity_idx" ON "public"."warehouse_inventories"("quantity");
CREATE INDEX "warehouse_inventories_available_idx" ON "public"."warehouse_inventories"("available");
CREATE UNIQUE INDEX "warehouse_inventories_warehouseId_variantId_key" ON "public"."warehouse_inventories"("warehouseId", "variantId");

-- ============================================================
-- TABLE: inventory_adjustments
-- ============================================================
CREATE TABLE "public"."inventory_adjustments" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "userId" TEXT,
    "referenceId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inventory_adjustments_warehouseId_idx" ON "public"."inventory_adjustments"("warehouseId");
CREATE INDEX "inventory_adjustments_variantId_idx" ON "public"."inventory_adjustments"("variantId");
CREATE INDEX "inventory_adjustments_type_idx" ON "public"."inventory_adjustments"("type");
CREATE INDEX "inventory_adjustments_createdAt_idx" ON "public"."inventory_adjustments"("createdAt");
CREATE INDEX "inventory_adjustments_userId_idx" ON "public"."inventory_adjustments"("userId");

-- ============================================================
-- TABLE: inventory_transfers
-- ============================================================
CREATE TABLE "public"."inventory_transfers" (
    "id" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "notes" TEXT,
    "userId" TEXT,
    "referenceId" TEXT,
    "metadata" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inventory_transfers_fromWarehouseId_idx" ON "public"."inventory_transfers"("fromWarehouseId");
CREATE INDEX "inventory_transfers_toWarehouseId_idx" ON "public"."inventory_transfers"("toWarehouseId");
CREATE INDEX "inventory_transfers_variantId_idx" ON "public"."inventory_transfers"("variantId");
CREATE INDEX "inventory_transfers_status_idx" ON "public"."inventory_transfers"("status");
CREATE INDEX "inventory_transfers_createdAt_idx" ON "public"."inventory_transfers"("createdAt");
CREATE INDEX "inventory_transfers_userId_idx" ON "public"."inventory_transfers"("userId");

-- ============================================================
-- TABLE: error_logs
-- ============================================================
CREATE TABLE "public"."error_logs" (
    "id" TEXT NOT NULL,
    "errorHash" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "requestId" TEXT,
    "userId" TEXT,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "headers" TEXT,
    "body" TEXT,
    "query" TEXT,
    "params" TEXT,
    "environment" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "severity" TEXT NOT NULL DEFAULT 'error',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "error_logs_errorHash_idx" ON "public"."error_logs"("errorHash");
CREATE INDEX "error_logs_occurredAt_idx" ON "public"."error_logs"("occurredAt");
CREATE INDEX "error_logs_userId_idx" ON "public"."error_logs"("userId");
CREATE INDEX "error_logs_severity_idx" ON "public"."error_logs"("severity");
CREATE INDEX "error_logs_resolved_idx" ON "public"."error_logs"("resolved");
CREATE INDEX "error_logs_lastSeenAt_idx" ON "public"."error_logs"("lastSeenAt");

-- ============================================================
-- TABLE: external_category_links
-- storeId retained: plugin-protocol routing metadata, not multi-tenancy
-- ============================================================
CREATE TABLE "public"."external_category_links" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "externalCode" TEXT NOT NULL,
    "externalName" TEXT,
    "externalHash" TEXT,
    "coreCategoryId" TEXT NOT NULL,
    "coreCategorySlug" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastSyncedAt" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_category_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ext_cat_links_uq_src_store_code" ON "public"."external_category_links"("provider", "installationId", "storeId", "externalCode");
CREATE INDEX "ext_cat_links_idx_src" ON "public"."external_category_links"("provider", "installationId");
CREATE INDEX "ext_cat_links_idx_core_cat" ON "public"."external_category_links"("coreCategoryId");
CREATE INDEX "ext_cat_links_idx_status" ON "public"."external_category_links"("syncStatus");

-- ============================================================
-- TABLE: external_product_links
-- storeId retained: plugin-protocol routing metadata, not multi-tenancy
-- ============================================================
CREATE TABLE "public"."external_product_links" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "externalProductCode" TEXT NOT NULL,
    "externalName" TEXT,
    "externalHash" TEXT,
    "coreProductId" TEXT NOT NULL,
    "coreProductSlug" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastSyncedAt" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "sourceName" TEXT,
    "sourceDescription" TEXT,
    "sourceCategoryCode" TEXT,
    "sourceIsActive" BOOLEAN,
    "sourcePayloadJson" TEXT,
    "sourcePayloadHash" TEXT,
    "hasPendingChange" BOOLEAN NOT NULL DEFAULT false,
    "pendingChangeSummary" TEXT,
    "lastComparedAt" TIMESTAMP(3),
    "lastApprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_product_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ext_prod_links_uq_src_store_code" ON "public"."external_product_links"("provider", "installationId", "storeId", "externalProductCode");
CREATE INDEX "ext_prod_links_idx_src" ON "public"."external_product_links"("provider", "installationId");
CREATE INDEX "ext_prod_links_idx_core_prod" ON "public"."external_product_links"("coreProductId");
CREATE INDEX "ext_prod_links_idx_status" ON "public"."external_product_links"("syncStatus");

-- ============================================================
-- TABLE: external_variant_links
-- storeId retained: plugin-protocol routing metadata, not multi-tenancy
-- ============================================================
CREATE TABLE "public"."external_variant_links" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "externalProductCode" TEXT NOT NULL,
    "externalVariantCode" TEXT NOT NULL,
    "externalHash" TEXT,
    "coreProductId" TEXT NOT NULL,
    "coreVariantId" TEXT NOT NULL,
    "coreSkuCode" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastSyncedAt" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "sourceVariantName" TEXT,
    "sourceSkuCode" TEXT,
    "sourceCostPrice" DOUBLE PRECISION,
    "sourceIsActive" BOOLEAN,
    "sourceAttributesJson" TEXT,
    "sourcePayloadHash" TEXT,
    "hasPendingChange" BOOLEAN NOT NULL DEFAULT false,
    "pendingChangeSummary" TEXT,
    "lastComparedAt" TIMESTAMP(3),
    "lastApprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_variant_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ext_var_links_uq_src_store_var" ON "public"."external_variant_links"("provider", "installationId", "storeId", "externalVariantCode");
CREATE INDEX "ext_var_links_idx_src_prod" ON "public"."external_variant_links"("provider", "installationId", "externalProductCode");
CREATE INDEX "ext_var_links_idx_core_prod" ON "public"."external_variant_links"("coreProductId");
CREATE INDEX "ext_var_links_idx_core_var" ON "public"."external_variant_links"("coreVariantId");
CREATE INDEX "ext_var_links_idx_status" ON "public"."external_variant_links"("syncStatus");

-- ============================================================
-- TABLE: external_order_links
-- storeId retained: plugin-protocol routing metadata, not multi-tenancy
-- ============================================================
CREATE TABLE "public"."external_order_links" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "coreOrderId" TEXT NOT NULL,
    "coreOrderItemId" TEXT NOT NULL,
    "externalOrderRef" TEXT NOT NULL,
    "externalOrderName" TEXT,
    "externalStatus" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "requestPayload" TEXT,
    "responsePayload" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_order_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ext_order_links_uq_src_store_item" ON "public"."external_order_links"("provider", "installationId", "storeId", "coreOrderItemId");
CREATE UNIQUE INDEX "ext_order_links_uq_src_store_ref" ON "public"."external_order_links"("provider", "installationId", "storeId", "externalOrderRef");
CREATE INDEX "ext_order_links_idx_core_order" ON "public"."external_order_links"("coreOrderId");
CREATE INDEX "ext_order_links_idx_core_item" ON "public"."external_order_links"("coreOrderItemId");
CREATE INDEX "ext_order_links_idx_status" ON "public"."external_order_links"("syncStatus");

-- ============================================================
-- TABLE: push_subscriptions
-- ============================================================
CREATE TABLE "public"."push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_subscriptions_userId_endpoint_key" ON "public"."push_subscriptions"("userId", "endpoint");
CREATE INDEX "push_subscriptions_userId_idx" ON "public"."push_subscriptions"("userId");

-- ============================================================
-- TABLE: plugin_service_tokens
-- ============================================================
CREATE TABLE "public"."plugin_service_tokens" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "plugin_service_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "plugin_service_tokens_installationId_idx" ON "public"."plugin_service_tokens"("installationId");
CREATE INDEX "plugin_service_tokens_tokenHash_idx" ON "public"."plugin_service_tokens"("tokenHash");
CREATE INDEX "plugin_service_tokens_status_idx" ON "public"."plugin_service_tokens"("status");

-- ============================================================
-- TABLE: webhook_subscriptions
-- ============================================================
CREATE TABLE "public"."webhook_subscriptions" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "deliveryMode" TEXT NOT NULL DEFAULT 'internal',
    "endpointUrl" TEXT,
    "secret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webhook_subscriptions_installationId_idx" ON "public"."webhook_subscriptions"("installationId");
CREATE INDEX "webhook_subscriptions_eventType_idx" ON "public"."webhook_subscriptions"("eventType");
CREATE INDEX "webhook_subscriptions_active_idx" ON "public"."webhook_subscriptions"("active");

-- ============================================================
-- TABLE: webhook_delivery_logs
-- ============================================================
CREATE TABLE "public"."webhook_delivery_logs" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL,
    "responseCode" INTEGER,
    "responseBody" TEXT,
    "errorMessage" TEXT,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latencyMs" INTEGER,

    CONSTRAINT "webhook_delivery_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webhook_delivery_logs_subscriptionId_idx" ON "public"."webhook_delivery_logs"("subscriptionId");
CREATE INDEX "webhook_delivery_logs_eventId_idx" ON "public"."webhook_delivery_logs"("eventId");
CREATE INDEX "webhook_delivery_logs_status_idx" ON "public"."webhook_delivery_logs"("status");

-- ============================================================
-- TABLE: webhook_dead_letters
-- ============================================================
CREATE TABLE "public"."webhook_dead_letters" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "lastError" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replayedAt" TIMESTAMP(3),

    CONSTRAINT "webhook_dead_letters_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webhook_dead_letters_subscriptionId_idx" ON "public"."webhook_dead_letters"("subscriptionId");
CREATE INDEX "webhook_dead_letters_eventId_idx" ON "public"."webhook_dead_letters"("eventId");
CREATE INDEX "webhook_dead_letters_eventType_idx" ON "public"."webhook_dead_letters"("eventType");

-- ============================================================
-- TABLE: plugin_theme_extensions
-- ============================================================
CREATE TABLE "public"."plugin_theme_extensions" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schema" JSONB,
    "dataEndpoint" TEXT,
    "targetPosition" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_theme_extensions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plugin_theme_extensions_installationId_extensionId_key" ON "public"."plugin_theme_extensions"("installationId", "extensionId");
CREATE INDEX "plugin_theme_extensions_installationId_idx" ON "public"."plugin_theme_extensions"("installationId");
CREATE INDEX "plugin_theme_extensions_kind_idx" ON "public"."plugin_theme_extensions"("kind");
CREATE INDEX "plugin_theme_extensions_active_idx" ON "public"."plugin_theme_extensions"("active");

-- =============================================================================
-- FOREIGN KEYS
-- =============================================================================

-- categories → categories (self-ref)
ALTER TABLE "public"."categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- products → categories
ALTER TABLE "public"."products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- product_variants → products
ALTER TABLE "public"."product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- product_translations → products
ALTER TABLE "public"."product_translations" ADD CONSTRAINT "product_translations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- orders → users
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- order_items → orders, products, product_variants
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- shipment_items → order_items
ALTER TABLE "public"."shipment_items" ADD CONSTRAINT "shipment_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "public"."order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- inventory_reservations → orders, products, product_variants
ALTER TABLE "public"."inventory_reservations" ADD CONSTRAINT "inventory_reservations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."inventory_reservations" ADD CONSTRAINT "inventory_reservations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."inventory_reservations" ADD CONSTRAINT "inventory_reservations_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- carts → users
ALTER TABLE "public"."carts" ADD CONSTRAINT "carts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- cart_items → carts, products, product_variants
ALTER TABLE "public"."cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "public"."carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."cart_items" ADD CONSTRAINT "cart_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."cart_items" ADD CONSTRAINT "cart_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- payments → orders
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- refunds → payments, orders
ALTER TABLE "public"."refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."refunds" ADD CONSTRAINT "refunds_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- plugin_installations → plugin_installs
ALTER TABLE "public"."plugin_installations" ADD CONSTRAINT "plugin_installations_pluginSlug_fkey" FOREIGN KEY ("pluginSlug") REFERENCES "public"."plugin_installs"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- warehouse_inventories → warehouses, product_variants
ALTER TABLE "public"."warehouse_inventories" ADD CONSTRAINT "warehouse_inventories_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "public"."warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."warehouse_inventories" ADD CONSTRAINT "warehouse_inventories_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- inventory_adjustments → warehouses, product_variants
ALTER TABLE "public"."inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "public"."warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- inventory_transfers → warehouses (from/to), product_variants
ALTER TABLE "public"."inventory_transfers" ADD CONSTRAINT "inventory_transfers_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "public"."warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."inventory_transfers" ADD CONSTRAINT "inventory_transfers_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "public"."warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."inventory_transfers" ADD CONSTRAINT "inventory_transfers_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "public"."product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- external_order_links → orders, order_items
ALTER TABLE "public"."external_order_links" ADD CONSTRAINT "external_order_links_coreOrderId_fkey" FOREIGN KEY ("coreOrderId") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."external_order_links" ADD CONSTRAINT "external_order_links_coreOrderItemId_fkey" FOREIGN KEY ("coreOrderItemId") REFERENCES "public"."order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- push_subscriptions → users
ALTER TABLE "public"."push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- plugin_service_tokens → plugin_installations
ALTER TABLE "public"."plugin_service_tokens" ADD CONSTRAINT "plugin_service_tokens_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "public"."plugin_installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- webhook_subscriptions → plugin_installations
ALTER TABLE "public"."webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "public"."plugin_installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- webhook_delivery_logs → webhook_subscriptions
ALTER TABLE "public"."webhook_delivery_logs" ADD CONSTRAINT "webhook_delivery_logs_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."webhook_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- webhook_dead_letters → webhook_subscriptions
ALTER TABLE "public"."webhook_dead_letters" ADD CONSTRAINT "webhook_dead_letters_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."webhook_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- plugin_theme_extensions → plugin_installations
ALTER TABLE "public"."plugin_theme_extensions" ADD CONSTRAINT "plugin_theme_extensions_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "public"."plugin_installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
