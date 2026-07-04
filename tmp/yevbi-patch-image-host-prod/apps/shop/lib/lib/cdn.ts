/**
 * CDN utility for managing frontend asset URLs
 * Provides functions to generate CDN URLs for various asset types
 */

export type AssetType = 'image' | 'script' | 'style' | 'font' | 'video' | 'document';

export interface CDNOptions {
  version?: string;
  width?: number;
  height?: number;
  quality?: number;
  format?: string;
}

/**
 * Get the CDN base URL from environment variables
 */
function getCDNBaseUrl(): string {
  return process.env.NEXT_PUBLIC_CDN_URL || '';
}

/**
 * Check if CDN is enabled
 */
export function isCDNEnabled(): boolean {
  return Boolean(getCDNBaseUrl());
}

/**
 * Generate a CDN URL for a given asset path
 */
export function getCDNUrl(path: string, options: CDNOptions = {}): string {
  // If path is already a full URL, return it as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const cdnBaseUrl = getCDNBaseUrl();

  // If CDN is not configured, return the path as-is
  if (!cdnBaseUrl) {
    return path;
  }

  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Build the URL
  let url = `${cdnBaseUrl}${normalizedPath}`;

  // Add version/cache busting if provided
  if (options.version) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}v=${options.version}`;
  }

  return url;
}

/**
 * Generate a CDN URL for an image with optional transformations
 */
export function getImageCDNUrl(
  path: string,
  options: CDNOptions = {}
): string {
  // If path is already a full URL, return it as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const cdnBaseUrl = getCDNBaseUrl();

  // If CDN is not configured, return the path as-is
  if (!cdnBaseUrl) {
    return path;
  }

  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Build base URL
  let url = `${cdnBaseUrl}${normalizedPath}`;

  // Add image transformation parameters if provided
  const params: string[] = [];

  if (options.width) {
    params.push(`w=${options.width}`);
  }

  if (options.height) {
    params.push(`h=${options.height}`);
  }

  if (options.quality) {
    params.push(`q=${options.quality}`);
  }

  if (options.format) {
    params.push(`f=${options.format}`);
  }

  if (options.version) {
    params.push(`v=${options.version}`);
  }

  if (params.length > 0) {
    url = `${url}?${params.join('&')}`;
  }

  return url;
}

/**
 * Generate a CDN URL for a script file
 */
export function getScriptCDNUrl(path: string, version?: string): string {
  return getCDNUrl(path, { version });
}

/**
 * Generate a CDN URL for a stylesheet
 */
export function getStyleCDNUrl(path: string, version?: string): string {
  return getCDNUrl(path, { version });
}

/**
 * Generate a CDN URL for a font file
 */
export function getFontCDNUrl(path: string): string {
  return getCDNUrl(path);
}

/**
 * Generate a CDN URL for a video file
 */
export function getVideoCDNUrl(path: string, options: CDNOptions = {}): string {
  return getCDNUrl(path, options);
}

/**
 * Generate a CDN URL for a document file
 */
export function getDocumentCDNUrl(path: string, version?: string): string {
  return getCDNUrl(path, { version });
}

/**
 * Generate responsive image srcset for different sizes
 */
export function getResponsiveImageSrcSet(
  path: string,
  widths: number[],
  options: Omit<CDNOptions, 'width'> = {}
): string {
  return widths
    .map((width) => {
      const url = getImageCDNUrl(path, { ...options, width });
      return `${url} ${width}w`;
    })
    .join(', ');
}

/**
 * Generate image URL with preset sizes (thumbnail, small, medium, large)
 */
export function getImagePreset(
  path: string,
  preset: 'thumbnail' | 'small' | 'medium' | 'large' | 'original',
  options: Omit<CDNOptions, 'width' | 'height'> = {}
): string {
  const presets = {
    thumbnail: { width: 150, height: 150 },
    small: { width: 400, height: 400 },
    medium: { width: 800, height: 800 },
    large: { width: 1200, height: 1200 },
    original: {},
  };

  const presetOptions = presets[preset];
  return getImageCDNUrl(path, { ...options, ...presetOptions });
}

/**
 * Prefetch a CDN asset
 */
export function prefetchAsset(url: string, assetType: AssetType = 'image'): void {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;

  if (assetType === 'image') {
    link.as = 'image';
  } else if (assetType === 'script') {
    link.as = 'script';
  } else if (assetType === 'style') {
    link.as = 'style';
  } else if (assetType === 'font') {
    link.as = 'font';
    link.crossOrigin = 'anonymous';
  }

  document.head.appendChild(link);
}

/**
 * Preload a CDN asset (higher priority than prefetch)
 */
export function preloadAsset(url: string, assetType: AssetType = 'image'): void {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;

  if (assetType === 'image') {
    link.as = 'image';
  } else if (assetType === 'script') {
    link.as = 'script';
  } else if (assetType === 'style') {
    link.as = 'style';
  } else if (assetType === 'font') {
    link.as = 'font';
    link.crossOrigin = 'anonymous';
  }

  document.head.appendChild(link);
}
