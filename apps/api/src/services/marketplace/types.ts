/**
 * Marketplace Service Types
 * 
 * Types for official Jiffoo marketplace integration
 */

export interface MarketplaceTheme {
  slug: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: 'general' | 'fashion' | 'electronics' | 'food' | 'beauty';
  price: number;
  currency: string;
  previewImage: string;
  screenshots: string[];
  demoUrl?: string;
  downloadUrl: string;
  rating: number;
  downloads: number;
  features: string[];
  requirements?: {
    minAppVersion?: string;
    requiredPlugins?: string[];
  };
}

export interface MarketplacePlugin {
  slug: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  price: number;
  currency: string;
  iconUrl: string;
  screenshots: string[];
  downloadUrl: string;
  rating: number;
  downloads: number;
  features: string[];
  configSchema?: Record<string, any>;
  requirements?: {
    minAppVersion?: string;
    requiredPlugins?: string[];
  };
  plans?: MarketplaceSubscriptionPlan[];
}

export interface MarketplaceSubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly' | 'one-time';
  features: string[];
}

export interface MarketplaceListQuery {
  category?: string;
  search?: string;
  priceType?: 'free' | 'paid' | 'all';
  sortBy?: 'popular' | 'newest' | 'rating';
  page?: number;
  limit?: number;
}

export interface MarketplaceListResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  featured?: T[];
}

export interface MarketplaceStatus {
  online: boolean;
  lastCheck: Date;
  version: string;
  message?: string;
}

export interface DownloadResult {
  success: boolean;
  zipPath?: string;
  error?: string;
}

