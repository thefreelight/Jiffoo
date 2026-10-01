import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';

interface AdminSettingsEnv extends NativeAuthEnv { DB: D1Database }
type SettingValue = string | number | boolean | string[] | null;
type SettingsMap = Record<string, SettingValue>;

interface SettingsRow { settings: string; updated_at: string }

const SETTINGS_ID = 'system';
const KEY_PATTERN = /^[a-zA-Z0-9_.-]{1,100}$/;
const MAX_VALUE_LENGTH = 4000;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-admin-settings', 'cache-control': 'no-store' } });
}

function validValue(value: unknown): value is SettingValue {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return true;
  if (typeof value === 'string') return value.length <= MAX_VALUE_LENGTH;
  if (Array.isArray(value)) return value.every((item) => typeof item === 'string' && item.length <= MAX_VALUE_LENGTH);
  return false;
}

// Mirrors the Node api systemSettingsService.sanitizeSettings contract:
// currency stays owned by localization.currency only.
function sanitize(settings: SettingsMap): SettingsMap {
  const next: SettingsMap = { ...settings };
  delete next['general.currency'];
  delete next['admin.localization.currency'];
  const currency = next['localization.currency'];
  if (typeof currency !== 'string' || !currency.trim()) next['localization.currency'] = 'USD';
  return next;
}

async function readSettings(env: AdminSettingsEnv): Promise<SettingsMap> {
  const row = await env.DB.prepare('SELECT settings, updated_at FROM native_settings WHERE id = ?1')
    .bind(SETTINGS_ID).first<SettingsRow>();
  if (!row) return {};
  try {
    const parsed = JSON.parse(row.settings) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const map: SettingsMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (KEY_PATTERN.test(key) && validValue(value)) map[key] = value;
    }
    return sanitize(map);
  } catch {
    return {};
  }
}

export async function tryNativeAdminSettings(request: Request, env: AdminSettingsEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const isList = url.pathname === '/api/v1/admin/settings' && request.method === 'GET';
  const isBatch = url.pathname === '/api/v1/admin/settings/batch' && request.method === 'PUT';
  if (!isList && !isBatch) return null;
  const admin = await authenticateNativeAdmin(request, env);
  if (!admin) {
    return json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator authentication is required' } }, 401);
  }
  if (isList) {
    return json({ success: true, data: await readSettings(env) });
  }
  const body = await request.clone().json<{ settings?: unknown }>().catch(() => null);
  const updates = body?.settings;
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'A settings object is required' } }, 400);
  }
  const current = await readSettings(env);
  const merged: SettingsMap = { ...current };
  for (const [key, value] of Object.entries(updates as Record<string, unknown>)) {
    if (!KEY_PATTERN.test(key)) {
      return json({ success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid setting key: ${key.slice(0, 40)}` } }, 400);
    }
    if (!validValue(value)) {
      return json({ success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid setting value for ${key.slice(0, 40)}` } }, 400);
    }
    merged[key] = value as SettingValue;
  }
  const sanitized = sanitize(merged);
  const now = new Date().toISOString();
  const existing = await env.DB.prepare('SELECT id FROM native_settings WHERE id = ?1').bind(SETTINGS_ID).first();
  if (existing) {
    await env.DB.prepare('UPDATE native_settings SET settings = ?1, updated_at = ?2 WHERE id = ?3')
      .bind(JSON.stringify(sanitized), now, SETTINGS_ID).run();
  } else {
    await env.DB.prepare('INSERT INTO native_settings (id, settings, updated_at) VALUES (?1, ?2, ?3)')
      .bind(SETTINGS_ID, JSON.stringify(sanitized), now).run();
  }
  return json({ success: true, data: sanitized, message: `${Object.keys(updates as Record<string, unknown>).length} settings updated` });
}
