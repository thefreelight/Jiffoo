// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

// Query Parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchParams {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

// API Endpoints - 移除/api前缀，由baseURL提供
export interface ApiEndpoints {
  // Auth
  login: '/auth/login';
  register: '/auth/register';
  logout: '/auth/logout';
  refresh: '/auth/refresh';
  profile: '/auth/profile';

  // Products
  products: '/products';
  productById: '/products/:id';
  productSearch: '/products/search';

  // Cart
  cart: '/cart';
  cartAdd: '/cart/add';
  cartUpdate: '/cart/update';
  cartRemove: '/cart/remove';
  cartClear: '/cart/clear';

  // Orders
  orders: '/orders';
  orderById: '/orders/:id';
  orderCreate: '/orders';
  orderUpdate: '/orders/:id';

  // Users
  users: '/users';
  userById: '/users/:id';
  
  // Admin
  adminStats: '/api/admin/stats';
  adminUsers: '/api/admin/users';
  adminOrders: '/api/admin/orders';
  adminProducts: '/api/admin/products';
}
