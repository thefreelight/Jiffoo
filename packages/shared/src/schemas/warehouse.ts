import { z } from 'zod';

export const warehouseSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  code: z.string(),
  address: z.string().optional(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const warehouseInventorySchema = z.object({
  id: z.string().cuid(),
  warehouseId: z.string().cuid(),
  variantId: z.string().cuid(),
  quantity: z.number().int().min(0),
  reserved: z.number().int().min(0),
  available: z.number().int().min(0),
  lowStock: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createWarehouseSchema = z.object({
  name: z.string().min(1, 'Warehouse name is required').max(100, 'Warehouse name must be less than 100 characters'),
  code: z.string()
    .min(2, 'Warehouse code must be at least 2 characters')
    .max(20, 'Warehouse code must be less than 20 characters')
    .regex(/^[A-Z0-9_-]+$/, 'Warehouse code must contain only uppercase letters, numbers, hyphens, and underscores'),
  address: z.string().max(500, 'Address must be less than 500 characters').optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export const updateWarehouseSchema = z.object({
  name: z.string().min(1, 'Warehouse name is required').max(100, 'Warehouse name must be less than 100 characters').optional(),
  code: z.string()
    .min(2, 'Warehouse code must be at least 2 characters')
    .max(20, 'Warehouse code must be less than 20 characters')
    .regex(/^[A-Z0-9_-]+$/, 'Warehouse code must contain only uppercase letters, numbers, hyphens, and underscores')
    .optional(),
  address: z.string().max(500, 'Address must be less than 500 characters').optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const setDefaultWarehouseSchema = z.object({
  warehouseId: z.string().cuid('Invalid warehouse ID'),
});

export const warehouseFiltersSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  sortBy: z.enum(['name', 'code', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const warehouseInventoryFiltersSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  warehouseId: z.string().cuid().optional(),
  variantId: z.string().cuid().optional(),
  productId: z.string().cuid().optional(),
  lowStock: z.boolean().optional(),
  outOfStock: z.boolean().optional(),
  sortBy: z.enum(['quantity', 'available', 'reserved', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const bulkInventoryUpdateSchema = z.object({
  warehouseId: z.string().cuid('Invalid warehouse ID'),
  variantId: z.string().cuid('Invalid variant ID'),
  quantity: z.number().int().min(0, 'Quantity must be non-negative'),
  lowStock: z.number().int().min(0, 'Low stock threshold must be non-negative').optional(),
});

export const importInventorySchema = z.array(bulkInventoryUpdateSchema);

export type WarehouseSchema = z.infer<typeof warehouseSchema>;
export type WarehouseInventorySchema = z.infer<typeof warehouseInventorySchema>;
export type CreateWarehouseFormData = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseFormData = z.infer<typeof updateWarehouseSchema>;
export type SetDefaultWarehouseFormData = z.infer<typeof setDefaultWarehouseSchema>;
export type WarehouseFiltersFormData = z.infer<typeof warehouseFiltersSchema>;
export type WarehouseInventoryFiltersFormData = z.infer<typeof warehouseInventoryFiltersSchema>;
export type BulkInventoryUpdateFormData = z.infer<typeof bulkInventoryUpdateSchema>;
