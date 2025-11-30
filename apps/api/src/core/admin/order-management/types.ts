import { z } from 'zod';
import { OrderStatusType } from '@/core/order/types';

// 更新订单状态请求
export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
});

// 批量操作请求
export const BatchOrderOperationSchema = z.object({
  action: z.enum(['updateStatus', 'delete']),
  orderIds: z.array(z.string()).min(1, 'At least one order ID is required'),
  status: z.enum(['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
});

// TypeScript 类型推断
export type UpdateOrderStatusRequest = z.infer<typeof UpdateOrderStatusSchema>;
export type BatchOrderOperationRequest = z.infer<typeof BatchOrderOperationSchema>;

// 管理员订单响应接口（包含更多详细信息）
export interface AdminOrderResponse {
  id: string;
  userId: string;
  status: OrderStatusType;
  totalAmount: number;
  customerEmail: string;
  shippingAddress: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  createdAt: Date;
  updatedAt: Date;
  items: AdminOrderItemResponse[];
  user: {
    id: string;
    username: string;
    email: string;
  };
}

// 管理员订单商品项响应接口
export interface AdminOrderItemResponse {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  product: {
    id: string;
    name: string;
    images: string | null;
    category: string;
  };
}

// 订单统计信息
export interface OrderStatsResponse {
  success: boolean;
  data: {
    totalOrders: number;
    totalRevenue: number;
    ordersByStatus: {
      [key in OrderStatusType]: number;
    };
    recentOrders: AdminOrderResponse[];
    topProducts: {
      productId: string;
      productName: string;
      totalQuantity: number;
      totalRevenue: number;
    }[];
  };
}

// 分页管理员订单列表响应
export interface AdminOrderListResponse {
  success: boolean;
  data: AdminOrderResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 单个管理员订单响应
export interface SingleAdminOrderResponse {
  success: boolean;
  data: AdminOrderResponse;
}

// 批量操作响应
export interface BatchOperationResponse {
  success: boolean;
  data: {
    action: string;
    processedCount: number;
    orderIds: string[];
    status?: OrderStatusType;
  };
  message: string;
}
