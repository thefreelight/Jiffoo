import { CacheService } from '@/core/cache/service';
import { LoggerService } from '@/core/logger/unified-logger';
import { compareVersions } from '@/core/admin/extension-installer/version-utils';

const OFFICIAL_ARTIFACT_INDEX_CACHE_TTL = 5 * 60;
const OFFICIAL_ARTIFACT_INDEX_CACHE_KEY = 'market:official-artifacts:index';

export type OfficialArtifactIndexKind = 'theme' | 'plugin';

export interface OfficialArtifactIndexItem {
  slug: string;
  kind: OfficialArtifactIndexKind;
  version: string;
  packageUrl: string;
  sha256?: string;
  sizeBytes?: number;
  signaturePath?: string;
}

interface OfficialArtifactIndexResponse {
  generatedAt?: string;
  items?: Array<{
    slug?: unknown;
    kind?: unknown;
    version?: unknown;
    packageUrl?: unknown;
    sha256?: unknown;
    sizeBytes?: unknown;
    signaturePath?: unknown;
  }>;
}

function normalizeArtifactItem(
  item: OfficialArtifactIndexResponse['items'][number],
): OfficialArtifactIndexItem | null {
  if (!item) return null;
  if (typeof item.slug !== 'string' || item.slug.trim().length === 0) return null;
  if (item.kind !== 'theme' && item.kind !== 'plugin') return null;
  if (typeof item.version !== 'string' || item.version.trim().length === 0) return null;
  if (typeof item.packageUrl !== 'string' || item.packageUrl.trim().length === 0) return null;

  return {
    slug: item.slug.trim(),
    kind: item.kind,
    version: item.version.trim(),
    packageUrl: item.packageUrl.trim(),
    ...(typeof item.sha256 === 'string' ? { sha256: item.sha256 } : {}),
    ...(typeof item.sizeBytes === 'number' ? { sizeBytes: item.sizeBytes } : {}),
    ...(typeof item.signaturePath === 'string' ? { signaturePath: item.signaturePath } : {}),
  };
}

export function getOfficialArtifactsIndexUrl(): string {
  return process.env.OFFICIAL_ARTIFACTS_INDEX_URL?.trim() || 'https://market.jiffoo.com/artifacts/index.json';
}

export async function fetchOfficialArtifactsIndex(
  options?: { fresh?: boolean },
): Promise<OfficialArtifactIndexItem[]> {
  const fresh = options?.fresh === true;
  if (!fresh) {
    const cached = await CacheService.get<string>(OFFICIAL_ARTIFACT_INDEX_CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached) as OfficialArtifactIndexItem[];
      } catch {
        // ignore corrupted cache
      }
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(getOfficialArtifactsIndexUrl(), {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Official artifacts index error: ${response.status}`);
    }

    const payload = (await response.json()) as OfficialArtifactIndexResponse;
    const items = (payload.items || [])
      .map(normalizeArtifactItem)
      .filter((item): item is OfficialArtifactIndexItem => Boolean(item));

    await CacheService.set(
      OFFICIAL_ARTIFACT_INDEX_CACHE_KEY,
      JSON.stringify(items),
      { ttl: OFFICIAL_ARTIFACT_INDEX_CACHE_TTL },
    );

    return items;
  } catch (error) {
    LoggerService.logError(error as Error, { context: 'Official artifacts index fetch' });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function buildOfficialArtifactMap(
  items: OfficialArtifactIndexItem[],
): Map<string, OfficialArtifactIndexItem> {
  const map = new Map<string, OfficialArtifactIndexItem>();

  for (const item of items) {
    const key = `${item.kind}:${item.slug}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      continue;
    }

    try {
      if (compareVersions(item.version, existing.version) > 0) {
        map.set(key, item);
      }
    } catch {
      if (item.version !== existing.version && item.version > existing.version) {
        map.set(key, item);
      }
    }
  }

  return map;
}
