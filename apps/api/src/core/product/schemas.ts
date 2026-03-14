/**
 * Product Module OpenAPI Schemas
 *
 * Detailed schema definitions for all product endpoints
 */

import {
  createTypedCrudResponses,
  createTypedReadResponses,
  createPageResultSchema,
} from '@/types/common-dto';

// ============================================================================
// Product List Item Schema (for paginated lists)
// ============================================================================

const productVariantSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    skuCode: { type: 'string', nullable: true },
    salePrice: { type: 'number' },
    baseStock: { type: 'number' },
    isActive: { type: 'boolean' },
    attributes: { type: 'object', additionalProperties: true },
  },
  required: ['id', 'name', 'salePrice', 'baseStock', 'isActive'],
} as const;

const productListItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Product ID' },
    name: { type: 'string', description: 'Product name' },
    description: { type: 'string', nullable: true, description: 'Product description' },
    typeData: { type: 'object', additionalProperties: true, description: 'Type-specific product data' },
    price: { type: 'number', description: 'Product price' },
    images: {
      type: 'array',
      items: { type: 'string' },
      description: 'Product image URLs',
    },
    stock: { type: 'number', description: 'Available stock quantity' },
    createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
    updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' },
  },
  required: ['id', 'name', 'typeData', 'price', 'stock', 'createdAt', 'updatedAt'],
} as const;

// ============================================================================
// Product Detail Schema (for single product)
// ============================================================================

const productDetailSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Product ID' },
    name: { type: 'string', description: 'Product name' },
    description: { type: 'string', nullable: true, description: 'Product description' },
    typeData: { type: 'object', additionalProperties: true, description: 'Type-specific product data' },
    price: { type: 'number', description: 'Product price' },
    images: {
      type: 'array',
      items: { type: 'string' },
      description: 'Product image URLs',
    },
    stock: { type: 'number', description: 'Available stock quantity' },
    requiresShipping: { type: 'boolean', description: 'Whether the product requires shipping (SPU-level)' },
    variants: {
      type: 'array',
      items: productVariantSchema,
      description: 'Active variants for this product',
    },
    createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
    updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' },
  },
  required: ['id', 'name', 'typeData', 'price', 'stock', 'requiresShipping', 'variants'],
} as const;

// ============================================================================
// Category Schema
// ============================================================================

const categorySchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Category ID' },
    name: { type: 'string', description: 'Category name' },
    slug: { type: 'string', description: 'URL-friendly category slug' },
    productCount: { type: 'number', description: 'Number of products in this category' },
  },
  required: ['id', 'name', 'slug'],
} as const;

// Minimal schema returned by GET /api/products/search
const productSearchItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Product ID' },
    name: { type: 'string', description: 'Product name' },
    description: { type: 'string', nullable: true, description: 'Product description' },
    typeData: { type: 'object', additionalProperties: true, description: 'Type-specific product data' },
    images: { type: 'array', items: { type: 'string' }, description: 'Product image URLs' },
    price: { type: 'number', description: 'Product price' },
    stock: { type: 'number', description: 'Available stock quantity' },
    variants: { type: 'array', items: productVariantSchema, description: 'Active variants' },
  },
  required: ['id', 'name', 'typeData', 'price', 'stock', 'images', 'variants'],
} as const;

// ============================================================================
// Endpoint Schemas
// ============================================================================

export const productSchemas = {
  // GET /api/products/ (paginated)
  listProducts: {
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1, minimum: 1, description: 'Page number' },
        limit: { type: 'integer', default: 10, minimum: 1, maximum: 100, description: 'Items per page' },
        search: { type: 'string', description: 'Search term for product name/description' },
        category: { type: 'string', description: 'Filter by category ID' },
        minPrice: { type: 'number', description: 'Minimum price filter' },
        maxPrice: { type: 'number', description: 'Maximum price filter' },
        inStock: { type: 'boolean', description: 'Filter for in-stock products only' },
        sortBy: { type: 'string', enum: ['price', 'name', 'createdAt', 'stock'], description: 'Sort field' },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order' },
        locale: { type: 'string', default: 'en', description: 'Language locale for translated content' },
      },
    },
    response: createTypedCrudResponses(createPageResultSchema(productListItemSchema)),
  },

  // GET /api/products/:id
  getProduct: {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Product ID' },
      },
    },
    querystring: {
      type: 'object',
      properties: {
        locale: { type: 'string', default: 'en', description: 'Language locale for translated content' },
      },
    },
    response: createTypedReadResponses(productDetailSchema),
  },

  // GET /api/products/categories
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

  // GET /api/products/search
  searchProducts: {
    querystring: {
      type: 'object',
      required: ['q'],
      properties: {
        q: { type: 'string', minLength: 1, description: 'Search query string' },
        page: { type: 'integer', default: 1, minimum: 1, description: 'Page number' },
        limit: { type: 'integer', default: 10, minimum: 1, maximum: 100, description: 'Items per page' },
        locale: { type: 'string', default: 'en', description: 'Language locale for translated content' },
      },
    },
    response: createTypedCrudResponses(createPageResultSchema(productSearchItemSchema)),
  },
} as const;
