/**
 * Admin Product Management OpenAPI Schemas
 */

import {
  createTypedCrudResponses,
  createTypedCreateResponses,
  createTypedReadResponses,
  createTypedUpdateResponses,
  createTypedDeleteResponses,
  createPageResultSchema,
  uploadResultSchema,
} from '@/types/common-dto';

// ============================================================================
// Product Variant Schema
// ============================================================================

const productVariantSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Variant ID' },
    name: { type: 'string', description: 'Variant name' },
    salePrice: { type: 'number', description: 'Sale price' },
    costPrice: { type: 'number', nullable: true, description: 'Source cost price' },
    baseStock: { type: 'number', description: 'Base stock quantity' },
    skuCode: { type: 'string', nullable: true, description: 'SKU code' },
    isActive: { type: 'boolean', description: 'Is active' },
    sourceIsActive: { type: 'boolean', nullable: true, description: 'Source active state' },
    hasPendingChange: { type: 'boolean', description: 'Whether source changes are pending review' },
    pendingChangeSummary: { type: 'object', nullable: true, additionalProperties: true, description: 'Source change summary' },
    attributes: { type: 'object', additionalProperties: true, description: 'Variant attributes' },
  },
  required: ['id', 'name', 'salePrice', 'baseStock'],
} as const;

// ============================================================================
// Admin Product Schema
// ============================================================================

const adminProductListItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Product ID' },
    name: { type: 'string', description: 'Product name' },
    description: { type: 'string', nullable: true, description: 'Product description' },
    categoryId: { type: 'string', nullable: true, description: 'Category ID' },
    categoryName: { type: 'string', nullable: true, description: 'Category name' },
    skuCode: { type: 'string', nullable: true, description: 'Lowest-price SKU code' },
    price: { type: 'number', description: 'Lowest active SKU price' },
    stock: { type: 'number', description: 'Total stock across active SKUs' },
    isActive: { type: 'boolean', description: 'Whether this product has any active SKUs' },
    sourceProvider: { type: 'string', nullable: true, description: 'External source provider' },
    sourceIsActive: { type: 'boolean', nullable: true, description: 'Source active state' },
    hasPendingChange: { type: 'boolean', description: 'Whether source changes are pending review' },
    requiresShippingLocked: { type: 'boolean', description: 'Whether requiresShipping is source-locked' },
    variantsCount: { type: 'integer', description: 'Number of variants' },
    createdAt: { type: 'string', format: 'date-time', description: 'Creation time' },
  },
  required: [
    'id',
    'name',
    'description',
    'categoryId',
    'categoryName',
    'skuCode',
    'price',
    'stock',
    'isActive',
    'sourceProvider',
    'sourceIsActive',
    'hasPendingChange',
    'requiresShippingLocked',
    'variantsCount',
    'createdAt',
  ],
} as const;

const adminProductSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Product ID' },
    name: { type: 'string', description: 'Product name' },
    description: { type: 'string', nullable: true, description: 'Product description' },
    images: { type: 'array', items: { type: 'string' }, description: 'Product image URLs' },
    isActive: { type: 'boolean', description: 'Whether the product is active' },
    categoryId: { type: 'string', nullable: true, description: 'Category ID' },
    requiresShipping: { type: 'boolean', description: 'Whether this product requires shipping address' },
    sourceProvider: { type: 'string', nullable: true, description: 'External source provider' },
    sourceIsActive: { type: 'boolean', nullable: true, description: 'Source active state' },
    hasPendingChange: { type: 'boolean', description: 'Whether source changes are pending review' },
    pendingChangeSummary: { type: 'object', nullable: true, additionalProperties: true, description: 'Source change summary' },
    requiresShippingLocked: { type: 'boolean', description: 'Whether requiresShipping is source-locked' },
    variants: { type: 'array', items: productVariantSchema, description: 'Product variants' },
    status: { type: 'string', description: 'Product status' },
    createdAt: { type: 'string', format: 'date-time', description: 'Creation time' },
    updatedAt: { type: 'string', format: 'date-time', description: 'Last update time' },
  },
  required: ['id', 'name', 'variants', 'createdAt', 'updatedAt'],
} as const;

const externalSourceProductSchema = {
  type: 'object',
  nullable: true,
  properties: {
    provider: { type: 'string' },
    installationId: { type: 'string' },
    storeId: { type: 'string' },
    externalProductCode: { type: 'string' },
    externalName: { type: 'string', nullable: true },
    externalHash: { type: 'string', nullable: true },
    sourceName: { type: 'string', nullable: true },
    sourceDescription: { type: 'string', nullable: true },
    sourceCategoryCode: { type: 'string', nullable: true },
    sourceIsActive: { type: 'boolean', nullable: true },
    sourcePayloadJson: { type: 'object', nullable: true, additionalProperties: true },
    sourcePayloadHash: { type: 'string', nullable: true },
    syncStatus: { type: 'string' },
    sourceUpdatedAt: { type: 'string', nullable: true, format: 'date-time' },
    lastSyncedAt: { type: 'string', nullable: true, format: 'date-time' },
    lastComparedAt: { type: 'string', nullable: true, format: 'date-time' },
    lastApprovedAt: { type: 'string', nullable: true, format: 'date-time' },
    hasPendingChange: { type: 'boolean' },
    pendingChangeSummary: { type: 'object', nullable: true, additionalProperties: true },
  },
} as const;

const externalSourceVariantSchema = {
  type: 'object',
  properties: {
    coreVariantId: { type: 'string' },
    coreSkuCode: { type: 'string', nullable: true },
    externalVariantCode: { type: 'string' },
    externalProductCode: { type: 'string' },
    externalHash: { type: 'string', nullable: true },
    sourceVariantName: { type: 'string', nullable: true },
    sourceSkuCode: { type: 'string', nullable: true },
    sourceCostPrice: { type: 'number', nullable: true },
    sourceIsActive: { type: 'boolean', nullable: true },
    sourceAttributesJson: { type: 'object', nullable: true, additionalProperties: true },
    sourcePayloadHash: { type: 'string', nullable: true },
    syncStatus: { type: 'string' },
    sourceUpdatedAt: { type: 'string', nullable: true, format: 'date-time' },
    lastSyncedAt: { type: 'string', nullable: true, format: 'date-time' },
    lastComparedAt: { type: 'string', nullable: true, format: 'date-time' },
    lastApprovedAt: { type: 'string', nullable: true, format: 'date-time' },
    hasPendingChange: { type: 'boolean' },
    pendingChangeSummary: { type: 'object', nullable: true, additionalProperties: true },
  },
  required: ['coreVariantId', 'externalVariantCode', 'externalProductCode', 'syncStatus', 'hasPendingChange'],
} as const;

const externalSourceDetailsSchema = {
  type: 'object',
  properties: {
    productId: { type: 'string' },
    productName: { type: 'string' },
    sourceProvider: { type: 'string', nullable: true },
    linked: { type: 'boolean' },
    product: externalSourceProductSchema,
    variants: { type: 'array', items: externalSourceVariantSchema },
  },
  required: ['productId', 'productName', 'sourceProvider', 'linked', 'product', 'variants'],
} as const;

const externalSourceAckSchema = {
  type: 'object',
  properties: {
    productId: { type: 'string' },
    acknowledgedAt: { type: 'string', format: 'date-time' },
    productLinksUpdated: { type: 'integer' },
    variantLinksUpdated: { type: 'integer' },
  },
  required: ['productId', 'acknowledgedAt', 'productLinksUpdated', 'variantLinksUpdated'],
} as const;

const externalSourceVariantAckSchema = {
  type: 'object',
  properties: {
    productId: { type: 'string' },
    variantId: { type: 'string' },
    acknowledgedAt: { type: 'string', format: 'date-time' },
    variantLinksUpdated: { type: 'integer' },
  },
  required: ['productId', 'variantId', 'acknowledgedAt', 'variantLinksUpdated'],
} as const;

// ============================================================================
// Category Schema
// ============================================================================

const categorySchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Category ID' },
    name: { type: 'string', description: 'Category name' },
    description: { type: 'string', nullable: true, description: 'Category description' },
    parentId: { type: 'string', nullable: true, description: 'Parent category ID' },
  },
  required: ['id', 'name'],
} as const;

const deleteProductResultSchema = {
  type: 'object',
  properties: {
    productId: { type: 'string', description: 'Deleted product ID' },
    deleted: { type: 'boolean', description: 'Whether deletion succeeded' },
  },
  required: ['productId', 'deleted'],
} as const;

const productStatsSchema = {
  type: 'object',
  properties: {
    metrics: {
      type: 'object',
      properties: {
        totalProducts: { type: 'integer' },
        activeProducts: { type: 'integer' },
        lowStockProducts: { type: 'integer' },
        outOfStockProducts: { type: 'integer' },
        totalProductsTrend: { type: 'number' },
        activeProductsTrend: { type: 'number' },
        lowStockProductsTrend: { type: 'number' },
        outOfStockProductsTrend: { type: 'number' },
      },
      required: [
        'totalProducts',
        'activeProducts',
        'lowStockProducts',
        'outOfStockProducts',
        'totalProductsTrend',
        'activeProductsTrend',
        'lowStockProductsTrend',
        'outOfStockProductsTrend',
      ],
    },
  },
  required: ['metrics'],
} as const;

// ============================================================================
// Endpoint Schemas
// ============================================================================

export const adminProductSchemas = {
  // GET /api/admin/products/ (paginated)
  listProducts: {
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1, minimum: 1, description: 'Page number' },
        limit: { type: 'integer', default: 10, minimum: 1, maximum: 100, description: 'Items per page' },
        search: { type: 'string', description: 'Search term' },
        categoryId: { type: 'string', description: 'Filter by category ID' },
        minPrice: { type: 'number', description: 'Minimum variant price filter' },
        maxPrice: { type: 'number', description: 'Maximum variant price filter' },
        inStock: { type: 'boolean', description: 'Filter by in-stock variants' },
        lowStock: { type: 'boolean', description: 'Filter by low stock variants' },
        lowStockThreshold: { type: 'integer', minimum: 1, description: 'Low stock threshold (default: 10)' },
        sortBy: { type: 'string', enum: ['name', 'createdAt', 'updatedAt'], description: 'Sort field' },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order' },
      },
    },
    response: createTypedReadResponses(createPageResultSchema(adminProductListItemSchema)),
  },

  // GET /api/admin/products/stats
  getProductStats: {
    response: createTypedReadResponses(productStatsSchema),
  },

  // GET /api/admin/products/:id
  getProduct: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Product ID' },
      },
    },
    response: createTypedReadResponses(adminProductSchema),
  },

  getExternalSource: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Product ID' },
      },
    },
    response: createTypedReadResponses(externalSourceDetailsSchema),
  },

  acknowledgeExternalSource: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Product ID' },
      },
    },
    response: createTypedUpdateResponses(externalSourceAckSchema),
  },

  acknowledgeExternalSourceVariant: {
    params: {
      type: 'object',
      required: ['id', 'variantId'],
      properties: {
        id: { type: 'string', description: 'Product ID' },
        variantId: { type: 'string', description: 'Variant ID' },
      },
    },
    response: createTypedUpdateResponses(externalSourceVariantAckSchema),
  },

  // POST /api/admin/products/
  createProduct: {
    body: {
      type: 'object',
      required: ['name', 'variants'],
      properties: {
        name: { type: 'string', description: 'Product name' },
        description: { type: 'string', description: 'Product description' },
        categoryId: { type: 'string', nullable: true, description: 'Category ID' },
        requiresShipping: { type: 'boolean', description: 'Whether this product requires shipping address' },
        images: { type: 'array', items: { type: 'string' }, description: 'Image URLs' },
        variants: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['name', 'baseStock'],
            anyOf: [
              { required: ['salePrice'] },
              { required: ['basePrice'] },
            ],
            properties: {
              name: { type: 'string' },
              salePrice: { type: 'number' },
              basePrice: { type: 'number', description: 'Legacy alias of salePrice' },
              costPrice: { type: 'number', nullable: true },
              baseStock: { type: 'integer' },
              skuCode: { type: 'string' },
              isActive: { type: 'boolean' },
              attributes: { type: 'object', additionalProperties: true },
            },
          },
          description: 'Product variants (at least 1 required)',
        },
      },
    },
    response: createTypedCreateResponses(adminProductSchema),
  },

  // PUT /api/admin/products/:id
  updateProduct: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Product ID' },
      },
    },
    body: {
      type: 'object',
      required: ['variants'],
      properties: {
        name: { type: 'string', description: 'Product name' },
        description: { type: 'string', description: 'Product description' },
        categoryId: { type: 'string', nullable: true, description: 'Category ID' },
        requiresShipping: { type: 'boolean', description: 'Whether this product requires shipping address' },
        images: { type: 'array', items: { type: 'string' }, description: 'Image URLs' },
        variants: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['name', 'baseStock'],
            anyOf: [
              { required: ['salePrice'] },
              { required: ['basePrice'] },
            ],
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              salePrice: { type: 'number' },
              basePrice: { type: 'number', description: 'Legacy alias of salePrice' },
              costPrice: { type: 'number', nullable: true },
              baseStock: { type: 'integer' },
              skuCode: { type: 'string' },
              isActive: { type: 'boolean' },
              attributes: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
    },
    response: createTypedUpdateResponses(adminProductSchema),
  },

  // DELETE /api/admin/products/:id
  deleteProduct: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Product ID' },
      },
    },
    response: createTypedDeleteResponses(deleteProductResultSchema),
  },

  // POST /api/admin/products/upload-image
  uploadImage: {
    response: createTypedCrudResponses(uploadResultSchema),
  },

  // GET /api/admin/products/categories
  getCategories: {
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1, minimum: 1, description: 'Page number' },
        limit: { type: 'integer', default: 20, minimum: 1, maximum: 100, description: 'Items per page' },
      },
    },
    response: createTypedReadResponses(createPageResultSchema(categorySchema)),
  },
} as const;
