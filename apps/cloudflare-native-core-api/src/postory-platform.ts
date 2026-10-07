import { authenticateNativeUser, type NativeSessionUser } from './auth';

/**
 * Postory 0.0.7 platform slice: cloud backup time machine, collections,
 * public share pages, plaza discovery and paid collections.
 *
 * Serves (all under POSTORY_STORE_ENABLED=true, dedicated postory worker):
 * - PUT/GET/DELETE /api/extensions/plugin/archive/api/backup     (E2E-encrypted cloud backup)
 * - POST/GET      /api/extensions/plugin/collections/api/collections
 * - PUT/DELETE    /api/extensions/plugin/collections/api/collections/{id}
 * - POST          /api/extensions/plugin/collections/api/collections/{id}/items
 * - DELETE        /api/extensions/plugin/collections/api/collections/{id}/items/{itemId}
 * - POST          /api/extensions/plugin/collections/api/collections/{id}/share
 * - POST          /api/extensions/plugin/collections/api/collections/{id}/checkout
 * - GET (no auth) /api/extensions/plugin/collections/api/public/{shareId}
 * - GET (no auth) /api/extensions/plugin/collections/api/plaza
 *
 * Deleted-content policy (POSTORY-004 三原则): public surfaces carry links,
 * titles and owner commentary only; tombstoned items never expose content.
 */

interface PlatformEnv {
  DB: D1Database;
  ASSETS?: R2Bucket;
  POSTORY_STORE_ENABLED?: string;
  STRIPE_SECRET_KEY?: unknown;
  YIPAY_PID?: string;
  YIPAY_KEY?: string;
  YIPAY_GATEWAY?: string;
  PLATFORM_FEE_PERCENT?: string;
}

const PLATFORM = '/api/extensions/plugin/collections/api';
const BACKUP = '/api/extensions/plugin/archive/api/backup';
const PLATFORM_FEE_PERCENT_DEFAULT = 15;
const PAID_BACKUP_LIMIT_BYTES = 256 * 1024 * 1024;
const FREE_BACKUP_LIMIT_BYTES = 0; // backup is a paid feature

interface CollectionRow {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  visibility: string;
  access_tier: string;
  price_cents: number | null;
  currency: string | null;
  cover_emoji: string | null;
}

function json(data: unknown, status = 200): Response {
  return Response.json(
    status < 400 ? { success: true, data } : { success: false, error: data },
    { status, headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-postory-platform' } },
  );
}

function fail(status: number, code: string, message: string): Response {
  return json({ code, message }, status);
}

function uuid(): string {
  return crypto.randomUUID();
}

function platformFeeCents(amountCents: number, env: PlatformEnv): number {
  const percent = Number(env.PLATFORM_FEE_PERCENT || PLATFORM_FEE_PERCENT_DEFAULT);
  return Math.round((amountCents * percent) / 100);
}

export async function tryPostoryPlatform(request: Request, env: PlatformEnv): Promise<Response | null> {
  if (env.POSTORY_STORE_ENABLED !== 'true') return null;
  const url = new URL(request.url);
  const pathname = url.pathname;
  if (pathname.startsWith(BACKUP)) return await handleBackup(request, pathname, env);
  if (!pathname.startsWith(PLATFORM + '/')) return null;

  const method = request.method;

  // ---- public, no auth ----
  if (method === 'GET' && pathname === PLATFORM + '/plaza') {
    const rows = await env.DB.prepare(
      `SELECT c.id, c.title, c.description, c.cover_emoji, c.access_tier, c.price_cents, c.currency,
              (SELECT COUNT(*) FROM postory_collection_items i WHERE i.collection_id = c.id) AS item_count
       FROM postory_collections c
       WHERE c.visibility = 'public' AND EXISTS (SELECT 1 FROM postory_collection_shares s WHERE s.collection_id = c.id AND s.revoked_at IS NULL)
       ORDER BY c.updated_at DESC LIMIT 100`,
    ).all<Record<string, unknown>>();
    return json((rows.results ?? []) as unknown[]);
  }

  const publicView = pathname.match(/^\/api\/extensions\/plugin\/collections\/api\/public\/([A-Za-z0-9_-]+)$/);
  if (publicView && method === 'GET') {
    const shareId = publicView[1];
    const share = await env.DB.prepare(
      'SELECT collection_id FROM postory_collection_shares WHERE share_id = ?1 AND revoked_at IS NULL',
    ).bind(shareId).first<{ collection_id: string }>();
    if (!share) return fail(404, 'SHARE_NOT_FOUND', 'This collection is not shared.');
    const collection = await env.DB.prepare(
      `SELECT c.id, c.title, c.description, c.cover_emoji, c.access_tier, c.price_cents, c.currency, c.updated_at,
              u.username AS owner_username
       FROM postory_collections c JOIN native_users u ON u.id = c.owner_id
       WHERE c.id = ?1 AND c.visibility = 'public'`,
    ).bind(share.collection_id).first<Record<string, unknown>>();
    if (!collection) return fail(404, 'SHARE_NOT_FOUND', 'This collection is not shared.');
    const items = await env.DB.prepare(
      `SELECT id, title, author_handle, url, note, tombstone, position
       FROM postory_collection_items WHERE collection_id = ?1 ORDER BY position`,
    ).bind(share.collection_id).all<Record<string, unknown>>();
    // Tombstoned (deleted) items expose the marker only — never the content.
    const safeItems = (items.results ?? []).map((item: Record<string, unknown>) =>
      item.tombstone ? { id: item.id, tombstone: true, position: item.position } : item,
    );
    return json({ collection, items: safeItems });
  }

  // ---- authenticated ----
  const user = await authenticateNativeUser(request, env as never);
  if (!user) return fail(401, 'UNAUTHORIZED', 'Login required');

  if (pathname === PLATFORM + '/collections' && method === 'POST') {
    const body = await request.clone().json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return fail(400, 'TITLE_REQUIRED', 'A collection title is required');
    const id = `pcoll_${uuid().replaceAll('-', '')}`;
    await env.DB.prepare(
      `INSERT INTO postory_collections (id, owner_id, title, description, cover_emoji) VALUES (?1, ?2, ?3, ?4, ?5)`,
    ).bind(id, user.id, title, String(body.description || ''), typeof body.coverEmoji === 'string' ? body.coverEmoji : null).run();
    return json({ id, title });
  }

  if (pathname === PLATFORM + '/collections' && method === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT id, title, description, visibility, access_tier, price_cents, currency, cover_emoji, updated_at
       FROM postory_collections WHERE owner_id = ?1 ORDER BY updated_at DESC`,
    ).bind(user.id).all<Record<string, unknown>>();
    return json((rows.results ?? []) as unknown[]);
  }

  const owned = async (collectionId: string): Promise<boolean> => {
    const row = await env.DB.prepare(
      'SELECT owner_id FROM postory_collections WHERE id = ?1',
    ).bind(collectionId).first<{ owner_id: string }>();
    return row?.owner_id === user.id;
  };

  const collectionRoute = pathname.match(/^\/api\/extensions\/plugin\/collections\/api\/collections\/([A-Za-z0-9_-]+)(\/[a-z]+)?$/);
  if (collectionRoute) {
    const collectionId = collectionRoute[1];
    const sub = collectionRoute[2] || '';

    if (!sub && method === 'PUT') {
      if (!(await owned(collectionId))) return fail(404, 'NOT_FOUND', 'Collection not found');
      const body = await request.clone().json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
      await env.DB.prepare(
        `UPDATE postory_collections SET title = COALESCE(?1, title), description = COALESCE(?2, description),
         visibility = COALESCE(?3, visibility), access_tier = COALESCE(?4, access_tier),
         price_cents = ?5, currency = ?6, updated_at = datetime('now') WHERE id = ?7`,
      ).bind(
        typeof body.title === 'string' ? body.title : null,
        typeof body.description === 'string' ? body.description : null,
        typeof body.visibility === 'string' && ['private', 'public'].includes(body.visibility) ? body.visibility : null,
        typeof body.accessTier === 'string' && ['free', 'subscriber_free', 'subscriber_discount', 'paid'].includes(body.accessTier) ? body.accessTier : null,
        typeof body.priceCents === 'number' ? body.priceCents : null,
        typeof body.currency === 'string' ? body.currency : null,
        collectionId,
      ).run();
      return json({ id: collectionId });
    }

    if (!sub && method === 'DELETE') {
      if (!(await owned(collectionId))) return fail(404, 'NOT_FOUND', 'Collection not found');
      await env.DB.prepare('DELETE FROM postory_collections WHERE id = ?1').bind(collectionId).run();
      return json({ deleted: collectionId });
    }

    if (sub === '/items' && method === 'POST') {
      if (!(await owned(collectionId))) return fail(404, 'NOT_FOUND', 'Collection not found');
      const body = await request.clone().json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
      const postId = typeof body.postId === 'string' ? body.postId : '';
      const postUrl = typeof body.url === 'string' ? body.url : '';
      if (!postId || !postUrl) return fail(400, 'ITEM_REQUIRED', 'postId and url are required');
      const id = `pitem_${uuid().replaceAll('-', '')}`;
      const position = Number(body.position ?? Date.now() % 1_000_000);
      await env.DB.prepare(
        `INSERT INTO postory_collection_items (id, collection_id, post_id, url, title, author_handle, note, position)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      ).bind(id, collectionId, postId, postUrl, String(body.title || ''), String(body.authorHandle || ''), String(body.note || ''), position).run();
      return json({ id });
    }

    const itemRemove = sub.match(/^\/items\/([A-Za-z0-9_-]+)$/);
    if (itemRemove && method === 'DELETE') {
      if (!(await owned(collectionId))) return fail(404, 'NOT_FOUND', 'Collection not found');
      await env.DB.prepare('DELETE FROM postory_collection_items WHERE id = ?1 AND collection_id = ?2').bind(itemRemove[1], collectionId).run();
      return json({ removed: itemRemove[1] });
    }

    if (sub === '/share' && method === 'POST') {
      if (!(await owned(collectionId))) return fail(404, 'NOT_FOUND', 'Collection not found');
      const visibility = await env.DB.prepare('SELECT visibility FROM postory_collections WHERE id = ?1').bind(collectionId).first<{ visibility: string }>();
      if (visibility?.visibility !== 'public') return fail(400, 'NOT_PUBLIC', 'Set the collection visibility to public first');
      const existing = await env.DB.prepare('SELECT share_id FROM postory_collection_shares WHERE collection_id = ?1 AND revoked_at IS NULL').bind(collectionId).first<{ share_id: string }>();
      if (existing) return json({ shareId: existing.share_id });
      const shareId = uuid().replaceAll('-', '').slice(0, 22);
      await env.DB.prepare('INSERT INTO postory_collection_shares (collection_id, share_id) VALUES (?1, ?2)').bind(collectionId, shareId).run();
      return json({ shareId });
    }

    if (sub === '/checkout' && method === 'POST') {
      const access = await env.DB.prepare(
        `SELECT access_tier, price_cents, currency, owner_id FROM postory_collections WHERE id = ?1 AND visibility = 'public'`,
      ).bind(collectionId).first<{ access_tier: string; price_cents: number | null; currency: string | null; owner_id: string }>();
      if (!access) return fail(404, 'NOT_FOUND', 'Collection not found');
      if (access.access_tier !== 'paid' || !access.price_cents) return fail(400, 'NOT_PURCHASABLE', 'This collection is not a paid collection');
      if (access.owner_id === user.id) return fail(400, 'OWN_COLLECTION', 'You already own this collection');
      const already = await env.DB.prepare(
        "SELECT id FROM postory_collection_orders WHERE collection_id = ?1 AND buyer_id = ?2 AND status = 'PAID'",
      ).bind(collectionId, user.id).first<{ id: string }>();
      if (already) return json({ ok: true, alreadyPurchased: true });
      const currency = access.currency || 'usd';
      const gross = access.price_cents;
      const fee = platformFeeCents(gross, env);
      const orderId = `pcorder_${uuid().replaceAll('-', '')}`;
      const provider = currency.toLowerCase() === 'cny' ? 'yipay' : 'stripe';
      if (provider === 'stripe') {
        const secretKey = await secretValue(env.STRIPE_SECRET_KEY);
        if (!secretKey) return fail(503, 'PAYMENT_PLUGIN_FAILED', 'Stripe is not configured');
        const origin = new URL(request.url).origin;
        const form = new URLSearchParams();
        form.set('mode', 'payment');
        form.set('line_items[0][quantity]', '1');
        form.set('line_items[0][price_data][currency]', currency);
        form.set('line_items[0][price_data][product_data][name]', `Postory collection: ${collectionId.slice(0, 12)}`);
        form.set('line_items[0][price_data][unit_amount]', String(gross));
        form.set('metadata[orderId]', orderId);
        form.set('metadata[collectionId]', collectionId);
        form.set('metadata[buyerId]', user.id);
        if (user.email) form.set('customer_email', user.email);
        form.set('success_url', `${origin}/c/${collectionRoutePatch(collectionId)}?purchase=success`);
        form.set('cancel_url', `${origin}/c/${collectionRoutePatch(collectionId)}?purchase=canceled`);
        const stripe = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: { authorization: `Bearer ${secretKey}`, 'content-type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        });
        const payload = await stripe.json<{ id?: string; url?: string }>().catch(() => ({}) as { id?: string; url?: string });
        if (!stripe.ok || !payload.id || !payload.url) return fail(502, 'PAYMENT_PLUGIN_FAILED', 'Stripe checkout could not be created');
        await insertCollectionOrder(env, orderId, collectionId, user.id, access.owner_id, gross, fee, currency, 'stripe', payload.id);
        return json({ orderId, session: { url: payload.url } });
      }
      // yipay: CNY rail via the epay gateway (owner scans Alipay/WeChat QR)
      const gateway = (env.YIPAY_GATEWAY || 'https://yzf.chfastpay.com').replace(/\/+$/, '');
      const key = await secretValue(env.YIPAY_KEY);
      const pid = env.YIPAY_PID || '';
      if (!key || !pid) return fail(503, 'PAYMENT_PLUGIN_FAILED', 'yipay is not configured');
      const notifyUrl = `${origin}/api/extensions/plugin/yipay/api/api/payments/webhook`;
      const params: Record<string, string> = {
        pid,
        type: 'alipay',
        out_trade_no: orderId,
        notify_url: notifyUrl,
        return_url: `${origin}/c/${collectionId}?purchase=success`,
        name: `Postory collection ${collectionId.slice(0, 8)}`,
        money: (gross / 100).toFixed(2),
      };
      const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&') + key;
      const md5HexLocal = await md5(sorted);
      const query = new URLSearchParams({ ...params, sign: md5HexLocal, sign_type: 'MD5' });
      await insertCollectionOrder(env, orderId, collectionId, user.id, access.owner_id, gross, fee, currency, 'yipay', orderId);
      return json({ orderId, session: { url: `${gateway}/submit.php?${query.toString()}` } });
    }
  }

  return null;
}

function collectionRoutePatch(collectionId: string): string {
  return collectionId;
}

async function insertCollectionOrder(
  env: PlatformEnv,
  orderId: string,
  collectionId: string,
  buyerId: string,
  ownerId: string,
  grossCents: number,
  feeCents: number,
  currency: string,
  provider: string,
  providerSessionId: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO postory_collection_orders
     (id, collection_id, buyer_id, owner_id, amount_cents, platform_fee_cents, creator_cents, currency, provider, provider_session_id, status)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'PENDING')`,
  ).bind(orderId, collectionId, buyerId, ownerId, grossCents, feeCents, grossCents - feeCents, currency, provider, providerSessionId).run();
}

async function md5(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('MD5', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function handleBackup(request: Request, pathname: string, env: PlatformEnv): Promise<Response | null> {
  if (!env.ASSETS) return fail(503, 'BACKUP_UNAVAILABLE', 'Backup storage is not configured');
  const user = await authenticateNativeUser(request, env as never);
  if (!user) return fail(401, 'UNAUTHORIZED', 'Login required');
  const key = `archives/${user.id}/snapshot.enc`;

  if (request.method === 'PUT') {
    const body = await request.clone().json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
    const manifest = typeof body.manifest === 'string' ? body.manifest : JSON.stringify(body.manifest ?? {});
    const payloadB64 = typeof body.payload === 'string' ? body.payload : '';
    if (!payloadB64) return fail(400, 'PAYLOAD_REQUIRED', 'Encrypted payload is required');
    const size = Math.round((payloadB64.length * 3) / 4);
    if (size > PAID_BACKUP_LIMIT_BYTES_CLIENT) return fail(413, 'BACKUP_TOO_LARGE', 'Backup exceeds the storage quota');
    await env.ASSETS.put(key, payloadB64);
    await env.DB.prepare(
      `INSERT INTO postory_backup_manifests (user_id, manifest, payload_key, size_bytes, post_count, conversation_count, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET manifest = ?2, payload_key = ?3, size_bytes = ?4,
         post_count = ?5, conversation_count = ?6, updated_at = datetime('now')`,
    ).bind(user.id, manifest, key, size, Number(body.postCount ?? 0), Number(body.conversationCount ?? 0)).run();
    return json({ key, size });
  }

  if (request.method === 'GET') {
    const row = await env.DB.prepare(
      'SELECT manifest, payload_key, size_bytes, post_count, conversation_count, updated_at FROM postory_backup_manifests WHERE user_id = ?1',
    ).bind(user.id).first<Record<string, unknown>>();
    if (!row) return json({ backup: null });
    const obj = await env.ASSETS.get(String(row.payload_key));
    const payload = obj ? await obj.text() : null;
    return json({ backup: { manifest: row.manifest, payload, sizeBytes: row.size_bytes, postCount: row.post_count, conversationCount: row.conversation_count, updatedAt: row.updated_at } });
  }

  if (request.method === 'DELETE') {
    const row = await env.DB.prepare('SELECT payload_key FROM postory_backup_manifests WHERE user_id = ?1').bind(user.id).first<{ payload_key: string }>();
    if (row) await env.ASSETS.delete(row.payload_key);
    await env.DB.prepare('DELETE FROM postory_backup_manifests WHERE user_id = ?1').bind(user.id).run();
    return json({ deleted: true });
  }

  return null;
}

const PAID_BACKUP_LIMIT_BYTES_CLIENT = 256 * 1024 * 1024;

import { md5Hex } from './shipping-providers';
void md5Hex;
async function secretValue(value: unknown): Promise<string> {
  if (value && typeof value === 'object' && 'get' in (value as Record<string, unknown>)) {
    return await (value as { get(): Promise<string> }).get();
  }
  return typeof value === 'string' ? value : '';
}

// Reuse the native bcrypt/PBKDF2 auth chain; LocalUser shape matches NativeSessionUser.
export type PostoryPlatformUser = NativeSessionUser;
