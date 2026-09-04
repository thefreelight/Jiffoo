import { authenticateNativeAdmin, getNativeJwtSecret, type NativeAuthEnv } from './auth';

type ConfigValue = string | number | boolean | null | ConfigValue[] | { [key: string]: ConfigValue };
type PluginConfig = Record<string, ConfigValue>;

type Descriptor = {
  type: 'string' | 'number' | 'boolean' | 'secret';
  label: string;
  description?: string;
  placeholder?: string;
  pattern?: string;
  patternMessage?: string;
  required?: boolean;
  sensitive?: boolean;
  enum?: string[];
};

type PluginDefinition = {
  slug: string;
  name: string;
  version: string;
  description: string;
  category: string;
  configSchema: Record<string, Descriptor>;
};

export interface PluginSettingsEnv extends NativeAuthEnv { DB: D1Database; PLUGIN_CONFIG_KEY?: SecretsStoreSecret }

interface StoredInstance {
  id: string;
  plugin_slug: string;
  instance_key: string;
  enabled: number;
  config_json: string;
  encrypted_secrets_json: string;
  created_at: string;
  updated_at: string;
}

type EncryptedValue = { iv: string; ciphertext: string };

const definitions: Record<string, PluginDefinition> = {
  shipping: {
    slug: 'shipping', name: 'Shipping', version: '1.1.0', category: 'shipping',
    description: 'Native shipment tracking, Odoo fulfillment, Kuaidi100, and 4PX carrier operations.',
    configSchema: {
      mode: { type: 'string', label: 'Provider environment', enum: ['test', 'live'], description: 'Use test endpoints where the carrier provides them.' },
      kuaidi100Enabled: { type: 'boolean', label: 'Enable Kuaidi100' },
      kuaidi100Key: { type: 'string', label: 'Kuaidi100 Key' },
      kuaidi100Customer: { type: 'string', label: 'Kuaidi100 Customer ID' },
      kuaidi100Secret: { type: 'secret', sensitive: true, label: 'Kuaidi100 Secret' },
      kuaidi100CallbackSalt: { type: 'secret', sensitive: true, label: 'Kuaidi100 Callback Salt' },
      fourpxEnabled: { type: 'boolean', label: 'Enable 4PX' },
      fourpxAppKey: { type: 'string', label: '4PX App Key' },
      fourpxAppSecret: { type: 'secret', sensitive: true, label: '4PX App Secret' },
      fourpxAccessToken: { type: 'secret', sensitive: true, label: '4PX Access Token' },
      fourpxLanguage: { type: 'string', label: '4PX Response Language', enum: ['cn', 'en'] },
    },
  },
  'smtp-email': {
    slug: 'smtp-email', name: 'SMTP Email', version: '0.0.6', category: 'email',
    description: 'SMTP transport for verification and transactional email.',
    configSchema: {
      smtpHost: { type: 'string', required: true, label: 'SMTP Host' },
      smtpPort: { type: 'number', required: true, label: 'SMTP Port' },
      smtpSecure: { type: 'boolean', required: true, label: 'Use implicit TLS' },
      smtpUser: { type: 'string', required: true, label: 'SMTP Username' },
      smtpPass: { type: 'secret', required: true, sensitive: true, label: 'SMTP Password' },
      fromEmail: { type: 'string', required: true, label: 'From Email' },
      fromName: { type: 'string', label: 'From Name' },
      replyTo: { type: 'string', label: 'Reply-To' },
      smtpTestSubject: { type: 'string', label: 'Test email subject template' },
      smtpTestText: { type: 'string', label: 'Test email text template' },
      smtpTestHtml: { type: 'string', label: 'Test email HTML template' },
    },
  },
  stripe: {
    slug: 'stripe', name: 'Stripe Payment Gateway', version: '1.0.5', category: 'payment',
    description: 'Stripe checkout, webhooks, and refunds.',
    configSchema: {
      mode: { type: 'string', label: 'Active Stripe mode', enum: ['test', 'live'], description: 'Use test mode for sandbox payments; live mode creates real charges.' },
      secretKey: {
        type: 'secret', sensitive: true, label: 'Stripe Secret Key',
        placeholder: 'sk_live_... or rk_live_...',
        pattern: '^(sk|rk)_(live|test)_.+$',
        patternMessage: 'Use a Stripe secret or restricted key beginning with sk_live_, sk_test_, rk_live_, or rk_test_.',
        description: 'Server-side credential. Paste a standard secret key (sk_...) or a least-privilege restricted key (rk_...). Never place this value in the Publishable Key field.',
      },
      testSecretKey: { type: 'secret', sensitive: true, label: 'Test Secret Key', placeholder: 'sk_test_...' },
      testPublishableKey: { type: 'string', label: 'Test Publishable Key', placeholder: 'pk_test_...' },
      testWebhookSecret: { type: 'secret', sensitive: true, label: 'Test Webhook Signing Secret', placeholder: 'whsec_...' },
      liveSecretKey: { type: 'secret', sensitive: true, label: 'Live Secret Key', placeholder: 'sk_live_...' },
      livePublishableKey: { type: 'string', label: 'Live Publishable Key', placeholder: 'pk_live_...' },
      liveWebhookSecret: { type: 'secret', sensitive: true, label: 'Live Webhook Signing Secret', placeholder: 'whsec_...' },
      publishableKey: {
        type: 'string', label: 'Stripe Publishable Key',
        placeholder: 'pk_live_... or pk_test_...',
        pattern: '^pk_(live|test)_.+$',
        patternMessage: 'Use a Stripe publishable key beginning with pk_live_ or pk_test_.',
        description: 'Browser-safe key from Stripe Dashboard > Developers > API keys. It always begins with pk_; do not paste an sk_ or rk_ key here.',
      },
      webhookSecret: {
        type: 'secret', sensitive: true, label: 'Webhook Signing Secret',
        placeholder: 'whsec_...',
        pattern: '^whsec_.+$',
        patternMessage: 'Use the endpoint signing secret beginning with whsec_.',
        description: 'Signing secret for this Jiffoo instance webhook endpoint. Copy it from Stripe Dashboard > Developers > Webhooks > select the endpoint > Signing secret; it is not an API key.',
      },
    },
  },
  odoo: {
    slug: 'odoo', name: 'Odoo', version: '0.1.0', category: 'integration',
    description: 'Odoo product, inventory, order, and fulfillment integration.',
    configSchema: {
      baseUrl: { type: 'string', required: true, label: 'Odoo Base URL' },
      database: { type: 'string', required: true, label: 'Database' },
      username: { type: 'string', required: true, label: 'Username' },
      apiKey: { type: 'secret', required: true, sensitive: true, label: 'API Key' },
      webhookSecret: { type: 'secret', sensitive: true, label: 'Fulfillment Webhook Secret' },
    },
  },
  wallet: {
    slug: 'wallet', name: 'Virtual Wallet', version: '0.2.0', category: 'billing',
    description: 'Native credits wallet and transaction ledger.', configSchema: {},
  },
  subscription: {
    slug: 'subscription', name: 'Subscription & Membership', version: '0.1.10', category: 'billing',
    description: 'Native subscription and membership status.', configSchema: {},
  },
  'bokmoo-connect': {
    slug: 'bokmoo-connect', name: 'BOKMOO Connect', version: '0.1.2', category: 'integration',
    description: 'Native BOKMOO physical card claim capability: printed-MID claim sessions, Android/reader EID/ICCID verification, account card binding, and controlled card inventory import.',
    configSchema: {},
  },
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function encryptionKey(env: PluginSettingsEnv): Promise<CryptoKey> {
  const rootSecret = env.PLUGIN_CONFIG_KEY ? await env.PLUGIN_CONFIG_KEY.get() : await getNativeJwtSecret(env);
  const root = await crypto.subtle.importKey('raw', encoder.encode(rootSecret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: encoder.encode('jiffoo-native-plugin-settings-v1'), info: encoder.encode('plugin-config') },
    root,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encrypt(env: PluginSettingsEnv, value: string): Promise<EncryptedValue> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(env), encoder.encode(value));
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
}

export async function encryptNativeUserSecret(env: PluginSettingsEnv, value: string): Promise<EncryptedValue> {
  return encrypt(env, value);
}

export async function decryptNativeUserSecret(env: PluginSettingsEnv, value: EncryptedValue): Promise<string> {
  return decrypt(env, value);
}

async function decrypt(env: PluginSettingsEnv, value: EncryptedValue): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(value.iv) },
    await encryptionKey(env),
    base64ToBytes(value.ciphertext),
  );
  return decoder.decode(plaintext);
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parseObject(value: string): Record<string, unknown> {
  try { return object(JSON.parse(value)); } catch { return {}; }
}

async function findInstance(env: PluginSettingsEnv, slug: string): Promise<StoredInstance | null> {
  return env.DB.prepare(
    "SELECT * FROM native_plugin_instances WHERE plugin_slug = ?1 AND instance_key = 'default'",
  ).bind(slug).first<StoredInstance>();
}

function secretFields(definition: PluginDefinition): string[] {
  return Object.entries(definition.configSchema)
    .filter(([, descriptor]) => descriptor.type === 'secret' || descriptor.sensitive)
    .map(([field]) => field);
}

async function adminInstance(row: StoredInstance, definition: PluginDefinition) {
  const config = parseObject(row.config_json);
  const secrets = parseObject(row.encrypted_secrets_json);
  const secretMeta: Record<string, { configured: boolean }> = {};
  for (const field of secretFields(definition)) {
    config[field] = '';
    secretMeta[field] = { configured: Boolean(secrets[field]) };
  }
  return {
    installationId: row.id, pluginSlug: row.plugin_slug, instanceKey: row.instance_key,
    enabled: row.enabled === 1, config, configMeta: { secretFields: secretMeta },
    grantedPermissions: [], createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

async function saveInstance(
  env: PluginSettingsEnv,
  definition: PluginDefinition,
  input: { enabled?: unknown; config?: unknown },
): Promise<StoredInstance> {
  const existing = await findInstance(env, definition.slug);
  const incoming = object(input.config);
  const config = existing ? parseObject(existing.config_json) : {};
  const secrets = existing ? parseObject(existing.encrypted_secrets_json) : {};
  for (const [field, descriptor] of Object.entries(definition.configSchema)) {
    if (!(field in incoming)) continue;
    const value = incoming[field];
    if (descriptor.type === 'secret' || descriptor.sensitive) {
      if (value === null) delete secrets[field];
      else if (typeof value === 'string' && value.trim()) {
        const normalized = value.trim();
        if (definition.slug === 'stripe' && (field.endsWith('SecretKey') || field === 'secretKey')) {
          if (!/^(sk|rk)_(test|live)_/.test(normalized)) throw new Error('Stripe secret key must start with sk_test_, sk_live_, rk_test_, or rk_live_');
        }
        if (definition.slug === 'stripe' && (field.endsWith('WebhookSecret') || field === 'webhookSecret') && !normalized.startsWith('whsec_')) throw new Error('Stripe webhook secret must start with whsec_');
        secrets[field] = await encrypt(env, normalized);
      }
      continue;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) config[field] = value;
  }
  const id = existing?.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const enabled = typeof input.enabled === 'boolean' ? input.enabled : existing?.enabled === 1;
  if (enabled) {
    const missing = Object.entries(definition.configSchema).flatMap(([field, descriptor]) => {
      if (!descriptor.required) return [];
      const value = descriptor.type === 'secret' ? secrets[field] : config[field];
      return value === undefined || value === null || value === '' ? [field] : [];
    });
    if (missing.length > 0) throw new Error(`Required plugin configuration is missing: ${missing.join(', ')}`);
  }
  validateConfig(definition.slug, config, secrets);
  await env.DB.prepare(
    `INSERT INTO native_plugin_instances
      (id, plugin_slug, instance_key, enabled, config_json, encrypted_secrets_json, created_at, updated_at)
     VALUES (?1, ?2, 'default', ?3, ?4, ?5, ?6, ?6)
     ON CONFLICT(plugin_slug, instance_key) DO UPDATE SET enabled = excluded.enabled,
       config_json = excluded.config_json, encrypted_secrets_json = excluded.encrypted_secrets_json,
       updated_at = excluded.updated_at`,
  ).bind(id, definition.slug, enabled ? 1 : 0, JSON.stringify(config), JSON.stringify(secrets), now).run();
  return (await findInstance(env, definition.slug))!;
}

function validateConfig(slug: string, config: Record<string, unknown>, secrets: Record<string, unknown>): void {
  if (slug === 'shipping') {
    if (config.mode !== undefined && config.mode !== 'test' && config.mode !== 'live') throw new Error('Shipping provider mode must be test or live');
    if (config.fourpxLanguage !== undefined && config.fourpxLanguage !== 'cn' && config.fourpxLanguage !== 'en') throw new Error('4PX language must be cn or en');
    if (config.kuaidi100Enabled === true && (!config.kuaidi100Key || !secrets.kuaidi100Secret)) throw new Error('Kuaidi100 key and secret are required when enabled');
    if (config.fourpxEnabled === true && (!config.fourpxAppKey || !secrets.fourpxAppSecret)) throw new Error('4PX app key and secret are required when enabled');
  }
  if (slug === 'smtp-email') {
    const port = config.smtpPort;
    if (port !== undefined && (!Number.isInteger(port) || Number(port) < 1 || Number(port) > 65535)) throw new Error('SMTP port must be between 1 and 65535');
    for (const field of ['fromEmail', 'replyTo']) {
      const value = config[field];
      if (typeof value === 'string' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error(`${field} must be a valid email address`);
    }
  }
  if (slug === 'stripe') {
    if (config.mode !== undefined && config.mode !== 'test' && config.mode !== 'live') throw new Error('Stripe mode must be test or live');
    const publishableKey = config.publishableKey;
    if (typeof publishableKey === 'string' && publishableKey && !/^pk_(test|live)_/.test(publishableKey)) throw new Error('Stripe publishable key must start with pk_test_ or pk_live_');
    for (const [field, prefix] of [['testPublishableKey', 'pk_test_'], ['livePublishableKey', 'pk_live_'] as const]) {
      const value = config[field];
      if (typeof value === 'string' && value && !value.startsWith(prefix)) throw new Error(`Stripe ${field} must start with ${prefix}`);
    }
    const legacyPublishable = typeof config.publishableKey === 'string' ? config.publishableKey : '';
    const mode = config.mode === 'live' || config.mode === 'test'
      ? config.mode
      : legacyPublishable.startsWith('pk_live_') ? 'live' : 'test';
    const publishable = config[`${mode}PublishableKey`] ?? config.publishableKey;
    const secret = secrets[`${mode}SecretKey`] ?? secrets.secretKey;
    const webhook = secrets[`${mode}WebhookSecret`] ?? secrets.webhookSecret;
    if (!publishable || !secret || !webhook) throw new Error(`Stripe ${mode} mode configuration is incomplete`);
  }
  if (slug === 'odoo') {
    const baseUrl = config.baseUrl;
    if (typeof baseUrl === 'string' && baseUrl) {
      let parsed: URL;
      try { parsed = new URL(baseUrl); } catch { throw new Error('Odoo base URL is invalid'); }
      if (parsed.protocol !== 'https:') throw new Error('Odoo base URL must use HTTPS');
    }
  }
  void secrets;
}

function response(data: unknown, status = 200): Response {
  return Response.json({ success: status < 400, ...(status < 400 ? { data } : { error: data }) }, {
    status,
    headers: { 'cache-control': 'no-store', 'x-jiffoo-runtime': 'cloudflare-native-d1-plugin-settings' },
  });
}

export async function getNativePluginConfig(
  env: PluginSettingsEnv,
  slug: string,
): Promise<{ enabled: boolean; config: Record<string, unknown> } | null> {
  const definition = definitions[slug];
  if (!definition) return null;
  const row = await findInstance(env, slug);
  if (!row) return { enabled: false, config: {} };
  const config = parseObject(row.config_json);
  const encrypted = parseObject(row.encrypted_secrets_json);
  for (const field of secretFields(definition)) {
    const value = encrypted[field];
    if (value && typeof value === 'object' && !Array.isArray(value)) config[field] = await decrypt(env, value as EncryptedValue);
  }
  return { enabled: row.enabled === 1, config };
}

export async function getNativePluginSecret(
  env: PluginSettingsEnv,
  slug: string,
  field: string,
  fallback?: SecretsStoreSecret | string,
): Promise<string> {
  const stored = await getNativePluginConfig(env, slug);
  const value = stored?.enabled ? stored.config[field] : undefined;
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!fallback) return '';
  return typeof fallback === 'string' ? fallback : fallback.get();
}

export async function getNativeStripeSecret(
  env: PluginSettingsEnv,
  field: 'secretKey' | 'webhookSecret',
  fallback?: SecretsStoreSecret | string,
): Promise<{ mode: 'test' | 'live'; value: string }> {
  const stored = await getNativePluginConfig(env, 'stripe');
  const legacySecret = stored?.config.secretKey;
  const mode = stored?.config.mode === 'live' || stored?.config.mode === 'test'
    ? stored.config.mode
    : typeof legacySecret === 'string' && /_(?:live)_/.test(legacySecret) ? 'live' : 'test';
  const profileField = `${mode}${field[0].toUpperCase()}${field.slice(1)}`;
  const value = stored?.enabled ? stored.config[profileField] : undefined;
  if (typeof value === 'string' && value.trim()) return { mode, value: value.trim() };
  const legacy = stored?.enabled ? stored.config[field] : undefined;
  if (typeof legacy === 'string' && legacy.trim()) return { mode, value: legacy.trim() };
  if (fallback) return { mode, value: typeof fallback === 'string' ? fallback : await fallback.get() };
  return { mode, value: '' };
}

export async function tryNativePluginSettings(request: Request, env: PluginSettingsEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === '/api/v1/extensions/plugin' && request.method === 'GET') {
    const admin = await authenticateNativeAdmin(request, env);
    if (!admin) return response({ code: 'UNAUTHORIZED', message: 'Admin authentication required' }, 401);
    const items = await Promise.all(Object.values(definitions).map(async (definition) => {
      const instance = await findInstance(env, definition.slug);
      return {
        ...definition,
        runtimeType: 'cloudflare-native', source: 'native', deletedAt: null,
        enabled: instance?.enabled === 1,
        manifestJson: JSON.stringify({ ...definition, schemaVersion: 1 }),
      };
    }));
    return response({ items, page: 1, limit: items.length, total: items.length, totalPages: 1 });
  }
  const detailMatch = url.pathname.match(/^\/api\/v1\/extensions\/plugin\/([^/]+)$/);
  const instancesMatch = url.pathname.match(/^\/api\/v1\/extensions\/plugin\/([^/]+)\/instances$/);
  const instanceMatch = url.pathname.match(/^\/api\/v1\/extensions\/plugin\/([^/]+)\/instances\/([^/]+)$/);
  const slug = detailMatch?.[1] ?? instancesMatch?.[1] ?? instanceMatch?.[1];
  if (!slug || !definitions[slug]) return null;
  const admin = await authenticateNativeAdmin(request, env);
  if (!admin) return response({ code: 'UNAUTHORIZED', message: 'Admin authentication required' }, 401);
  const definition = definitions[slug];

  if (detailMatch && request.method === 'GET') {
    return response({
      ...definition,
      runtimeType: 'cloudflare-native', source: 'native',
      manifestJson: JSON.stringify({ ...definition, schemaVersion: 1 }),
    });
  }
  if (instancesMatch && request.method === 'GET') {
    const row = await findInstance(env, slug);
    const items = row ? [await adminInstance(row, definition)] : [];
    return response({ items, page: 1, limit: 100, total: items.length, totalPages: items.length ? 1 : 0 });
  }
  if (instancesMatch && request.method === 'POST') {
    const body = await request.json<Record<string, unknown>>().catch(() => ({}));
    try {
      return response(await adminInstance(await saveInstance(env, definition, body), definition), 201);
    } catch (error) {
      return response({ code: 'INVALID_PLUGIN_CONFIG', message: error instanceof Error ? error.message : 'Invalid plugin configuration' }, 400);
    }
  }
  if (instanceMatch && request.method === 'PATCH') {
    const existing = await findInstance(env, slug);
    if (!existing || existing.id !== instanceMatch[2]) return response({ code: 'NOT_FOUND', message: 'Plugin instance not found' }, 404);
    const body = await request.json<Record<string, unknown>>().catch(() => ({}));
    try {
      return response(await adminInstance(await saveInstance(env, definition, body), definition));
    } catch (error) {
      return response({ code: 'INVALID_PLUGIN_CONFIG', message: error instanceof Error ? error.message : 'Invalid plugin configuration' }, 400);
    }
  }
  return null;
}
