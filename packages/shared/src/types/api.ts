export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface ListResult<T> {
  items: T[];
  total: number;
}

export interface PageResult<T> extends ListResult<T> {
  page: number;
  limit: number;
  totalPages: number;
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

// API Endpoints - Remove /api prefix, provided by baseURL
export interface ApiEndpoints {
  // Auth
  login: '/auth/login';
  register: '/auth/register';
  logout: '/auth/logout';
  refresh: '/auth/refresh';
  profile: '/auth/me';

  // Products
  products: '/products';
  productById: '/products/:id';
  productSearch: '/products/search';

  // Cart
  cart: '/cart';
  cartAdd: '/cart/items';
  cartUpdate: '/cart/items/:id';
  cartRemove: '/cart/items/:id';
  cartClear: '/cart';

  // Orders
  orders: '/orders';
  orderById: '/orders/:id';
  orderCreate: '/orders';
  orderUpdate: '/orders/:id';

  // Users
  users: '/users';
  userById: '/users/:id';

  // Admin - baseURL already contains /api, so no /api prefix needed
  adminStats: '/admin/stats';
  adminUsers: '/admin/users';
  adminOrders: '/admin/orders';
  adminProducts: '/admin/products';
}
