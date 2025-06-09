import { z } from 'zod';

export const productVariantSchema = z.object({
  name: z.string().min(1, 'Variant name is required'),
  value: z.string().min(1, 'Variant value is required'),
  type: z.enum(['COLOR', 'SIZE', 'MATERIAL', 'STYLE']),
  price: z.number().min(0).optional(),
  sku: z.string().optional(),
  inventory: z.number().min(0).optional(),
  image: z.string().url().optional(),
});

export const productSpecificationSchema = z.object({
  name: z.string().min(1, 'Specification name is required'),
  value: z.string().min(1, 'Specification value is required'),
  group: z.string().optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.number().min(0.01, 'Price must be greater than 0'),
  originalPrice: z.number().min(0).optional(),
  sku: z.string().min(1, 'SKU is required'),
  categoryId: z.string().min(1, 'Category is required'),
  tags: z.array(z.string()).default([]),
  variants: z.array(productVariantSchema).default([]),
  specifications: z.array(productSpecificationSchema).default([]),
  inventory: z.object({
    quantity: z.number().min(0, 'Quantity must be 0 or greater'),
    lowStockThreshold: z.number().min(0, 'Low stock threshold must be 0 or greater'),
    trackInventory: z.boolean().default(true),
  }),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

export const updateProductSchema = createProductSchema.partial();

export const productSearchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  rating: z.number().min(1).max(5).optional(),
  inStock: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  sortBy: z.enum(['price', 'rating', 'name', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

export const productReviewSchema = z.object({
  rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  title: z.string().min(1, 'Review title is required'),
  content: z.string().min(10, 'Review content must be at least 10 characters'),
  images: z.array(z.string().url()).default([]),
});

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  slug: z.string().min(1, 'Category slug is required'),
  description: z.string().optional(),
  image: z.string().url().optional(),
  parentId: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type CreateProductFormData = z.infer<typeof createProductSchema>;
export type UpdateProductFormData = z.infer<typeof updateProductSchema>;
export type ProductSearchParams = z.infer<typeof productSearchSchema>;
export type ProductReviewFormData = z.infer<typeof productReviewSchema>;
export type CategoryFormData = z.infer<typeof categorySchema>;
