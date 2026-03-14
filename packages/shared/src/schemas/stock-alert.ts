import { z } from 'zod';

export const stockAlertTypeSchema = z.enum(['LOW_STOCK', 'OUT_OF_STOCK', 'RESTOCK_NEEDED']);

export const stockAlertStatusSchema = z.enum(['ACTIVE', 'RESOLVED', 'DISMISSED']);

export const stockAlertSchema = z.object({
  id: z.string().cuid(),
  warehouseId: z.string().cuid(),
  variantId: z.string().cuid(),
  alertType: stockAlertTypeSchema,
  threshold: z.number().int().min(0),
  quantity: z.number().int().min(0),
  status: stockAlertStatusSchema,
  resolvedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createStockAlertSchema = z.object({
  warehouseId: z.string().cuid('Invalid warehouse ID'),
  variantId: z.string().cuid('Invalid variant ID'),
  alertType: stockAlertTypeSchema.default('LOW_STOCK'),
  threshold: z.number()
    .int('Threshold must be a whole number')
    .min(0, 'Threshold must be non-negative')
    .max(1000000, 'Threshold must be less than 1,000,000'),
});

export const updateStockAlertSchema = z.object({
  alertType: stockAlertTypeSchema.optional(),
  threshold: z.number()
    .int('Threshold must be a whole number')
    .min(0, 'Threshold must be non-negative')
    .max(1000000, 'Threshold must be less than 1,000,000')
    .optional(),
  status: stockAlertStatusSchema.optional(),
});

export const resolveStockAlertSchema = z.object({
  alertId: z.string().cuid('Invalid alert ID'),
  status: z.enum(['RESOLVED', 'DISMISSED'], {
    errorMap: () => ({ message: 'Status must be either RESOLVED or DISMISSED' }),
  }),
});

export const bulkResolveStockAlertsSchema = z.object({
  alertIds: z.array(z.string().cuid('Invalid alert ID')).min(1, 'At least one alert ID is required'),
  status: z.enum(['RESOLVED', 'DISMISSED'], {
    errorMap: () => ({ message: 'Status must be either RESOLVED or DISMISSED' }),
  }),
});

export const stockAlertFiltersSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  warehouseId: z.string().cuid().optional(),
  variantId: z.string().cuid().optional(),
  productId: z.string().cuid().optional(),
  alertType: stockAlertTypeSchema.optional(),
  status: stockAlertStatusSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'threshold', 'quantity']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type StockAlertSchema = z.infer<typeof stockAlertSchema>;
export type CreateStockAlertFormData = z.infer<typeof createStockAlertSchema>;
export type UpdateStockAlertFormData = z.infer<typeof updateStockAlertSchema>;
export type ResolveStockAlertFormData = z.infer<typeof resolveStockAlertSchema>;
export type BulkResolveStockAlertsFormData = z.infer<typeof bulkResolveStockAlertsSchema>;
export type StockAlertFiltersFormData = z.infer<typeof stockAlertFiltersSchema>;
