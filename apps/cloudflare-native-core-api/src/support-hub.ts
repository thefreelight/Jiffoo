/**
 * Native Support Hub marketplace adapter.
 *
 * Mirrors the contract-v1 `support-hub` plugin (extensions repo, 0.0.3) on the
 * Cloudflare Native D1/Worker line. Settings persist in the shared
 * `native_plugin_instances.config_json` row created by the official-market
 * install, so the generic admin instance PATCH surface (plugin-settings.ts)
 * and this plugin's `/admin/settings` contract read and write the same data.
 *
 * Route shapes follow the established native adapters (wallet, affiliate):
 *   - storefront:  /api/v1/plugins/support-hub/store/{health,config}
 *   - gateway:     /api/v1/extensions/plugin/support-hub/api/{store,admin}/...
 */

import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';
import { isNativePluginEnabled } from './plugin-enabled';

type SupportHubEnv = NativeAuthEnv & { DB: D1Database };

const RUNTIME = 'cloudflare-native-support-hub';
const PLUGIN_VERSION = '0.0.3';

export interface SupportHubSettings {
  enabled: boolean;
  telegramEnabled: boolean;
  telegramLink: string;
  whatsappEnabled: boolean;
  whatsappLink: string;
  feishuEnabled: boolean;
  feishuLink: string;
  httpsChatEnabled: boolean;
  httpsChatUrl: string;
  retentionDays: number;
  autoAssign: boolean;
  defaultQueue: string;
}

const DEFAULT_SETTINGS: SupportHubSettings = {
  enabled: true,
  telegramEnabled: false,
  telegramLink: '',
  whatsappEnabled: false,
  whatsappLink: '',
  feishuEnabled: false,
  feishuLink: '',
  httpsChatEnabled: false,
  httpsChatUrl: '',
  retentionDays: 90,
  autoAssign: true,
  defaultQueue: 'general',
};

export interface SupportChannel {
  kind: string;
  label: string;
  href: string;
}

function readBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readStr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : fallback;
}

export function mergeNativeSettings(input: Partial<SupportHubSettings>): SupportHubSettings {
  return { ...DEFAULT_SETTINGS, ...input };
}

function normalizeSettings(raw: Record<string, unknown>): SupportHubSettings {
  return mergeNativeSettings({
    enabled: readBool(raw.enabled, DEFAULT_SETTINGS.enabled),
    telegramEnabled: readBool(raw.telegramEnabled, false),
    telegramLink: readStr(raw.telegramLink, ''),
    whatsappEnabled: readBool(raw.whatsappEnabled, false),
    whatsappLink: readStr(raw.whatsappLink, ''),
    feishuEnabled: readBool(raw.feishuEnabled, false),
    feishuLink: readStr(raw.feishuLink, ''),
    httpsChatEnabled: readBool(raw.httpsChatEnabled, false),
    httpsChatUrl: readStr(raw.httpsChatUrl, ''),
    retentionDays: typeof raw.retentionDays === 'number' && Number.isFinite(raw.retentionDays) && raw.retentionDays >= 0
      ? Math.round(raw.retentionDays)
      : DEFAULT_SETTINGS.retentionDays,
    autoAssign: readBool(raw.autoAssign, DEFAULT_SETTINGS.autoAssign),
    defaultQueue: readStr(raw.defaultQueue, DEFAULT_SETTINGS.defaultQueue),
  });
}

export function nativePublicConfig(settings: SupportHubSettings): { enabled: boolean; channels: SupportChannel[] } {
  const channels: SupportChannel[] = [];
  if (settings.enabled && settings.telegramEnabled && settings.telegramLink) {
    channels.push({ kind: 'telegram', label: 'Telegram', href: settings.telegramLink });
  }
  if (settings.enabled && settings.whatsappEnabled && settings.whatsappLink) {
    channels.push({ kind: 'whatsapp', label: 'WhatsApp', href: settings.whatsappLink });
  }
  if (settings.enabled && settings.feishuEnabled && settings.feishuLink) {
    channels.push({ kind: 'feishu', label: 'Feishu/Lark', href: settings.feishuLink });
  }
  if (settings.enabled && settings.httpsChatEnabled && settings.httpsChatUrl) {
    channels.push({ kind: 'https', label: 'Chat', href: settings.httpsChatUrl });
  }
  return { enabled: settings.enabled, channels };
}

export function validateSupportHubSettings(input: Record<string, unknown>): string | null {
  const channels: Array<[string, unknown, unknown]> = [
    ['telegram', input.telegramEnabled, input.telegramLink],
    ['whatsapp', input.whatsappEnabled, input.whatsappLink],
    ['feishu', input.feishuEnabled, input.feishuLink],
    ['https chat', input.httpsChatEnabled, input.httpsChatUrl],
  ];
  for (const [label, enabledFlag, linkField] of channels) {
    if (enabledFlag === true) {
      const link = typeof linkField === 'string' ? linkField.trim() : '';
      if (!link) return `${label} is enabled but its link is empty`;
      if (!/^https?:\/\//.test(link)) return `${label} link must be an http(s) URL`;
    }
  }
  if (typeof input.retentionDays === 'number' && (!Number.isFinite(input.retentionDays) || input.retentionDays < 0 || input.retentionDays > 3650)) {
    return 'retentionDays must be between 0 and 3650';
  }
  return null;
}

function success(data: unknown, status = 200): Response {
  return Response.json({ success: true, data }, { status, headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': RUNTIME } });
}

function failure(status: number, code: string, message: string): Response {
  return Response.json({ success: false, error: { code, message } }, {
    status,
    headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': RUNTIME },
  });
}

async function loadSettings(env: SupportHubEnv): Promise<Record<string, unknown>> {
  const row = await env.DB.prepare(
    "SELECT config_json FROM native_plugin_instances WHERE plugin_slug = 'support-hub' AND instance_key = 'default'",
  ).first<{ config_json: string }>();
  if (!row) return {};
  try {
    const parsed = JSON.parse(row.config_json) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function saveSettings(env: SupportHubEnv, settings: SupportHubSettings): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO native_plugin_instances
     (id, plugin_slug, instance_key, enabled, config_json, encrypted_secrets_json, created_at, updated_at)
     VALUES (?1, 'support-hub', 'default', 1, ?2, '{}', ?3, ?3)
     ON CONFLICT(plugin_slug, instance_key)
     DO UPDATE SET config_json = excluded.config_json, updated_at = excluded.updated_at`,
  ).bind(crypto.randomUUID(), JSON.stringify(settings), now).run();
}

export async function tryNativeSupportHub(request: Request, env: SupportHubEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const storeBase = '/api/v1/plugins/support-hub/store';
  const gatewayBase = '/api/v1/extensions/plugin/support-hub/api';
  let path: string | null = null;
  if (url.pathname === storeBase || url.pathname.startsWith(`${storeBase}/`)) {
    path = url.pathname.slice(storeBase.length) || '/';
  } else if (url.pathname === gatewayBase || url.pathname.startsWith(`${gatewayBase}/`)) {
    path = url.pathname.slice(gatewayBase.length) || '/';
  }
  if (path === null) return null;
  if (!(await isNativePluginEnabled(env, 'support-hub'))) {
    return failure(404, 'PLUGIN_NOT_ENABLED', 'Support Hub is not installed and enabled');
  }

  if (request.method === 'GET' && (path === '/store/health' || path === '/health')) {
    return Response.json({ status: 'healthy', plugin: 'support-hub', version: PLUGIN_VERSION }, {
      headers: { 'x-jiffoo-runtime': RUNTIME },
    });
  }

  if (request.method === 'GET' && (path === '/store/config' || path === '/config')) {
    return success(nativePublicConfig(normalizeSettings(await loadSettings(env))));
  }

  if (path.startsWith('/admin/')) {
    const admin = await authenticateNativeAdmin(request, env);
    if (!admin) return failure(401, 'UNAUTHORIZED', 'Administrator authentication is required');

    if (request.method === 'GET' && path === '/admin/settings') {
      return success(normalizeSettings(await loadSettings(env)));
    }

    if (request.method === 'PUT' && path === '/admin/settings') {
      const body = await request.json<Record<string, unknown>>().catch(() => null);
      if (!body || typeof body !== 'object') return failure(400, 'VALIDATION_ERROR', 'Settings body must be an object');
      const invalid = validateSupportHubSettings(body);
      if (invalid) return failure(400, 'SUPPORT_HUB_SETTINGS_INVALID', invalid);
      const merged = normalizeSettings(body);
      await saveSettings(env, merged);
      return success(merged);
    }
  }

  return failure(404, 'NOT_FOUND', `Unknown Support Hub route: ${request.method} ${url.pathname}`);
}
