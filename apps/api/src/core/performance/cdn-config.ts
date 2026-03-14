/**
 * CDN Configuration Service
 *
 * Manages CDN settings for image optimization and asset delivery.
 * Provides configuration for CloudFront, Cloudflare, or custom CDN providers.
 */

import { env } from '../../config/env';
import { unifiedLogger } from '../logger/unified-logger';

export interface CDNSettings {
  enabled: boolean;
  url?: string;
  distributionId?: string;
  region: string;
  bucket?: string;
  cacheControlMaxAge: number;
  imageFormats: string[];
  imageQuality: number;
}

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  format?: string;
  quality?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface CDNUploadOptions {
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

/**
 * CDN Configuration Service
 *
 * Provides centralized configuration management for CDN integration
 */
export class CDNConfig {
  private static settings: CDNSettings | null = null;
  private static initialized: boolean = false;

  /**
   * Initialize CDN configuration from environment variables
   */
  static initialize(): void {
    if (this.initialized) {
      unifiedLogger.warn('CDN configuration already initialized');
      return;
    }

    this.settings = {
      enabled: env.CDN_ENABLED,
      url: env.CDN_URL,
      distributionId: env.CDN_DISTRIBUTION_ID,
      region: env.CDN_REGION,
      bucket: env.CDN_BUCKET,
      cacheControlMaxAge: env.CDN_CACHE_CONTROL_MAX_AGE,
      imageFormats: env.CDN_IMAGE_FORMATS.split(',').map(f => f.trim()),
      imageQuality: env.CDN_IMAGE_QUALITY
    };

    this.initialized = true;

    unifiedLogger.info('CDN configuration initialized', {
      enabled: this.settings.enabled,
      region: this.settings.region,
      formats: this.settings.imageFormats.join(', '),
      quality: this.settings.imageQuality
    });
  }

  /**
   * Get CDN settings
   */
  static getSettings(): CDNSettings {
    if (!this.initialized) {
      this.initialize();
    }

    if (!this.settings) {
      throw new Error('CDN configuration not available');
    }

    return { ...this.settings };
  }

  /**
   * Check if CDN is enabled
   */
  static isEnabled(): boolean {
    if (!this.initialized) {
      this.initialize();
    }

    return this.settings?.enabled ?? false;
  }

  /**
   * Get CDN URL for an asset path
   */
  static getAssetUrl(path: string): string {
    if (!this.isEnabled() || !this.settings?.url) {
      return path;
    }

    // Remove leading slash if present
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;

    // Construct CDN URL
    const cdnUrl = this.settings.url.endsWith('/')
      ? this.settings.url.slice(0, -1)
      : this.settings.url;

    return `${cdnUrl}/${cleanPath}`;
  }

  /**
   * Get optimized image URL with transformation parameters
   */
  static getImageUrl(path: string, options?: ImageTransformOptions): string {
    const baseUrl = this.getAssetUrl(path);

    if (!this.isEnabled() || !options) {
      return baseUrl;
    }

    // Build query parameters for image transformation
    const params: string[] = [];

    if (options.width) {
      params.push(`w=${options.width}`);
    }

    if (options.height) {
      params.push(`h=${options.height}`);
    }

    if (options.format) {
      params.push(`f=${options.format}`);
    }

    if (options.quality) {
      params.push(`q=${options.quality}`);
    }

    if (options.fit) {
      params.push(`fit=${options.fit}`);
    }

    // Add default quality if not specified
    if (!options.quality && this.settings) {
      params.push(`q=${this.settings.imageQuality}`);
    }

    if (params.length === 0) {
      return baseUrl;
    }

    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${params.join('&')}`;
  }

  /**
   * Get cache control header value
   */
  static getCacheControl(maxAge?: number): string {
    const age = maxAge ?? this.settings?.cacheControlMaxAge ?? 31536000;
    return `public, max-age=${age}, immutable`;
  }

  /**
   * Get supported image formats
   */
  static getSupportedFormats(): string[] {
    if (!this.initialized) {
      this.initialize();
    }

    return this.settings?.imageFormats ?? ['jpeg', 'png', 'webp', 'avif'];
  }

  /**
   * Check if an image format is supported
   */
  static isFormatSupported(format: string): boolean {
    const supported = this.getSupportedFormats();
    return supported.includes(format.toLowerCase());
  }

  /**
   * Get recommended format for a given browser/client
   */
  static getRecommendedFormat(acceptHeader?: string): string {
    if (!acceptHeader) {
      return 'jpeg';
    }

    const supported = this.getSupportedFormats();
    const lower = acceptHeader.toLowerCase();

    // Check in order of preference (modern formats first)
    if (supported.includes('avif') && lower.includes('image/avif')) {
      return 'avif';
    }

    if (supported.includes('webp') && lower.includes('image/webp')) {
      return 'webp';
    }

    if (supported.includes('jpeg') && lower.includes('image/jpeg')) {
      return 'jpeg';
    }

    if (supported.includes('png') && lower.includes('image/png')) {
      return 'png';
    }

    return 'jpeg'; // Default fallback
  }

  /**
   * Get CDN bucket name
   */
  static getBucket(): string | undefined {
    if (!this.initialized) {
      this.initialize();
    }

    return this.settings?.bucket;
  }

  /**
   * Get CDN region
   */
  static getRegion(): string {
    if (!this.initialized) {
      this.initialize();
    }

    return this.settings?.region ?? 'us-east-1';
  }

  /**
   * Get CDN distribution ID
   */
  static getDistributionId(): string | undefined {
    if (!this.initialized) {
      this.initialize();
    }

    return this.settings?.distributionId;
  }

  /**
   * Validate CDN configuration
   */
  static validate(): { valid: boolean; errors: string[] } {
    if (!this.initialized) {
      this.initialize();
    }

    const errors: string[] = [];

    if (!this.settings) {
      errors.push('CDN configuration not initialized');
      return { valid: false, errors };
    }

    if (this.settings.enabled) {
      if (!this.settings.url) {
        errors.push('CDN URL is required when CDN is enabled');
      }

      if (!this.settings.bucket) {
        errors.push('CDN bucket is required when CDN is enabled');
      }

      if (this.settings.imageQuality < 1 || this.settings.imageQuality > 100) {
        errors.push('Image quality must be between 1 and 100');
      }

      if (this.settings.cacheControlMaxAge < 0) {
        errors.push('Cache control max age must be positive');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get configuration summary
   */
  static getSummary(): {
    enabled: boolean;
    url?: string;
    region: string;
    formats: string[];
    quality: number;
    cacheMaxAge: number;
    valid: boolean;
  } {
    if (!this.initialized) {
      this.initialize();
    }

    const validation = this.validate();

    return {
      enabled: this.isEnabled(),
      url: this.settings?.url,
      region: this.settings?.region ?? 'us-east-1',
      formats: this.getSupportedFormats(),
      quality: this.settings?.imageQuality ?? 80,
      cacheMaxAge: this.settings?.cacheControlMaxAge ?? 31536000,
      valid: validation.valid
    };
  }

  /**
   * Reset configuration (mainly for testing)
   */
  static reset(): void {
    this.settings = null;
    this.initialized = false;
    unifiedLogger.info('CDN configuration reset');
  }
}

// Export default instance for convenience
export default CDNConfig;
