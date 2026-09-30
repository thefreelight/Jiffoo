import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { parsePluginConfigSchema } from '@jiffoo/shared';

const DEVELOPMENT_KEY = createHash('sha256').update('jiffoo-plugin-secrets-development-only').digest();
let warned = false;

export function pluginSecretsKey(): Buffer {
  const encoded = process.env.PLUGIN_SECRETS_KEY;
  if (!encoded) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PLUGIN_SECRETS_KEY must be base64 of exactly 32 bytes in production');
    }
    if (!warned) {
      console.warn('WARNING: PLUGIN_SECRETS_KEY is missing; using the fixed development-only plugin secrets key');
      warned = true;
    }
    return DEVELOPMENT_KEY;
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded) {
    throw new Error('PLUGIN_SECRETS_KEY must be base64 of exactly 32 bytes');
  }
  return key;
}

function secretFields(manifest: { configSchema?: unknown }): string[] {
  if (manifest.configSchema === undefined) return [];
  const { schema, issues } = parsePluginConfigSchema(manifest.configSchema);
  if (!schema) throw new Error(`Invalid plugin configSchema: ${issues.map((issue) => issue.path).join(', ')}`);
  return Object.entries(schema.properties).filter(([, field]) => field.sensitive).map(([name]) => name);
}

export function encryptPluginConfig(
  manifest: { configSchema?: unknown },
  config: Record<string, unknown>,
  existing: Record<string, unknown> = {},
): Record<string, unknown> {
  const fields = secretFields(manifest);
  if (!fields.length) return config;
  const key = pluginSecretsKey();
  const keyId = createHash('sha256').update(key).digest('hex').slice(0, 8);
  const stored = { ...config };
  for (const field of fields) {
    const value = stored[field];
    if (typeof value !== 'string' || (field in existing && value === existing[field])) continue;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    stored[field] = `enc:v1:${keyId}:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`;
  }
  return stored;
}

export class PluginConfigDecryptionError extends Error {
  constructor(readonly field: string) {
    super(`Plugin configuration field "${field}" cannot be decrypted; re-enter its value`);
  }
}

export function decryptPluginConfig(manifest: { configSchema?: unknown }, config: Record<string, unknown>): Record<string, unknown> {
  const fields = secretFields(manifest);
  if (!fields.length) return config;
  const key = pluginSecretsKey();
  const keyId = createHash('sha256').update(key).digest('hex').slice(0, 8);
  const result = { ...config };
  for (const field of fields) {
    const value = result[field];
    if (value === undefined || value === null || value === '') continue;
    const parts = typeof value === 'string' ? value.split(':') : [];
    if (parts.length !== 6 || parts[0] !== 'enc' || parts[1] !== 'v1' || parts[2] !== keyId) {
      throw new PluginConfigDecryptionError(field);
    }
    try {
      const iv = Buffer.from(parts[3], 'base64url');
      const tag = Buffer.from(parts[4], 'base64url');
      if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid envelope');
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      result[field] = Buffer.concat([decipher.update(Buffer.from(parts[5], 'base64url')), decipher.final()]).toString('utf8');
    } catch {
      throw new PluginConfigDecryptionError(field);
    }
  }
  return result;
}

export function redactPluginText(text: string, config: Record<string, unknown>, manifest: { configSchema?: unknown }): string {
  let result = text;
  for (const field of secretFields(manifest)) {
    const value = config[field];
    if (typeof value === 'string' && value.length >= 4) {
      result = result.replaceAll(value, '***');
    }
  }
  return result;
}
