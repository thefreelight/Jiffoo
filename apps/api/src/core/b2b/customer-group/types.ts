import { z } from 'zod';

// Create customer group schema
export const CreateCustomerGroupSchema = z.object({
  name: z.string().min(1, 'Customer group name is required'),
  description: z.string().optional(),
  discount: z.number().min(0).max(100).optional().default(0), // Percentage discount (0-100)
  priority: z.number().int().min(0).optional().default(0), // Higher priority = evaluated first
  isActive: z.boolean().optional().default(true),
});

// Update customer group schema (all fields optional)
export const UpdateCustomerGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  discount: z.number().min(0).max(100).optional(),
  priority: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// Update customer group status schema (for admin actions)
export const UpdateCustomerGroupStatusSchema = z.object({
  isActive: z.boolean(),
});

// Type exports
export type CreateCustomerGroupRequest = z.infer<typeof CreateCustomerGroupSchema>;
export type UpdateCustomerGroupRequest = z.infer<typeof UpdateCustomerGroupSchema>;
export type UpdateCustomerGroupStatusRequest = z.infer<typeof UpdateCustomerGroupStatusSchema>;

// Response type
export interface CustomerGroupResponse {
  id: string;
  name: string;
  description?: string;
  discount: number;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Response type with company count
export interface CustomerGroupWithCountResponse extends CustomerGroupResponse {
  _count: {
    companies: number;
    priceRules: number;
  };
}
