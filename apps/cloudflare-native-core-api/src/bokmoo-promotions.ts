import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';
import { failure, success } from './checkout';

export interface BokmooPromotionsEnv extends NativeAuthEnv { DB: D1Database }

export interface PromotionRow {
  id: string;
  slug: string;
  name: string;
  status: string;
  starts_at: string;
  ends_at: string;
  discount_type: string;
  discount_value: number;
  product_ids_json: string | null;
  per_user_limit: number;
  banner_json: string | null;
  rules_url: string | null;
  created_at: string;
  updated_at: string;
  /** Rows written before templates existed are drawn by the plain announcement bar. */
  banner_template?: string | null;
}

/**
 * The template that draws a promotion's banner on the storefront. `default` is the plain announcement bar;
 * `campaign` is the bar with a badge, the offer in gold, the window and a countdown.
 */
export type PromotionBannerTemplate = 'default' | 'campaign';

/**
 * The words of a banner in one language. `title` and `body` feed the plain announcement bar; the others
 * the campaign bar, each optional: what is missing is left out, or taken from the promotion itself.
 */
export interface PromotionBannerCopy {
  title: string;
  body: string;
  badge?: string;
  subject?: string;
  lead?: string;
  highlight?: string;
  note?: string;
  cta?: string;
}

const BANNER_TEXT_LIMITS = { badge: 40, subject: 120, lead: 60, highlight: 40, note: 60, cta: 60 } as const;

export function promotionBannerTemplate(value: unknown): PromotionBannerTemplate {
  return value === 'campaign' ? 'campaign' : 'default';
}

function readJson<T>(text: string | null | undefined): T | null {
  if (!text) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

export function publicPromotion(row: PromotionRow, locale: string, now = new Date().toISOString()) {
  const banner: Record<string, PromotionBannerCopy> = readJson<Record<string, PromotionBannerCopy>>(row.banner_json) ?? {};
  const productIds = readJson<string[]>(row.product_ids_json);
  const localized = banner[locale] ?? banner['en'] ?? Object.values(banner)[0] ?? null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    productIds,
    perUserLimit: row.per_user_limit,
    banner: localized,
    bannerTemplate: promotionBannerTemplate(row.banner_template),
    rulesUrl: row.rules_url,
    activeNow: row.status === 'active' && row.starts_at <= now && row.ends_at >= now,
  };
}

export function promotionPayload(body: unknown): {
  slug: string; name: string; startsAt: string; endsAt: string;
  discountType: string; discountValue: number;
  productIds: string[] | null; perUserLimit: number;
  banner: Record<string, PromotionBannerCopy> | null; bannerTemplate: PromotionBannerTemplate; rulesUrl: string | null;
} | null {
  const payload = (body ?? {}) as Record<string, unknown>;
  const text = (key: string, max: number) => {
    const value = payload[key];
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
  };
  const slug = text('slug', 64);
  const name = text('name', 120);
  const startsAt = text('startsAt', 40);
  const endsAt = text('endsAt', 40);
  const discountType = text('discountType', 10);
  const discountValue = typeof payload.discountValue === 'number' && Number.isFinite(payload.discountValue)
    ? payload.discountValue : null;
  if (!slug || !name || !startsAt || !endsAt || !discountType || discountValue === null) return null;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return null;
  if (discountType !== 'percent' && discountType !== 'fixed') return null;
  if (discountType === 'percent' && (discountValue <= 0 || discountValue >= 100)) return null;
  if (discountType === 'fixed' && discountValue <= 0) return null;
  if (Number.isNaN(Date.parse(startsAt)) || Number.isNaN(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.parse(startsAt)) return null;
  const productIds = Array.isArray(payload.productIds) && payload.productIds.every((id) => typeof id === 'string' && id.trim())
    ? (payload.productIds as string[]).map((id) => id.trim()) : null;
  const perUserLimit = typeof payload.perUserLimit === 'number' && Number.isInteger(payload.perUserLimit) && payload.perUserLimit >= 0
    ? payload.perUserLimit : 0;
  let banner: Record<string, PromotionBannerCopy> | null = null;
  if (payload.banner && typeof payload.banner === 'object' && !Array.isArray(payload.banner)) {
    banner = {};
    for (const [locale, entry] of Object.entries(payload.banner as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object') return null;
      const copy = entry as Record<string, unknown>;
      if (typeof copy.title !== 'string' || typeof copy.body !== 'string' || !copy.title.trim() || !copy.body.trim()) return null;
      const words: PromotionBannerCopy = { title: copy.title.trim().slice(0, 160), body: copy.body.trim().slice(0, 600) };
      for (const [field, limit] of Object.entries(BANNER_TEXT_LIMITS)) {
        const value = copy[field];
        if (typeof value !== 'string') continue;
        if (value.trim()) words[field as keyof typeof BANNER_TEXT_LIMITS] = value.trim().slice(0, limit);
      }
      banner[locale] = words;
    }
    if (Object.keys(banner).length === 0) banner = null;
  }
  const rulesUrl = text('rulesUrl', 300);
  return { slug, name, startsAt, endsAt, discountType, discountValue, productIds, perUserLimit, banner, bannerTemplate: promotionBannerTemplate(payload.bannerTemplate), rulesUrl };
}

// Storefront browsers (bokmoo.com) read the active-promotion list directly;
// every other consumer is native or server-proxied, so the CORS surface
// stays scoped to this one public GET.
const PROMO_CORS_ORIGINS = new Set(['https://bokmoo.com', 'https://www.bokmoo.com']);

function promotionCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin')?.trim() ?? '';
  if (!PROMO_CORS_ORIGINS.has(origin)) return {};
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}

export async function tryNativeBokmooPromotions(request: Request, env: BokmooPromotionsEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path !== '/api/v1/promotions/active'
    && path !== '/api/v1/admin/promotions'
    && !path.startsWith('/api/v1/admin/promotions/')) return null;

  if (path === '/api/v1/promotions/active') {
    const cors = promotionCorsHeaders(request);
    if (request.method === 'OPTIONS') {
      if (!cors['Access-Control-Allow-Origin']) return failure(403, 'FORBIDDEN_ORIGIN', 'Origin not allowed');
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'content-type',
        },
      });
    }
    if (request.method !== 'GET') return failure(405, 'METHOD_NOT_ALLOWED', 'GET only');
    const locale = (new URL(request.url).searchParams.get('locale') ?? 'en').slice(0, 12);
    const now = new Date().toISOString();
    const result = await env.DB.prepare(
      `SELECT * FROM native_promotions WHERE status = 'active' AND starts_at <= ?1 AND ends_at >= ?1
       ORDER BY starts_at ASC`,
    ).bind(now).all<PromotionRow>();
    const response = success({ items: (result.results ?? []).map((row) => publicPromotion(row, locale, now)) });
    if (!Object.keys(cors).length) return response;
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(cors)) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  }

  const admin = await authenticateNativeAdmin(request, env);
  if (!admin) return failure(401, 'UNAUTHORIZED', 'Admin login required');

  if (path === '/api/v1/admin/promotions' && request.method === 'POST') {
    const body = await request.json<unknown>().catch(() => null);
    const payload = promotionPayload(body);
    if (!payload) return failure(400, 'VALIDATION_ERROR', 'Invalid promotion payload');
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    try {
      await env.DB.prepare(
        `INSERT INTO native_promotions
         (id, slug, name, status, starts_at, ends_at, discount_type, discount_value,
          product_ids_json, per_user_limit, banner_json, banner_template, rules_url, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'draft', ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)`,
      ).bind(
        id, payload.slug, payload.name, payload.startsAt, payload.endsAt,
        payload.discountType, payload.discountValue,
        payload.productIds ? JSON.stringify(payload.productIds) : null,
        payload.perUserLimit,
        payload.banner ? JSON.stringify(payload.banner) : null,
        payload.bannerTemplate, payload.rulesUrl, now,
      ).run();
    } catch {
      return failure(409, 'SLUG_TAKEN', 'A promotion with this slug already exists');
    }
    const row = await env.DB.prepare('SELECT * FROM native_promotions WHERE id = ?1').bind(id).first<PromotionRow>();
    return Response.json({ success: true, data: row ? publicPromotion(row, 'en', now) : null }, { status: 201 });
  }

  if (path === '/api/v1/admin/promotions' && request.method === 'GET') {
    const result = await env.DB.prepare('SELECT * FROM native_promotions ORDER BY created_at DESC').all<PromotionRow>();
    const now = new Date().toISOString();
    return success({ items: (result.results ?? []).map((row) => publicPromotion(row, 'en', now)) });
  }

  const updateMatch = path.match(/^\/api\/v1\/admin\/promotions\/([^/]+)$/);
  if (updateMatch && request.method === 'PATCH') {
    const body = await request.json<unknown>().catch(() => null);
    const payload = (body ?? {}) as Record<string, unknown>;
    const existing = await env.DB.prepare('SELECT * FROM native_promotions WHERE id = ?1').bind(updateMatch[1]).first<PromotionRow>();
    if (!existing) return failure(404, 'NOT_FOUND', 'Promotion not found');
    // what is sent replaces what is stored; the rest of the campaign stays as it is
    const merged = promotionPayload({
      slug: payload.slug ?? existing.slug,
      name: payload.name ?? existing.name,
      startsAt: payload.startsAt ?? existing.starts_at,
      endsAt: payload.endsAt ?? existing.ends_at,
      discountType: payload.discountType ?? existing.discount_type,
      discountValue: payload.discountValue ?? existing.discount_value,
      productIds: payload.productIds !== undefined ? payload.productIds : readJson<unknown>(existing.product_ids_json),
      perUserLimit: existing.per_user_limit,
      banner: payload.banner !== undefined ? payload.banner : readJson<unknown>(existing.banner_json),
      bannerTemplate: payload.bannerTemplate ?? promotionBannerTemplate(existing.banner_template),
      rulesUrl: payload.rulesUrl !== undefined ? payload.rulesUrl : existing.rules_url,
    });
    if (!merged) return failure(400, 'VALIDATION_ERROR', 'Invalid promotion payload');
    if (payload.perUserLimit !== undefined && !(Number.isInteger(payload.perUserLimit) && Number(payload.perUserLimit) >= 0)) {
      return failure(400, 'VALIDATION_ERROR', 'perUserLimit must be a whole number of 0 or more');
    }
    const perUserLimit = payload.perUserLimit === undefined ? existing.per_user_limit : Number(payload.perUserLimit);
    const status = payload.status === undefined ? existing.status
      : typeof payload.status === 'string' && ['draft', 'active', 'ended'].includes(payload.status) ? payload.status : null;
    if (status === null) return failure(400, 'VALIDATION_ERROR', 'status must be draft, active or ended');
    if (merged.slug !== existing.slug) {
      const clash = await env.DB.prepare('SELECT id FROM native_promotions WHERE slug = ?1 AND id != ?2')
        .bind(merged.slug, existing.id).first<{ id: string }>();
      if (clash) return failure(409, 'SLUG_TAKEN', 'A promotion with this slug already exists');
    }
    const now = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE native_promotions
       SET slug = ?1, name = ?2, status = ?3, starts_at = ?4, ends_at = ?5, discount_type = ?6, discount_value = ?7,
           product_ids_json = ?8, per_user_limit = ?9, banner_json = ?10, banner_template = ?11, rules_url = ?12, updated_at = ?13
       WHERE id = ?14`,
    ).bind(
      merged.slug, merged.name, status, merged.startsAt, merged.endsAt, merged.discountType, merged.discountValue,
      merged.productIds ? JSON.stringify(merged.productIds) : null, perUserLimit,
      merged.banner ? JSON.stringify(merged.banner) : null, merged.bannerTemplate, merged.rulesUrl, now, existing.id,
    ).run();
    const row = await env.DB.prepare('SELECT * FROM native_promotions WHERE id = ?1').bind(existing.id).first<PromotionRow>();
    return success(row ? publicPromotion(row, 'en', now) : null);
  }

  return failure(404, 'NOT_FOUND', 'Unknown promotions route');
}

export interface ResolvedPromotion {
  row: PromotionRow;
  /** Best-for-this-cart total discount in dollars. */
  discountAmount: number;
}

/**
 * Pick the single active promotion that yields the largest discount for
 * this cart. Per-user limits skip (not fail) the promotion; the caller
 * applies the discount on the item unit price so the Stripe charge, the
 * order record and the apps always agree.
 */
export async function resolveActivePromotion(
  env: BokmooPromotionsEnv,
  productIds: string[],
  quantities: Map<string, number>,
  salePrices: Map<string, number>,
  userId: string,
  now = new Date().toISOString(),
): Promise<ResolvedPromotion | null> {
  const active = await env.DB.prepare(
    `SELECT * FROM native_promotions WHERE status = 'active' AND starts_at <= ?1 AND ends_at >= ?1`,
  ).bind(now).all<PromotionRow>();
  let best: ResolvedPromotion | null = null;
  for (const row of active.results ?? []) {
    let covered: string[] | null = null;
    if (row.product_ids_json) {
      try { covered = JSON.parse(row.product_ids_json) as string[]; } catch { covered = null; }
    }
    let discount = 0;
    for (const productId of productIds) {
      if (covered && !covered.includes(productId)) continue;
      const quantity = quantities.get(productId) ?? 0;
      const salePrice = salePrices.get(productId) ?? 0;
      const perUnit = row.discount_type === 'percent'
        ? Math.round(salePrice * row.discount_value) / 100
        : Math.min(row.discount_value, Math.max(salePrice - 0.01, 0));
      discount += Math.min(perUnit, salePrice) * quantity;
    }
    discount = Math.round(discount * 100) / 100;
    if (discount <= 0) continue;
    if (row.per_user_limit > 0) {
      const usage = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM native_order_metadata WHERE user_id = ?1 AND promotion_id = ?2',
      ).bind(userId, row.id).first<{ n: number }>();
      if ((usage?.n ?? 0) >= row.per_user_limit) continue;
    }
    if (!best || discount > best.discountAmount) best = { row, discountAmount: discount };
  }
  return best;
}
