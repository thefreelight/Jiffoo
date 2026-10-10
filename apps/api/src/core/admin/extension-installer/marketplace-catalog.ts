import { env, validateMarketplaceUrl } from '@/config/env';
import { ApiError, type ErrorCode } from '@/utils/api-errors';
import { PLUGIN_MAX_ZIP_SIZE } from 'shared/plugin-signing';

const MAX_CATALOG_BYTES = 1024 * 1024;
const CATALOG_TIMEOUT_MS = 5000;
const slugPattern = /^[a-z][a-z0-9-]{0,30}[a-z0-9]$/;
const publisherPattern = /^[a-z][a-z0-9-]{1,63}$/;
const versionPattern = /^\d+\.\d+\.\d+$/;
const apiVersionPattern = /^(?:v\d+|\d+\.\d+\.\d+)$/;

export type CatalogVersion = {
  version: string;
  minApiVersion: string;
  sha256: string;
  size: number;
  downloadUrl: string;
};
export type CatalogPlugin = {
  id: string;
  slug: string;
  name: string;
  description: string;
  publisherId: string;
  declaredCapabilities?: string[];
  versions: CatalogVersion[];
};
export type MarketplaceCatalog = { schemaVersion: 1; plugins: CatalogPlugin[] };

export class MarketplaceError extends ApiError {
  constructor(code: ErrorCode, _statusCode: number) { super(code); }
}

export function marketplaceUrl(): string | undefined {
  if (process.env.NODE_ENV === 'test' && process.env.JIFFOO_TEST_MARKETPLACE_OVERRIDE === 'true') {
    return validateMarketplaceUrl(process.env.JIFFOO_TEST_MARKETPLACE_URL, 'test');
  }
  return env.EXTENSION_MARKETPLACE_URL;
}

function invalid(): never { throw new MarketplaceError('MARKETPLACE_CATALOG_INVALID', 502); }

function exactKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}

export function validateCatalog(value: unknown, base: string, forInstall = false): MarketplaceCatalog {
  if (!exactKeys(value, ['schemaVersion', 'plugins']) || value.schemaVersion !== 1 ||
    !Array.isArray(value.plugins) || value.plugins.length > 1000) invalid();
  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const plugin of value.plugins) {
    if (!exactKeys(plugin, plugin && typeof plugin === 'object' && 'declaredCapabilities' in plugin
      ? ['id', 'slug', 'name', 'description', 'publisherId', 'declaredCapabilities', 'versions']
      : ['id', 'slug', 'name', 'description', 'publisherId', 'versions']) ||
      typeof plugin.id !== 'string' || !slugPattern.test(plugin.id) ||
      typeof plugin.slug !== 'string' || !slugPattern.test(plugin.slug) ||
      typeof plugin.name !== 'string' || !plugin.name.trim() || plugin.name.length > 200 ||
      typeof plugin.description !== 'string' || plugin.description.length > 2000 ||
      typeof plugin.publisherId !== 'string' || !publisherPattern.test(plugin.publisherId) ||
      (plugin.declaredCapabilities !== undefined &&
        (!Array.isArray(plugin.declaredCapabilities) || plugin.declaredCapabilities.length > 20 ||
          plugin.declaredCapabilities.some((capability: unknown) => typeof capability !== 'string' ||
            !/^[a-z][a-z0-9-]{0,63}$/.test(capability)) ||
          new Set(plugin.declaredCapabilities).size !== plugin.declaredCapabilities.length)) ||
      !Array.isArray(plugin.versions) || !plugin.versions.length || plugin.versions.length > 100 ||
      ids.has(plugin.id) || slugs.has(plugin.slug)) invalid();
    ids.add(plugin.id);
    slugs.add(plugin.slug);
    const versions = new Set<string>();
    for (const entry of plugin.versions) {
      if (!exactKeys(entry, ['version', 'minApiVersion', 'sha256', 'size', 'downloadUrl']) ||
        typeof entry.version !== 'string' || !versionPattern.test(entry.version) || versions.has(entry.version) ||
        typeof entry.minApiVersion !== 'string' || !apiVersionPattern.test(entry.minApiVersion) ||
        typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256) ||
        !Number.isSafeInteger(entry.size) || (entry.size as number) < 1 || (entry.size as number) > PLUGIN_MAX_ZIP_SIZE ||
        typeof entry.downloadUrl !== 'string' || !entry.downloadUrl || entry.downloadUrl.startsWith('//')) invalid();
      versions.add(entry.version);
      let url: URL;
      try { url = new URL(entry.downloadUrl, base); } catch { invalid(); }
      if (url.origin !== new URL(base).origin || url.username || url.password || url.hash ||
        !['https:', 'http:'].includes(url.protocol)) {
        if (forInstall) throw new MarketplaceError('MARKETPLACE_DOWNLOAD_ORIGIN_FORBIDDEN', 422);
        invalid();
      }
    }
  }
  return value as MarketplaceCatalog;
}

export async function fetchMarketplaceCatalog(options: { forInstall?: boolean } = {}): Promise<MarketplaceCatalog> {
  const url = marketplaceUrl();
  if (!url) throw new MarketplaceError('MARKETPLACE_NOT_CONFIGURED', 503);
  const controller = new AbortController();
  let timer: NodeJS.Timeout;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new MarketplaceError('MARKETPLACE_CATALOG_TIMEOUT', 504));
    }, CATALOG_TIMEOUT_MS);
  });
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await Promise.race([
      fetch(url, { redirect: 'error', signal: controller.signal, headers: { accept: 'application/json' } }),
      deadline,
    ]);
    if (!response.ok || !response.body) throw new MarketplaceError('MARKETPLACE_CATALOG_UNAVAILABLE', 502);
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > MAX_CATALOG_BYTES) invalid();
      chunks.push(value);
    }
    let parsed: unknown;
    try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { invalid(); }
    const catalog = validateCatalog(parsed, url, options.forInstall);
    return catalog;
  } catch (error) {
    if (error instanceof MarketplaceError) throw error;
    if (controller.signal.aborted) throw new MarketplaceError('MARKETPLACE_CATALOG_TIMEOUT', 504);
    throw new MarketplaceError('MARKETPLACE_CATALOG_UNAVAILABLE', 502);
  } finally {
    clearTimeout(timer!);
    if (reader) void reader.cancel().catch(() => {});
    if (controller.signal.aborted || reader) controller.abort();
  }
}
