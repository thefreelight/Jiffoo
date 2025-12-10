import { z } from 'zod';

// 订单商品项
export const OrderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
});

// 收货地址
export const ShippingAddressSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
});

// 创建订单请求
export const CreateOrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1, 'Order must have at least one item'),
  shippingAddress: ShippingAddressSchema.optional(),
  customerEmail: z.string().email('Valid email is required').optional(),
});

// 订单状态枚举
export const OrderStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED'
} as const;

export type OrderStatusType = typeof OrderStatus[keyof typeof OrderStatus];

// 支付状态枚举
export const PaymentStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED'
} as const;

export type PaymentStatusType = typeof PaymentStatus[keyof typeof PaymentStatus];

// TypeScript 类型推断
export type OrderItemRequest = z.infer<typeof OrderItemSchema>;
export type ShippingAddressRequest = z.infer<typeof ShippingAddressSchema>;
export type CreateOrderRequest = z.infer<typeof CreateOrderSchema>;

// 订单响应接口
export interface OrderResponse {
  id: string;
  userId: string;
  status: OrderStatusType;
  paymentStatus: string;
  totalAmount: number;
  shippingAddress: any;
  items: OrderItemResponse[];
  createdAt: Date;
  updatedAt: Date;
}

// 订单商品项响应接口
export interface OrderItemResponse {
  id: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

// 分页订单列表响应
export interface OrderListResponse {
  data: OrderResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
