import { authenticateNativeUser, type NativeAuthEnv } from './auth';
import { failure, normalizeShippingAddress, success } from './checkout';

export interface AddressBookEnv extends NativeAuthEnv {
  DB: D1Database;
}

const MAX_ADDRESSES_PER_USER = 20;

interface StoredAddress {
  id: string;
  user_id: string;
  label: string | null;
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  state: string | null;
  city: string;
  postal_code: string | null;
  country: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export function publicAddress(row: StoredAddress) {
  return {
    id: row.id,
    label: row.label ?? '',
    isDefault: row.is_default === 1,
    shippingAddress: {
      name: row.name,
      phone: row.phone,
      line1: row.line1,
      ...(row.line2 ? { line2: row.line2 } : {}),
      city: row.city,
      ...(row.state ? { state: row.state } : {}),
      ...(row.postal_code ? { postalCode: row.postal_code } : {}),
      country: row.country,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function addressPayload(body: unknown): Record<string, string> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const source = body as Record<string, unknown>;
  const raw = source.shippingAddress ?? source;
  return normalizeShippingAddress(raw);
}

function labelPayload(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const label = (body as Record<string, unknown>).label;
  if (label === undefined || label === null) return '';
  return typeof label === 'string' ? label.trim().slice(0, 40) : null;
}

function pathId(pathname: string): string | null {
  const match = pathname.match(/^\/api\/v1\/me\/addresses\/([^/]+)(\/default)?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Saved-address CRUD for the native profile ("我的地址") screens. All routes
 * require a native user token; entries are private to the caller. The default
 * entry (is_default=1) is what checkout prefill uses; the first address a
 * user saves becomes the default automatically, and deleting the default
 * promotes the most recent remaining entry.
 */
export async function tryNativeAddressBook(request: Request, env: AddressBookEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const matches = (path === '/api/v1/me/addresses' || path === '/api/v1/shop/me/addresses')
    || (path.startsWith('/api/v1/me/addresses/') || path.startsWith('/api/v1/shop/me/addresses/'));
  if (!matches) return null;
  const user = await authenticateNativeUser(request, env);
  if (!user) return failure(401, 'UNAUTHORIZED', 'Login required');

  if (path === '/api/v1/me/addresses' || path === '/api/v1/shop/me/addresses') {
    if (request.method === 'GET') {
      const result = await env.DB.prepare(
        `SELECT * FROM native_address_book WHERE user_id = ?1
         ORDER BY is_default DESC, updated_at DESC`,
      ).bind(user.id).all<StoredAddress>();
      return success({ items: (result.results ?? []).map(publicAddress), total: result.results?.length ?? 0 });
    }
    if (request.method === 'POST') {
      const body = await request.json<unknown>().catch(() => null);
      const address = addressPayload(body);
      if (!address) return failure(400, 'VALIDATION_ERROR', 'A complete shipping address is required');
      const label = labelPayload(body);
      if (label === null) return failure(400, 'VALIDATION_ERROR', 'label must be a string');
      const existing = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM native_address_book WHERE user_id = ?1',
      ).bind(user.id).first<{ n: number }>();
      if ((existing?.n ?? 0) >= MAX_ADDRESSES_PER_USER) {
        return failure(409, 'ADDRESS_BOOK_FULL', `At most ${MAX_ADDRESSES_PER_USER} addresses can be saved`);
      }
      const isDefault = (existing?.n ?? 0) === 0 ? 1 : 0;
      const now = new Date().toISOString();
      const row: StoredAddress = {
        id: `addr_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`,
        user_id: user.id,
        label: label || null,
        name: address.name, phone: address.phone, line1: address.line1,
        line2: address.line2 ?? null, state: address.state ?? null,
        city: address.city, postal_code: address.postalCode ?? null,
        country: address.country, is_default: isDefault,
        created_at: now, updated_at: now,
      };
      await env.DB.prepare(
        `INSERT INTO native_address_book
         (id, user_id, label, name, phone, line1, line2, state, city, postal_code, country, is_default, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)`,
      ).bind(row.id, row.user_id, row.label, row.name, row.phone, row.line1, row.line2,
        row.state, row.city, row.postal_code, row.country, row.is_default, now).run();
      return success(publicAddress(row), 201);
    }
    return failure(405, 'METHOD_NOT_ALLOWED', 'Unsupported method');
  }

  const id = pathId(path);
  if (!id) return null;
  if (path.endsWith('/default') && request.method === 'POST') {
    const row = await env.DB.prepare(
      'SELECT * FROM native_address_book WHERE id = ?1 AND user_id = ?2',
    ).bind(id, user.id).first<StoredAddress>();
    if (!row) return failure(404, 'NOT_FOUND', 'Address not found');
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare('UPDATE native_address_book SET is_default = 0, updated_at = ?2 WHERE user_id = ?1 AND is_default = 1')
        .bind(user.id, now),
      env.DB.prepare('UPDATE native_address_book SET is_default = 1, updated_at = ?2 WHERE id = ?1')
        .bind(id, now),
    ]);
    return success({ id, isDefault: true });
  }
  if (request.method === 'PATCH') {
    const body = await request.json<unknown>().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return failure(400, 'VALIDATION_ERROR', 'A JSON body is required');
    }
    const row = await env.DB.prepare(
      'SELECT * FROM native_address_book WHERE id = ?1 AND user_id = ?2',
    ).bind(id, user.id).first<StoredAddress>();
    if (!row) return failure(404, 'NOT_FOUND', 'Address not found');
    const merged = {
      name: row.name, phone: row.phone, line1: row.line1,
      ...(row.line2 ? { line2: row.line2 } : {}), city: row.city,
      ...(row.state ? { state: row.state } : {}),
      ...(row.postal_code ? { postalCode: row.postal_code } : {}), country: row.country,
      ...(((body as Record<string, unknown>).shippingAddress ?? {}) as Record<string, unknown>),
    };
    const address = addressPayload({ shippingAddress: merged });
    if (!address) return failure(400, 'VALIDATION_ERROR', 'The updated address is incomplete');
    const label = labelPayload(body);
    if (label === null) return failure(400, 'VALIDATION_ERROR', 'label must be a string');
    const now = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE native_address_book SET label = ?1, name = ?2, phone = ?3, line1 = ?4,
       line2 = ?5, state = ?6, city = ?7, postal_code = ?8, country = ?9, updated_at = ?10
       WHERE id = ?11 AND user_id = ?12`,
    ).bind(
      label || row.label, address.name, address.phone, address.line1,
      address.line2 ?? null, address.state ?? null, address.city,
      address.postalCode ?? null, address.country, now, id, user.id,
    ).run();
    const updated = await env.DB.prepare(
      'SELECT * FROM native_address_book WHERE id = ?1 AND user_id = ?2',
    ).bind(id, user.id).first<StoredAddress>();
    return success(publicAddress(updated as StoredAddress));
  }
  if (request.method === 'DELETE') {
    const row = await env.DB.prepare(
      'SELECT * FROM native_address_book WHERE id = ?1 AND user_id = ?2',
    ).bind(id, user.id).first<StoredAddress>();
    if (!row) return failure(404, 'NOT_FOUND', 'Address not found');
    const wasDefault = row.is_default === 1;
    await env.DB.prepare('DELETE FROM native_address_book WHERE id = ?1 AND user_id = ?2')
      .bind(id, user.id).run();
    if (wasDefault) {
      await env.DB.prepare(
        `UPDATE native_address_book SET is_default = 1, updated_at = ?2
         WHERE id = (SELECT id FROM native_address_book WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT 1)`,
      ).bind(user.id, new Date().toISOString()).run();
    }
    return success({ id, deleted: true });
  }
  return failure(405, 'METHOD_NOT_ALLOWED', 'Unsupported method');
}
