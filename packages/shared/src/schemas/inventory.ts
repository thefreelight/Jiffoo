import { z } from 'zod';

export const inventoryAdjustmentTypeSchema = z.enum([
  'manual', 'damage', 'return', 'recount', 'initial', 'correction',
]);

export const inventoryAdjustmentSchema = z.object({
  id: z.string().cuid(),
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

export const createInventoryAdjustmentSchema = inventoryAdjustmentSchema.omit({ id: true, createdAt: true });

export type InventoryAdjustmentSchema = z.infer<typeof inventoryAdjustmentSchema>;
export type CreateInventoryAdjustmentFormData = z.infer<typeof createInventoryAdjustmentSchema>;
