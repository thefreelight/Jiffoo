/**
 * Marketplace Client
 * 
 * Client for connecting to official Jiffoo marketplace
 * Supports offline graceful degradation
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  MarketplaceTheme,
  MarketplacePlugin,
  MarketplaceListQuery,
  MarketplaceListResponse,
  MarketplaceStatus,
  DownloadResult,
} from './types';

// Get marketplace URL from environment
const MARKETPLACE_BASE_URL = process.env.MARKETPLACE_BASE_URL || 'https://marketplace.jiffoo.com/api';
const REQUEST_TIMEOUT = parseInt(process.env.MARKETPLACE_TIMEOUT || '10000', 10);
const EXTENSIONS_TMP_DIR = path.join(process.cwd(), 'extensions', '.tmp');

// Cache marketplace status
let marketplaceStatus: MarketplaceStatus = {
  online: false,
  lastCheck: new Date(0),
  version: '0.0.0',
};

const STATUS_CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Check marketplace connectivity
 */
export async function checkMarketplaceStatus(): Promise<MarketplaceStatus> {
  const now = new Date();
  if (now.getTime() - marketplaceStatus.lastCheck.getTime() < STATUS_CACHE_TTL) {
    return marketplaceStatus;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(`${MARKETPLACE_BASE_URL}/status`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      marketplaceStatus = {
        online: true,
        lastCheck: now,
        version: data.version || '1.0.0',
      };
    } else {
      marketplaceStatus = {
        online: false,
        lastCheck: now,
        version: '0.0.0',
        message: `HTTP ${response.status}`,
      };
    }
  } catch (error: any) {
    marketplaceStatus = {
      online: false,
      lastCheck: now,
      version: '0.0.0',
      message: error.name === 'AbortError' ? 'Connection timeout' : error.message,
    };
  }

  return marketplaceStatus;
}

/**
 * Fetch themes from marketplace
 */
export async function fetchThemes(
  query: MarketplaceListQuery
): Promise<MarketplaceListResponse<MarketplaceTheme>> {
  const status = await checkMarketplaceStatus();
  if (!status.online) {
    return {
      items: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      featured: [],
    };
  }

  try {
    const params = new URLSearchParams();
    if (query.category) params.set('category', query.category);
    if (query.search) params.set('search', query.search);
    if (query.priceType) params.set('priceType', query.priceType);
    if (query.sortBy) params.set('sortBy', query.sortBy);
    params.set('page', String(query.page || 1));
    params.set('limit', String(query.limit || 10));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(`${MARKETPLACE_BASE_URL}/themes?${params}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[MarketplaceClient] Failed to fetch themes:', error);
    return {
      items: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    };
  }
}

/**
 * Get theme details from marketplace
 */
export async function fetchThemeDetails(
  slug: string
): Promise<MarketplaceTheme | null> {
  const status = await checkMarketplaceStatus();
  if (!status.online) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(`${MARKETPLACE_BASE_URL}/themes/${slug}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('[MarketplaceClient] Failed to fetch theme details:', error);
    return null;
  }
}

/**
 * Download theme ZIP from marketplace
 */
export async function downloadTheme(slug: string): Promise<DownloadResult> {
  const theme = await fetchThemeDetails(slug);
  if (!theme) {
    return { success: false, error: 'Theme not found or marketplace offline' };
  }

  try {
    // Ensure tmp directory exists
    if (!fs.existsSync(EXTENSIONS_TMP_DIR)) {
      fs.mkdirSync(EXTENSIONS_TMP_DIR, { recursive: true });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT * 3);

    const response = await fetch(theme.downloadUrl, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `Download failed: HTTP ${response.status}` };
    }

    const zipPath = path.join(EXTENSIONS_TMP_DIR, `${slug}.zip`);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(zipPath, Buffer.from(buffer));

    return { success: true, zipPath };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Fetch plugins from marketplace
 */
export async function fetchPlugins(
  query: MarketplaceListQuery
): Promise<MarketplaceListResponse<MarketplacePlugin>> {
  const status = await checkMarketplaceStatus();
  if (!status.online) {
    return {
      items: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      featured: [],
    };
  }

  try {
    const params = new URLSearchParams();
    if (query.category) params.set('category', query.category);
    if (query.search) params.set('search', query.search);
    if (query.priceType) params.set('priceType', query.priceType);
    if (query.sortBy) params.set('sortBy', query.sortBy);
    params.set('page', String(query.page || 1));
    params.set('limit', String(query.limit || 10));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(`${MARKETPLACE_BASE_URL}/plugins?${params}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[MarketplaceClient] Failed to fetch plugins:', error);
    return {
      items: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    };
  }
}

/**
 * Get plugin details from marketplace
 */
export async function fetchPluginDetails(
  slug: string
): Promise<MarketplacePlugin | null> {
  const status = await checkMarketplaceStatus();
  if (!status.online) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(`${MARKETPLACE_BASE_URL}/plugins/${slug}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('[MarketplaceClient] Failed to fetch plugin details:', error);
    return null;
  }
}

/**
 * Download plugin ZIP from marketplace
 */
export async function downloadPlugin(slug: string): Promise<DownloadResult> {
  const plugin = await fetchPluginDetails(slug);
  if (!plugin) {
    return { success: false, error: 'Plugin not found or marketplace offline' };
  }

  try {
    // Ensure tmp directory exists
    if (!fs.existsSync(EXTENSIONS_TMP_DIR)) {
      fs.mkdirSync(EXTENSIONS_TMP_DIR, { recursive: true });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT * 3);

    const response = await fetch(plugin.downloadUrl, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `Download failed: HTTP ${response.status}` };
    }

    const zipPath = path.join(EXTENSIONS_TMP_DIR, `${slug}.zip`);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(zipPath, Buffer.from(buffer));

    return { success: true, zipPath };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

