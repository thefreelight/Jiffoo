import 'server-only';
import { serverCoreResponse } from './core-transport';
import { withAvailability } from './availability-boundary';
import { ShopAvailability } from './availability';
import type { ProviderIds } from './storefront-providers';
import { CoreHttpError } from './core-errors';

export type StorefrontCodeSlots = {
  headCode: string;
  bodyStartCode: string;
  bodyEndCode: string;
};
export type StorefrontCode = StorefrontCodeSlots & ProviderIds;

export async function getStorefrontCode(): Promise<StorefrontCode | null> {
  return withAvailability(async () => {
  try {
    const response = await serverCoreResponse('/store/storefront-code');
    if (!response.ok) throw new CoreHttpError(response.status);
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('success' in body) || body.success !== true ||
      !('data' in body) || !body.data || typeof body.data !== 'object') throw new CoreHttpError(500);
    const data = body.data as Record<string, unknown>;
    for (const key of ['ga4MeasurementId', 'metaPixelId', 'baiduSiteKey']) {
      if (data[key] !== null && typeof data[key] !== 'string') throw new CoreHttpError(500);
    }
    for (const key of ['headCode', 'bodyStartCode', 'bodyEndCode']) {
      if (typeof data[key] !== 'string' || data[key].length > 65536) throw new CoreHttpError(500);
    }
    const slots = {
      ga4MeasurementId: data.ga4MeasurementId as string | null,
      metaPixelId: data.metaPixelId as string | null,
      baiduSiteKey: data.baiduSiteKey as string | null,
      headCode: data.headCode as string,
      bodyStartCode: data.bodyStartCode as string,
      bodyEndCode: data.bodyEndCode as string,
    };
    return Object.values(slots).some(Boolean) ? slots : null;
  } catch (error) {
    if (error instanceof ShopAvailability) throw error;
    throw error;
  }
  });
}
