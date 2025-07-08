

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  images: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductSearchFilters {
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: 'name' | 'price' | 'createdAt' | 'stock';
  sortOrder?: 'asc' | 'desc';
}

export interface ProductListResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: ProductSearchFilters;
}

export class ProductService {
  private static readonly BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  
  private static async makeRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.BASE_URL}/api/products${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API Request failed: ${url}`, error);
      throw error;
    }
  }

  /**
   * 获取商品列表
   */
  static async getProducts(
    page = 1,
    limit = 12,
    filters: ProductSearchFilters = {}
  ): Promise<ProductListResponse> {
    const searchParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    // 添加筛选参数
    if (filters.search) searchParams.append('search', filters.search);
    if (filters.minPrice !== undefined) searchParams.append('minPrice', filters.minPrice.toString());
    if (filters.maxPrice !== undefined) searchParams.append('maxPrice', filters.maxPrice.toString());
    if (filters.inStock !== undefined) searchParams.append('inStock', filters.inStock.toString());
    if (filters.sortBy) searchParams.append('sortBy', filters.sortBy);
    if (filters.sortOrder) searchParams.append('sortOrder', filters.sortOrder);

    return this.makeRequest<ProductListResponse>(`/?${searchParams.toString()}`);
  }

  /**
   * 根据ID获取单个商品
   */
  static async getProductById(id: string): Promise<{ product: Product }> {
    return this.makeRequest<{ product: Product }>(`/${id}`);
  }

  /**
   * 获取搜索建议
   */
  static async getSearchSuggestions(query: string, limit = 5): Promise<{ suggestions: string[] }> {
    const searchParams = new URLSearchParams({
      q: query,
      limit: limit.toString(),
    });

    return this.makeRequest<{ suggestions: string[] }>(`/search/suggestions?${searchParams.toString()}`);
  }

  /**
   * 获取商品分类
   */
  static async getCategories(): Promise<{ categories: string[] }> {
    return this.makeRequest<{ categories: string[] }>('/categories');
  }

  /**
   * 获取价格范围
   */
  static async getPriceRanges(): Promise<{ minPrice: number; maxPrice: number; ranges: Array<{ label: string; min: number; max: number; count: number }> }> {
    return this.makeRequest('/price-ranges');
  }

  /**
   * 获取热门搜索词
   */
  static async getPopularSearchTerms(limit = 10): Promise<{ popularTerms: string[] }> {
    const searchParams = new URLSearchParams({
      limit: limit.toString(),
    });

    return this.makeRequest<{ popularTerms: string[] }>(`/search/popular?${searchParams.toString()}`);
  }
} 