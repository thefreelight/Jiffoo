/**
 * Product DTO Types
 * Strictly aligned with actual backend response structure
 */

// Shop product list item DTO (lightweight)
export interface ShopProductListItemDTO {
  id: string;
  name: string;
  description?: string;
  images: string[];
  price: number;
  stock: number;
  variants?: ProductVariantDTO[];
  createdAt?: string;
  updatedAt?: string;
}

// Shop product detail DTO
export interface ShopProductDetailDTO {
  id: string;
  name: string;
  description?: string;
  images: string[];
  price: number;
  stock: number;
  variants: Array<{
    id: string;
    name: string;
    skuCode: string | null;
    salePrice: number;
    baseStock: number;
    isActive: boolean;
    attributes: Record<string, any>;
  }>;
}

// Admin product list item DTO (flattened)
export interface AdminProductListItemDTO {
  id: string;
  name: string;
  description?: string | null;
  categoryName?: string | null;
  categoryId?: string | null;
  skuCode?: string | null;
  price?: number;
  stock?: number;
  isActive?: boolean;
  variantsCount?: number; // Variant count, not returning full variants
  status?: string;
  isFeatured?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Admin product detail DTO
export interface AdminProductDetailDTO {
  id: string;
  name: string;
  description?: string | null;
  requiresShipping?: boolean;
  requiresShippingLocked?: boolean;
  categoryName?: string | null;
  categoryId?: string | null;
  skuCode?: string | null;
  price?: number;
  stock?: number;
  isActive?: boolean;
  images?: string[];
  variants?: ProductVariantDTO[];
  status?: string;
  isFeatured?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Product variant DTO
export interface ProductVariantDTO {
  id: string;
  name: string;
  skuCode: string | null;
  salePrice: number;
  baseStock: number;
  isActive: boolean;
  attributes: Record<string, any>;
}

// Product specification DTO
export interface ProductSpecificationDTO {
  name: string;
  value: string;
  group?: string;
}

// Product category DTO
export interface ProductCategoryDTO {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  parentId?: string;
  isActive: boolean;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}
