import { z } from 'zod';

export const inventoryAdjustmentTypeSchema = z.enum([
  'manual',
  'damage',
  'return',
  'recount',
  'initial',
  'correction',
]);

export const inventoryTransferStatusSchema = z.enum([
  'PENDING',
  'IN_TRANSIT',
  'COMPLETED',
  'CANCELLED',
]);

export const inventoryAdjustmentSchema = z.object({
  id: z.string().cuid(),
  warehouseId: z.string().cuid(),
  variantId: z.string().cuid(),
  type: inventoryAdjustmentTypeSchema,
  quantity: z.number().int(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  userId: z.string().cuid().optional(),
  referenceId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string(),
});

export const inventoryTransferSchema = z.object({
  id: z.string().cuid(),
  fromWarehouseId: z.string().cuid(),
  toWarehouseId: z.string().cuid(),
  variantId: z.string().cuid(),
  quantity: z.number().int().min(1),
  status: inventoryTransferStatusSchema,
  reason: z.string().optional(),
  notes: z.string().optional(),
  userId: z.string().cuid().optional(),
  referenceId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  completedAt: z.string().optional(),
  cancelledAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createInventoryAdjustmentSchema = z.object({
  warehouseId: z.string().cuid('Invalid warehouse ID'),
  variantId: z.string().cuid('Invalid variant ID'),
  type: inventoryAdjustmentTypeSchema,
  quantity: z.number().int().refine(
    (val) => val !== 0,
    { message: 'Quantity cannot be zero' }
  ),
  reason: z.string().max(500, 'Reason must be less than 500 characters').optional(),
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
  userId: z.string().cuid().optional(),
  referenceId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createInventoryTransferSchema = z.object({
  fromWarehouseId: z.string().cuid('Invalid source warehouse ID'),
  toWarehouseId: z.string().cuid('Invalid destination warehouse ID'),
  variantId: z.string().cuid('Invalid variant ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  reason: z.string().max(500, 'Reason must be less than 500 characters').optional(),
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
  userId: z.string().cuid().optional(),
  referenceId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine(
  (data) => data.fromWarehouseId !== data.toWarehouseId,
  {
    message: 'Source and destination warehouses must be different',
    path: ['toWarehouseId'],
  }
);

export const updateInventoryTransferSchema = z.object({
  status: inventoryTransferStatusSchema,
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
});

export const approveInventoryTransferSchema = z.object({
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
});

export const cancelInventoryTransferSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required').max(500, 'Reason must be less than 500 characters'),
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
});

export const inventoryAdjustmentFiltersSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  warehouseId: z.string().cuid().optional(),
  variantId: z.string().cuid().optional(),
  productId: z.string().cuid().optional(),
  type: inventoryAdjustmentTypeSchema.optional(),
  userId: z.string().cuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(['createdAt', 'quantity', 'type']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const inventoryTransferFiltersSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  fromWarehouseId: z.string().cuid().optional(),
  toWarehouseId: z.string().cuid().optional(),
  variantId: z.string().cuid().optional(),
  productId: z.string().cuid().optional(),
  status: inventoryTransferStatusSchema.optional(),
  userId: z.string().cuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(['createdAt', 'quantity', 'status', 'completedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type InventoryAdjustmentSchema = z.infer<typeof inventoryAdjustmentSchema>;
export type InventoryTransferSchema = z.infer<typeof inventoryTransferSchema>;
export type CreateInventoryAdjustmentFormData = z.infer<typeof createInventoryAdjustmentSchema>;
export type CreateInventoryTransferFormData = z.infer<typeof createInventoryTransferSchema>;
export type UpdateInventoryTransferFormData = z.infer<typeof updateInventoryTransferSchema>;
export type ApproveInventoryTransferFormData = z.infer<typeof approveInventoryTransferSchema>;
export type CancelInventoryTransferFormData = z.infer<typeof cancelInventoryTransferSchema>;
export type InventoryAdjustmentFiltersFormData = z.infer<typeof inventoryAdjustmentFiltersSchema>;
export type InventoryTransferFiltersFormData = z.infer<typeof inventoryTransferFiltersSchema>;
