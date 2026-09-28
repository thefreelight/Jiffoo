import 'server-only';
import { shopApiHeaders } from './api-headers';

export type StorefrontCodeSlots = {
  headCode: string;
  bodyStartCode: string;
  bodyEndCode: string;
};

export async function getStorefrontCode(): Promise<StorefrontCodeSlots | null> {
  try {
    const base = process.env.API_SERVICE_URL || 'http://127.0.0.1:3001';
    const response = await fetch(new URL('/api/v1/store/storefront-code', base), {
      cache: 'no-store', headers: await shopApiHeaders(),
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('success' in body) || body.success !== true ||
      !('data' in body) || !body.data || typeof body.data !== 'object') return null;
    const data = body.data as Record<string, unknown>;
    for (const key of ['ga4MeasurementId', 'metaPixelId', 'baiduSiteKey']) {
      if (data[key] !== null && typeof data[key] !== 'string') return null;
    }
    for (const key of ['headCode', 'bodyStartCode', 'bodyEndCode']) {
      if (typeof data[key] !== 'string' || data[key].length > 65536) return null;
    }
    const slots = {
      headCode: data.headCode as string,
      bodyStartCode: data.bodyStartCode as string,
      bodyEndCode: data.bodyEndCode as string,
    };
    return slots.headCode || slots.bodyStartCode || slots.bodyEndCode ? slots : null;
  } catch {
    return null;
  }
}
