import { z } from 'zod';

// 订单商品项
export const OrderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(), // 🆕 商品变体ID（可选）
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
  shippingAddress: ShippingAddressSchema,
  customerEmail: z.string().email('Valid email is required'),
  agentId: z.string().optional(), // 代理ID（可选，用于三级代理分润）
});

// 订单状态枚举
export const OrderStatus = {
  PENDING: 'PENDING',     // 待支付
  PAID: 'PAID',          // 已支付
  SHIPPED: 'SHIPPED',    // 已发货
  DELIVERED: 'DELIVERED', // 已送达
  CANCELLED: 'CANCELLED'  // 已取消
} as const;

export type OrderStatusType = typeof OrderStatus[keyof typeof OrderStatus];

// 🆕 支付状态枚举
export const PaymentStatus = {
  UNPAID: 'UNPAID',       // 未支付
  PAID: 'PAID',           // 已支付
  FAILED: 'FAILED',       // 支付失败
  REFUNDED: 'REFUNDED'    // 已退款
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
  paymentStatus: PaymentStatusType;  // 🆕 新增字段
  expiresAt: Date | null;            // 🆕 新增字段
  paymentAttempts: number;           // 🆕 新增字段
  lastPaymentAttemptAt: Date | null; // 🆕 新增字段
  totalAmount: number;
  customerEmail: string;
  shippingAddress: ShippingAddressRequest;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItemResponse[];
}

// 订单商品项响应接口
export interface OrderItemResponse {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  product: {
    id: string;
    name: string;
    images: string | null;
  };
}

// 分页订单列表响应
export interface OrderListResponse {
  success: boolean;
  data: OrderResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 单个订单响应
export interface SingleOrderResponse {
  success: boolean;
  data: OrderResponse;
}
