import { OrderStatusType } from '@/core/order/types';

// Admin order response interface (includes more details)
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

// Admin order item response interface
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

// Order statistics
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

// Paginated admin order list response
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

// Single admin order response
export interface SingleAdminOrderResponse {
  success: boolean;
  data: AdminOrderResponse;
}

// Batch operation response
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
