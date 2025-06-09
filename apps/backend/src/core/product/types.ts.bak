import { z } from 'zod';

export const CreateProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive'),
  stock: z.number().int().min(0, 'Stock cannot be negative').default(0),
  images: z.string().default(""),
});

export const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  images: z.string().optional(),
});

export type CreateProductRequest = z.infer<typeof CreateProductSchema>;
export type UpdateProductRequest = z.infer<typeof UpdateProductSchema>;

export interface ProductResponse {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  images: string;
  createdAt: Date;
  updatedAt: Date;
}
