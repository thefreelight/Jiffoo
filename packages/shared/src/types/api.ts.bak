// API Response Types
export interface ApiResponse<T = any> {
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
  details?: any;
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

// API Endpoints
export interface ApiEndpoints {
  // Auth
  login: '/api/auth/login';
  register: '/api/auth/register';
  logout: '/api/auth/logout';
  refresh: '/api/auth/refresh';
  profile: '/api/auth/profile';
  
  // Products
  products: '/api/products';
  productById: '/api/products/:id';
  productSearch: '/api/products/search';
  
  // Cart
  cart: '/api/cart';
  cartAdd: '/api/cart/add';
  cartUpdate: '/api/cart/update';
  cartRemove: '/api/cart/remove';
  cartClear: '/api/cart/clear';
  
  // Orders
  orders: '/api/orders';
  orderById: '/api/orders/:id';
  orderCreate: '/api/orders';
  orderUpdate: '/api/orders/:id';
  
  // Users
  users: '/api/users';
  userById: '/api/users/:id';
  
  // Admin
  adminStats: '/api/admin/stats';
  adminUsers: '/api/admin/users';
  adminOrders: '/api/admin/orders';
  adminProducts: '/api/admin/products';
}
