import { z } from 'zod';

export const OrderItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive('Quantity must be positive'),
});

export const CreateOrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1, 'Order must have at least one item'),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'CANCELLED', 'SHIPPED', 'DELIVERED']),
});

export type OrderItemRequest = z.infer<typeof OrderItemSchema>;
export type CreateOrderRequest = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatusRequest = z.infer<typeof UpdateOrderStatusSchema>;

export interface OrderResponse {
  id: string;
  userId: string;
  status: string;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
  items: {
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    product: {
      id: string;
      name: string;
      images: string;
    };
  }[];
  user?: {
    id: string;
    username: string;
    email: string;
  };
}
