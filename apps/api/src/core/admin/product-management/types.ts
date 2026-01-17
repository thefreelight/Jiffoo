/**
 * Admin Product Types
 */

export interface ProductCreateInput {
  name: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  sku?: string;
  category?: string;
  images?: string[];
  stock?: number;
  isActive?: boolean;
}

export interface ProductUpdateInput {
  name?: string;
  description?: string;
  price?: number;
  compareAtPrice?: number;
  sku?: string;
  category?: string;
  images?: string[];
  stock?: number;
  isActive?: boolean;
}

export interface ProductFilters {
  search?: string;
  category?: string;
  isActive?: boolean;
  minPrice?: number;
  maxPrice?: number;
}
