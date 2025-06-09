export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  sku: string;
  category: ProductCategory;
  tags: string[];
  images: ProductImage[];
  variants: ProductVariant[];
  inventory: ProductInventory;
  specifications: ProductSpecification[];
  isActive: boolean;
  isFeatured: boolean;
  rating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string;
  level: number;
  isActive: boolean;
  productCount: number;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  order: number;
  isMain: boolean;
}

export interface ProductVariant {
  id: string;
  name: string;
  value: string;
  type: 'COLOR' | 'SIZE' | 'MATERIAL' | 'STYLE';
  price?: number;
  sku?: string;
  inventory?: number;
  image?: string;
}

export interface ProductInventory {
  quantity: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  isInStock: boolean;
  isLowStock: boolean;
  trackInventory: boolean;
}

export interface ProductSpecification {
  name: string;
  value: string;
  group?: string;
}

export interface ProductReview {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  content: string;
  images: string[];
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductSearchFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  inStock?: boolean;
  tags?: string[];
  sortBy?: 'price' | 'rating' | 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ProductStats {
  totalProducts: number;
  activeProducts: number;
  outOfStockProducts: number;
  lowStockProducts: number;
  featuredProducts: number;
  averagePrice: number;
  topCategories: Array<{
    category: string;
    count: number;
  }>;
  topSellingProducts: Array<{
    id: string;
    name: string;
    salesCount: number;
  }>;
}
