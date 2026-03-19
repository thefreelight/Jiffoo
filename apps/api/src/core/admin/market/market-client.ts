/**
 * Market API Client (§4.9)
 *
 * HTTP client for the official Jiffoo extension market.
 * Handles browse, search, detail, download, and compatibility check.
 */

import { CacheService } from '@/core/cache/service';
import { LoggerService } from '@/core/logger/unified-logger';
import type {
  CommercialPackageActivationRequest,
  CommercialPackageActivationResponse,
  OfficialExtensionCatalogItem,
  OfficialExtensionCatalogResponse,
  OfficialInstallAuthorizationRequest,
  OfficialInstallAuthorizationResponse,
  OfficialInstallRecordRequest,
  PlatformConnectionBindTenantRequest,
  PlatformConnectionCompleteRequest,
  PlatformConnectionPollRequest,
  PlatformConnectionPollResponse,
  PlatformConnectionStartRequest,
  PlatformConnectionStartResponse,
} from 'shared';

const MARKET_CACHE_TTL = 5 * 60; // 5 minutes in seconds

export interface MarketExtension {
  slug: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  downloads: number;
  rating: number;
  price: number; // 0 = free
  thumbnailUrl?: string;
  compatibility: string; // semver range
}

export interface MarketSearchResult {
  items: MarketExtension[];
  total: number;
  page: number;
  limit: number;
}

export interface MarketExtensionDetail extends MarketExtension {
  longDescription: string;
  screenshots: string[];
  changelog: string;
  permissions: string[];
  size: number;
  downloadUrl: string;
}

interface MarketApiEnvelope<T> {
  success?: boolean;
  data?: T;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getMarketBaseUrl(): string {
  if (process.env.MARKET_API_URL) {
    return trimTrailingSlash(process.env.MARKET_API_URL);
  }

  // In-cluster deployments expose Platform API as the official marketplace.
  if (process.env.PLATFORM_API_SERVICE_HOST) {
    return 'http://platform-api:80/api';
  }

  return 'https://market.jiffoo.com/api/v1';
}

function getMarketApiKey(): string | undefined {
  return process.env.MARKET_API_KEY;
}

async function marketFetch(path: string, options?: RequestInit): Promise<Response> {
  const baseUrl = getMarketBaseUrl();
  const apiKey = getMarketApiKey();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'JiffooPlatform/1.0',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...((options?.headers as Record<string, string>) || {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      LoggerService.logError(new Error(`Market API request timed out: ${path}`), {
        context: 'MarketClient',
      });
      throw new Error('Market API request timed out');
    }
    throw error;
  }
}

export const MarketClient = {
  async getOfficialCatalog(search?: string): Promise<OfficialExtensionCatalogResponse> {
    const cacheKey = `market:official-catalog:${getMarketBaseUrl()}:${search || 'all'}`;

    const cached = await CacheService.get<string>(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        /* ignore corrupted cache */
      }
    }

    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const response = await marketFetch(`/marketplace/official/catalog${query}`);
    if (!response.ok) {
      throw new Error(`Official catalog error: ${response.status}`);
    }

    const envelope = (await response.json()) as MarketApiEnvelope<OfficialExtensionCatalogResponse>;
    if (!envelope?.data) {
      throw new Error('Official catalog payload missing data');
    }

    await CacheService.set(cacheKey, JSON.stringify(envelope.data), { ttl: MARKET_CACHE_TTL });
    return envelope.data;
  },

  async getOfficialDetail(slug: string): Promise<OfficialExtensionCatalogItem> {
    const cacheKey = `market:official-detail:${getMarketBaseUrl()}:${slug}`;

    const cached = await CacheService.get<string>(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        /* ignore corrupted cache */
      }
    }

    const response = await marketFetch(`/marketplace/official/catalog/${slug}`);
    if (!response.ok) {
      throw new Error(`Official catalog detail error: ${response.status}`);
    }

    const envelope = (await response.json()) as MarketApiEnvelope<{ item: OfficialExtensionCatalogItem }>;
    if (!envelope?.data?.item) {
      throw new Error('Official catalog detail payload missing item');
    }

    await CacheService.set(cacheKey, JSON.stringify(envelope.data.item), { ttl: MARKET_CACHE_TTL });
    return envelope.data.item;
  },

  async authorizeInstall(
    slug: string,
    payload: OfficialInstallAuthorizationRequest
  ): Promise<OfficialInstallAuthorizationResponse> {
    const response = await marketFetch(`/marketplace/official/catalog/${slug}/authorize-install`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Official install authorization error: ${response.status}`);
    }

    const envelope = (await response.json()) as MarketApiEnvelope<OfficialInstallAuthorizationResponse>;
    if (!envelope?.data) {
      throw new Error('Official install authorization payload missing data');
    }

    return envelope.data;
  },

  async recordInstall(slug: string, payload: OfficialInstallRecordRequest): Promise<void> {
    const response = await marketFetch(`/marketplace/official/catalog/${slug}/record-install`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Official install record error: ${response.status}`);
    }
  },

  async activateCommercialPackage(
    payload: CommercialPackageActivationRequest,
  ): Promise<CommercialPackageActivationResponse> {
    const response = await marketFetch('/marketplace/commercial-packages/activate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Commercial package activation error: ${response.status}`);
    }

    const envelope = (await response.json()) as MarketApiEnvelope<CommercialPackageActivationResponse>;
    if (!envelope?.data) {
      throw new Error('Commercial package activation payload missing data');
    }

    return envelope.data;
  },

  async startPlatformConnection(
    payload: PlatformConnectionStartRequest
  ): Promise<PlatformConnectionStartResponse> {
    const response = await marketFetch('/marketplace/platform-connection/device/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Platform connection start error: ${response.status}`);
    }

    const envelope = (await response.json()) as MarketApiEnvelope<PlatformConnectionStartResponse>;
    if (!envelope?.data) {
      throw new Error('Platform connection start payload missing data');
    }

    return envelope.data;
  },

  async pollPlatformConnection(
    payload: PlatformConnectionPollRequest
  ): Promise<PlatformConnectionPollResponse> {
    const response = await marketFetch('/marketplace/platform-connection/device/poll', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Platform connection poll error: ${response.status}`);
    }

    const envelope = (await response.json()) as MarketApiEnvelope<PlatformConnectionPollResponse>;
    if (!envelope?.data) {
      throw new Error('Platform connection poll payload missing data');
    }

    return envelope.data;
  },

  async completePlatformConnection(
    payload: PlatformConnectionCompleteRequest
  ): Promise<PlatformConnectionPollResponse> {
    const response = await marketFetch('/marketplace/platform-connection/device/complete', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Platform connection completion error: ${response.status}`);
    }

    const envelope = (await response.json()) as MarketApiEnvelope<PlatformConnectionPollResponse>;
    if (!envelope?.data) {
      throw new Error('Platform connection completion payload missing data');
    }

    return envelope.data;
  },

  async bindPlatformTenant(
    payload: PlatformConnectionBindTenantRequest & {
      instanceId: string;
      instanceToken: string;
    }
  ): Promise<{ status: PlatformConnectionPollResponse['status'] }> {
    const response = await marketFetch('/marketplace/platform-connection/tenant/bind', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Platform tenant binding error: ${response.status}`);
    }

    const envelope = (await response.json()) as MarketApiEnvelope<{ status: PlatformConnectionPollResponse['status'] }>;
    if (!envelope?.data) {
      throw new Error('Platform tenant binding payload missing data');
    }

    return envelope.data;
  },

  /** Browse extensions with pagination and category filter */
  async browse(params: {
    page?: number;
    limit?: number;
    category?: string;
    sort?: string;
  }): Promise<MarketSearchResult> {
    const { page = 1, limit = 20, category, sort = 'popular' } = params;
    const cacheKey = `market:browse:${page}:${limit}:${category || 'all'}:${sort}`;

    // Try cache
    const cached = await CacheService.get<string>(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        /* ignore corrupted cache */
      }
    }

    const queryParams = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sort,
      ...(category ? { category } : {}),
    });

    const response = await marketFetch(`/extensions?${queryParams}`);
    if (!response.ok) {
      throw new Error(`Market API error: ${response.status}`);
    }

    const data = await response.json();
    await CacheService.set(cacheKey, JSON.stringify(data), { ttl: MARKET_CACHE_TTL });
    return data;
  },

  /** Search extensions by query */
  async search(
    query: string,
    params?: { page?: number; limit?: number }
  ): Promise<MarketSearchResult> {
    const { page = 1, limit = 20 } = params || {};
    const cacheKey = `market:search:${query}:${page}:${limit}`;

    const cached = await CacheService.get<string>(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        /* ignore corrupted cache */
      }
    }

    const queryParams = new URLSearchParams({
      q: query,
      page: String(page),
      limit: String(limit),
    });
    const response = await marketFetch(`/extensions/search?${queryParams}`);
    if (!response.ok) {
      throw new Error(`Market search error: ${response.status}`);
    }

    const data = await response.json();
    await CacheService.set(cacheKey, JSON.stringify(data), { ttl: MARKET_CACHE_TTL });
    return data;
  },

  /** Get extension details */
  async getDetail(slug: string): Promise<MarketExtensionDetail> {
    const cacheKey = `market:detail:${slug}`;

    const cached = await CacheService.get<string>(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        /* ignore corrupted cache */
      }
    }

    const response = await marketFetch(`/extensions/${slug}`);
    if (!response.ok) {
      throw new Error(`Market detail error: ${response.status}`);
    }

    const data = await response.json();
    await CacheService.set(cacheKey, JSON.stringify(data), { ttl: MARKET_CACHE_TTL });
    return data;
  },

  /** Download extension ZIP */
  async download(slug: string, version?: string): Promise<Buffer> {
    const path = version
      ? `/extensions/${slug}/download?version=${version}`
      : `/extensions/${slug}/download`;

    const response = await marketFetch(path);
    if (!response.ok) {
      throw new Error(`Market download error: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  },

  /** Check compatibility */
  async checkCompatibility(
    slug: string,
    platformVersion: string
  ): Promise<{ compatible: boolean; reason?: string }> {
    const response = await marketFetch(
      `/extensions/${slug}/compatibility?platform=${platformVersion}`
    );
    if (!response.ok) {
      return { compatible: false, reason: 'Failed to check compatibility' };
    }
    return response.json();
  },

  /** Check for updates for installed extensions */
  async checkUpdates(
    installedExtensions: Array<{ slug: string; version: string }>
  ): Promise<
    Array<{
      slug: string;
      currentVersion: string;
      latestVersion: string;
      hasUpdate: boolean;
    }>
  > {
    const response = await marketFetch('/extensions/check-updates', {
      method: 'POST',
      body: JSON.stringify({ extensions: installedExtensions }),
    });
    if (!response.ok) {
      throw new Error(`Market update check error: ${response.status}`);
    }
    return response.json();
  },

  /** Lightweight connectivity check (no cache) */
  async checkConnectivity(): Promise<{
    ok: boolean;
    status?: number;
    latencyMs: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      const response = await marketFetch('/marketplace/official/catalog');
      return {
        ok: response.ok,
        status: response.status,
        latencyMs: Date.now() - start,
      };
    } catch (error: any) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: error?.message || 'Unknown error',
      };
    }
  },
};
