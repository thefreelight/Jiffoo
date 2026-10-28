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
  errorResponseSchema,
  createSuccessResponseSchema,
} from '@/types/common-dto';

const translationSchema = {
  type: 'object',
  required: ['locale', 'name'],
  properties: {
    locale: { type: 'string', enum: ['en', 'zh-Hans', 'zh-Hant'] },
    name: { type: 'string', minLength: 1 },
    description: { type: 'string', nullable: true },
  },
  additionalProperties: false,
} as const;

const translationsSchema = { type: 'array', items: translationSchema, maxItems: 3, uniqueItems: true } as const;

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
    stock: { type: 'number', description: 'Stock quantity' },
    skuCode: { type: 'string', description: 'SKU code' },
    isActive: { type: 'boolean', description: 'Is active' },
    hasOrders: { type: 'boolean' },
    attributes: { type: 'object', additionalProperties: true, description: 'Variant attributes' },
  },
  required: ['id', 'name', 'skuCode', 'salePrice', 'stock', 'hasOrders'],
} as const;

// ============================================================================
// Admin Product Schema
// ============================================================================

const adminProductListItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Product ID' },
    name: { type: 'string', description: 'Product name' },
    spuCode: { type: 'string', description: 'SPU code' },
    description: { type: 'string', nullable: true, description: 'Product description' },
    categoryId: { type: 'string', nullable: true, description: 'Category ID' },
    categoryName: { type: 'string', nullable: true, description: 'Category name' },
    skuCode: { type: 'string', nullable: true, description: 'Lowest-price SKU code' },
    price: { type: 'number', description: 'Lowest active SKU price' },
    stock: { type: 'number', description: 'Total stock across active SKUs' },
    isActive: { type: 'boolean', description: 'Product is enabled and has at least one active variant' },
    variantsCount: { type: 'integer', description: 'Number of variants' },
    variantsActiveCount: { type: 'integer' },
    priceMin: { type: 'number' },
    priceMax: { type: 'number' },
    images: { type: 'array', items: { type: 'string' } },
    createdAt: { type: 'string', format: 'date-time', description: 'Creation time' },
    updatedAt: { type: 'string', format: 'date-time' },
    hasOrders: { type: 'boolean' },
    currency: { type: 'string' },
  },
  required: [
    'id',
    'name',
    'spuCode',
    'description',
    'categoryId',
    'categoryName',
    'skuCode',
    'price',
    'stock',
    'isActive',
    'variantsCount',
    'variantsActiveCount',
    'priceMin',
    'priceMax',
    'images',
    'createdAt',
    'updatedAt', 'hasOrders', 'currency',
  ],
} as const;

const adminProductSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Product ID' },
    slug: { type: 'string' },
    currency: { type: 'string' },
    name: { type: 'string', description: 'Product name' },
    spuCode: { type: 'string', description: 'SPU code' },
    description: { type: 'string', nullable: true, description: 'Product description' },
    images: { type: 'array', items: { type: 'string' }, description: 'Product image URLs' },
    translations: translationsSchema,
    isActive: { type: 'boolean', description: 'Whether the product is active' },
    categoryId: { type: 'string', nullable: true, description: 'Category ID' },
    requiresShipping: { type: 'boolean', description: 'Whether this product requires shipping address' },
    variants: { type: 'array', items: productVariantSchema, description: 'Product variants' },
    status: { type: 'string', description: 'Product status' },
    createdAt: { type: 'string', format: 'date-time', description: 'Creation time' },
    updatedAt: { type: 'string', format: 'date-time', description: 'Last update time' },
  },
  required: ['id', 'name', 'spuCode', 'slug', 'currency', 'variants', 'createdAt', 'updatedAt'],
} as const;

const categorySchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Category ID' },
    name: { type: 'string', description: 'Category name' },
    description: { type: 'string', nullable: true, description: 'Category description' },
    parentId: { type: 'string', nullable: true, description: 'Parent category ID' },
    slug: { type: 'string' },
    translations: translationsSchema,
    productCount: { type: 'integer' }, childCount: { type: 'integer' },
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
    statusCounts: {
      type: 'object',
      properties: { all: { type: 'integer' }, active: { type: 'integer' }, inactive: { type: 'integer' }, outOfStock: { type: 'integer' } },
      required: ['all', 'active', 'inactive', 'outOfStock'],
    },
    metrics: {
      type: 'object',
      properties: {
        totalProducts: { type: 'integer' },
        activeProducts: { type: 'integer' },
        outOfStockProducts: { type: 'integer' },
        totalProductsTrend: { type: 'number' },
        activeProductsTrend: { type: 'number' },
        outOfStockProductsTrend: { type: 'number' },
      },
      required: [
        'totalProducts',
        'activeProducts',
        'outOfStockProducts',
        'totalProductsTrend',
        'activeProductsTrend',
        'outOfStockProductsTrend',
      ],
    },
  },
  required: ['metrics', 'statusCounts'],
} as const;

export const productFilterProperties = {
  search: { type: 'string' }, categoryId: { type: 'string', description: 'Category ID or none for uncategorized products' },
  status: { type: 'string', enum: ['active', 'inactive', 'outOfStock'] }, productType: { type: 'string' },
  minPrice: { type: 'number' }, maxPrice: { type: 'number' }, inStock: { type: 'boolean' },
} as const;
export const productSortProperties = {
  sortBy: { type: 'string', enum: ['name', 'createdAt', 'updatedAt', 'price', 'stock'] },
  sortOrder: { type: 'string', enum: ['asc', 'desc'] },
} as const;
export const productSelectionSchema = {
  type: 'object', additionalProperties: false, required: ['mode'], properties: {
    mode: { type: 'string', enum: ['ids', 'filter'] },
    ids: { type: 'array', minItems: 1, maxItems: 100, items: { type: 'string', minLength: 1 } },
    filter: { type: 'object', additionalProperties: false, properties: productFilterProperties },
    excludeIds: { type: 'array', maxItems: 100, items: { type: 'string', minLength: 1 } },
  }, oneOf: [
    { properties: { mode: { const: 'ids' } }, required: ['ids'], not: { anyOf: [{ required: ['filter'] }, { required: ['excludeIds'] }] } },
    { properties: { mode: { const: 'filter' } }, required: ['filter'], not: { required: ['ids'] } },
  ],
} as const;
const bulkResultSchema = { type: 'object', required: ['matched', 'processed', 'skipped', 'skippedCount', 'processedPreview'], properties: {
  matched: { type: 'integer' }, processed: { type: 'integer' }, skippedCount: { type: 'integer' },
  skipped: { type: 'array', maxItems: 20, items: { type: 'object', required: ['id', 'name', 'reason'], properties: {
    id: { type: 'string' }, name: { type: 'string' }, reason: { type: 'string', enum: ['HAS_ORDERS', 'NOT_FOUND'] },
  } } },
  processedPreview: { type: 'array', maxItems: 20, description: 'First processed product names for delete confirmation', items: {
    type: 'object', required: ['id', 'name'], properties: { id: { type: 'string' }, name: { type: 'string' } },
  } },
} } as const;

export const adminProductSchemas = {
  neighbors: {
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 1 } } },
    querystring: { type: 'object', additionalProperties: false, properties: { search: productFilterProperties.search, categoryId: productFilterProperties.categoryId, status: productFilterProperties.status, ...productSortProperties } },
    response: { ...createTypedReadResponses({ type: 'object', required: ['position', 'total', 'previousId', 'nextId'], properties: {
      position: { type: 'integer', nullable: true }, total: { type: 'integer' }, previousId: { type: 'string', nullable: true }, nextId: { type: 'string', nullable: true },
    } }), 400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema },
  },
  bulkProducts: {
    body: { type: 'object', additionalProperties: false, required: ['action', 'selection'], properties: {
      action: { type: 'string', enum: ['activate', 'deactivate', 'setCategory', 'delete'] },
      categoryId: { type: 'string', nullable: true }, selection: productSelectionSchema, dryRun: { type: 'boolean' },
    }, allOf: [{ if: { properties: { action: { const: 'setCategory' } } }, then: { required: ['categoryId'] } }] },
    response: { 200: createSuccessResponseSchema(bulkResultSchema), 400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema, 500: errorResponseSchema },
  },
  exportProducts: {
    body: { type: 'object', additionalProperties: false, required: ['selection'], properties: { selection: productSelectionSchema, ...productSortProperties } },
    response: { 200: { description: 'UTF-8 CSV with BOM', headers: {
      'Content-Disposition': { type: 'string' }, 'X-Product-Count': { type: 'integer', description: 'Matching products at export start' }, 'X-Product-Skipped': { type: 'integer' },
    }, content: { 'text/csv': { schema: { type: 'string' } } } },
      400: errorResponseSchema, 401: errorResponseSchema, 403: errorResponseSchema, 404: errorResponseSchema, 500: errorResponseSchema },
  },
  // GET /api/admin/products/ (paginated)
  listProducts: {
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1, minimum: 1, description: 'Page number' },
        limit: { type: 'integer', default: 20, minimum: 1, maximum: 100, description: 'Items per page' },
        search: { type: 'string', description: 'Search term' },
        categoryId: { type: 'string', description: 'Filter by category ID' },
        status: { type: 'string', enum: ['active', 'inactive', 'outOfStock'] },
        minPrice: { type: 'number', description: 'Minimum variant price filter' },
        maxPrice: { type: 'number', description: 'Maximum variant price filter' },
        inStock: { type: 'boolean', description: 'Filter by in-stock variants' },
        ...productSortProperties,
        productType: { type: 'string' },
      },
    },
    response: { ...createTypedReadResponses(createPageResultSchema(adminProductListItemSchema)), 400: errorResponseSchema },
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

  // POST /api/admin/products/
  createProduct: {
    body: {
      type: 'object',
      required: ['name', 'variants'],
      properties: {
        isActive: { type: 'boolean' },
        name: { type: 'string', description: 'Product name' },
        spuCode: { type: 'string', description: 'SPU code; blank generates a code' },
        description: { type: 'string', description: 'Product description' },
        categoryId: { type: 'string', nullable: true, description: 'Category ID' },
        requiresShipping: { type: 'boolean', description: 'Whether this product requires shipping address' },
        images: { type: 'array', items: { type: 'string' }, description: 'Image URLs' },
        translations: translationsSchema,
        variants: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['name', 'stock'],
            anyOf: [
              { required: ['salePrice'] },
              { required: ['basePrice'] },
            ],
            properties: {
              name: { type: 'string' },
              salePrice: { type: 'number', minimum: 0 },
              basePrice: { type: 'number', minimum: 0, description: 'Legacy alias of salePrice' },
              costPrice: { type: 'number', minimum: 0, nullable: true },
              stock: { type: 'integer' },
              skuCode: { type: 'string' },
              isActive: { type: 'boolean' },
              attributes: { type: 'object', additionalProperties: true },
            },
          },
          description: 'Product variants (at least 1 required)',
        },
      },
    },
    response: { ...createTypedCreateResponses(adminProductSchema), 409: errorResponseSchema },
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
      properties: {
        isActive: { type: 'boolean', description: 'Whether the product is active' },
        name: { type: 'string', description: 'Product name' },
        spuCode: { type: 'string', description: 'SPU code; blank generates a code' },
        description: { type: 'string', description: 'Product description' },
        categoryId: { type: 'string', nullable: true, description: 'Category ID' },
        requiresShipping: { type: 'boolean', description: 'Whether this product requires shipping address' },
        images: { type: 'array', items: { type: 'string' }, description: 'Image URLs' },
        translations: translationsSchema,
        variants: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['name', 'stock'],
            anyOf: [
              { required: ['salePrice'] },
              { required: ['basePrice'] },
            ],
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              salePrice: { type: 'number', minimum: 0 },
              basePrice: { type: 'number', minimum: 0, description: 'Legacy alias of salePrice' },
              costPrice: { type: 'number', minimum: 0, nullable: true },
              stock: { type: 'integer' },
              expectedStock: { type: 'integer', minimum: 0, description: 'Stock level the editor saw; the write is rejected when the stored level differs' },
              skuCode: { type: 'string' },
              isActive: { type: 'boolean' },
              attributes: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
    },
    response: { ...createTypedUpdateResponses(adminProductSchema), 409: errorResponseSchema },
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
    response: { ...createTypedDeleteResponses(deleteProductResultSchema), 409: errorResponseSchema },
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
  getCategory: {
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    response: createTypedReadResponses(categorySchema),
  },
  createCategory: {
    body: {
      type: 'object',
      required: ['name', 'slug'],
      properties: {
        name: { type: 'string', minLength: 1 },
        slug: { type: 'string', minLength: 1 },
        description: { type: 'string', nullable: true },
        translations: translationsSchema,
      },
    },
    response: createTypedCreateResponses(categorySchema),
  },
  updateCategory: {
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    body: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        slug: { type: 'string', minLength: 1 },
        description: { type: 'string', nullable: true },
        translations: translationsSchema,
      },
    },
    response: createTypedUpdateResponses(categorySchema),
  },
  deleteCategory: {
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    response: { ...createTypedDeleteResponses({
      type: 'object',
      properties: { categoryId: { type: 'string' }, deleted: { type: 'boolean' } },
      required: ['categoryId', 'deleted'],
    }), 409: errorResponseSchema },
  },
} as const;
