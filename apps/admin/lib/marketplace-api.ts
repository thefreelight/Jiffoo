/**
 * Marketplace API Client
 * 
 * API client for unified marketplace endpoints in Platform API.
 */

import { apiClient } from './api';
import type { ApiResponse } from 'shared';

// ============================================
// Type Definitions
// ============================================

export type MarketplaceItemType = 'PLUGIN' | 'THEME' | 'PRODUCT';
export type PricingType = 'free' | 'paid' | 'freemium';

export interface MarketplaceItem {
  id: string;
  type: MarketplaceItemType;
  slug: string;
  name: string;
  description: string;
  shortDescription?: string;
  icon?: string;
  screenshots: string[];
  pricing: {
    type: PricingType;
    price?: number;
    currency?: string;
  };
  rating: number;
  reviewCount: number;
  downloadCount: number;
  featured: boolean;
  trending: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PluginItem extends MarketplaceItem {
  type: 'PLUGIN';
  category?: string;
  developer: DeveloperInfo;
  latestVersion: string;
  compatibility: string[];
}

export interface ThemeItem extends MarketplaceItem {
  type: 'THEME';
  style?: string;
  industries: string[];
  previewUrl?: string;
  developer: DeveloperInfo;
}

export interface ProductItem extends MarketplaceItem {
  type: 'PRODUCT';
  category: string;
  highlights: string[];
}

export interface DeveloperInfo {
  id: string;
  name: string;
  avatar?: string;
  verified: boolean;
  itemCount: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface MarketplaceHomepage {
  featured: MarketplaceItem[];
  trending: MarketplaceItem[];
  newArrivals: MarketplaceItem[];
  categories: { type: string; count: number }[];
}

export interface SearchResult {
  plugins: MarketplaceItem[];
  themes: MarketplaceItem[];
  products: MarketplaceItem[];
  total: number;
}

export interface PluginListResponse {
  plugins: PluginItem[];
  pagination: Pagination;
  filters: {
    categories: string[];
    pricingTypes: string[];
  };
}

export interface ThemeListResponse {
  themes: ThemeItem[];
  pagination: Pagination;
  filters: {
    styles: string[];
    industries: string[];
    pricingTypes: string[];
  };
}

export interface ProductListResponse {
  products: ProductItem[];
  pagination: Pagination;
  filters: {
    categories: string[];
  };
}

// ============================================
// Marketplace API
// ============================================

export const marketplaceApi = {
  // Homepage
  getHomepage: (): Promise<ApiResponse<MarketplaceHomepage>> =>
    apiClient.get('/marketplace'),

  // Unified Search
  search: (params: {
    q: string;
    category?: 'plugin' | 'theme' | 'product';
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<SearchResult>> =>
    apiClient.get('/marketplace/search', { params }),

  // ============================================
  // Plugins
  // ============================================
  plugins: {
    list: (params?: {
      category?: string;
      pricing?: 'free' | 'paid' | 'freemium';
      search?: string;
      sort?: 'popular' | 'newest' | 'rating';
      page?: number;
      limit?: number;
    }): Promise<ApiResponse<PluginListResponse>> =>
      apiClient.get('/marketplace/plugins', { params }),

    getBySlug: (slug: string): Promise<ApiResponse<PluginItem>> =>
      apiClient.get(`/marketplace/plugins/${slug}`),

    install: (slug: string): Promise<ApiResponse<{ success: boolean; installationId: string }>> =>
      apiClient.post(`/marketplace/plugins/${slug}/install`),

    download: (slug: string): Promise<ApiResponse<{ downloadUrl: string; expiresAt: string }>> =>
      apiClient.get(`/marketplace/plugins/${slug}/download`),
  },

  // ============================================
  // Themes
  // ============================================
  themes: {
    list: (params?: {
      style?: string;
      industry?: string;
      pricing?: 'free' | 'paid' | 'freemium';
      search?: string;
      sort?: 'popular' | 'newest' | 'rating';
      page?: number;
      limit?: number;
    }): Promise<ApiResponse<ThemeListResponse>> =>
      apiClient.get('/marketplace/themes', { params }),

    getBySlug: (slug: string): Promise<ApiResponse<ThemeItem>> =>
      apiClient.get(`/marketplace/themes/${slug}`),

    install: (slug: string): Promise<ApiResponse<{ success: boolean; installationId: string }>> =>
      apiClient.post(`/marketplace/themes/${slug}/install`),

    download: (slug: string): Promise<ApiResponse<{ downloadUrl: string; expiresAt: string }>> =>
      apiClient.get(`/marketplace/themes/${slug}/download`),

    preview: (slug: string): Promise<ApiResponse<{ previewUrl: string; expiresAt: string }>> =>
      apiClient.get(`/marketplace/themes/${slug}/preview`),
  },

  // ============================================
  // Official Products
  // ============================================
  products: {
    list: (params?: {
      category?: string;
      page?: number;
      limit?: number;
    }): Promise<ApiResponse<ProductListResponse>> =>
      apiClient.get('/marketplace/products', { params }),

    getBySlug: (slug: string): Promise<ApiResponse<ProductItem>> =>
      apiClient.get(`/marketplace/products/${slug}`),

    purchase: (slug: string, data: {
      planId?: string;
      paymentMethod: string;
    }): Promise<ApiResponse<{ orderId: string; checkoutUrl?: string }>> =>
      apiClient.post(`/marketplace/products/${slug}/purchase`, data),

    activate: (slug: string, data: {
      licenseKey: string;
      domain?: string;
    }): Promise<ApiResponse<{ success: boolean; expiresAt: string }>> =>
      apiClient.post(`/marketplace/products/${slug}/activate`, data),

    verifyLicense: (slug: string, params: {
      licenseKey: string;
      domain?: string;
    }): Promise<ApiResponse<{ valid: boolean; expiresAt?: string; features?: string[] }>> =>
      apiClient.get(`/marketplace/products/${slug}/license/verify`, { params }),
  },
};

export default marketplaceApi;
