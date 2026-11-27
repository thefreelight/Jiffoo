/**
 * Shared helpers for schema-driven plugin configuration forms. The native
 * plugin catalog describes settings as a flat `configSchema`; these helpers
 * read it the same way for readiness checks, draft seeding, and field labels.
 */

import { localizePluginConfigLabel, localizePluginConfigPlaceholder } from '@/lib/extension-catalog-zh';
import type { PluginConfigMeta } from '@/lib/types';

export type PluginConfigDescriptor = {
  type?: string;
  label?: string;
  description?: string;
  required?: boolean;
  enum?: string[];
  placeholder?: string;
};

export type PluginConfigSchema = Record<string, PluginConfigDescriptor>;

export type PluginConfigReadiness = {
  configRequired: boolean;
  configReady: boolean;
  missingConfigFields: string[];
};

export function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getDescriptorType(descriptor: PluginConfigDescriptor | undefined): string {
  return typeof descriptor?.type === 'string' ? descriptor.type : 'string';
}

export function getConfigFieldLabel(
  slug: string,
  locale: string,
  field: string,
  descriptor: PluginConfigDescriptor | undefined,
): string {
  const fallback = descriptor?.label || field;
  return localizePluginConfigLabel(slug, field, fallback, locale);
}

/** The hint inside an empty settings field, in the store's language. */
export function getConfigFieldPlaceholder(
  slug: string,
  locale: string,
  field: string,
  descriptor: PluginConfigDescriptor | undefined,
): string | undefined {
  return localizePluginConfigPlaceholder(slug, field, descriptor?.placeholder ?? '', locale) || undefined;
}

export function buildJsonFieldDrafts(
  schema: PluginConfigSchema | undefined,
  config: Record<string, unknown>
): Record<string, string> {
  if (!schema) return {};

  return Object.fromEntries(
    Object.entries(schema)
      .filter(([, descriptor]) => {
        const type = getDescriptorType(descriptor);
        return type === 'object' || type === 'array';
      })
      .map(([key, descriptor]) => {
        const type = getDescriptorType(descriptor);
        const fallback = type === 'array' ? [] : {};
        return [key, JSON.stringify(config[key] ?? fallback, null, 2)];
      })
  );
}

/**
 * A required field counts as satisfied when it holds a non-empty value of its
 * declared type, or — for secrets — when the instance already has one stored
 * (secrets are never echoed back to the browser).
 */
export function evaluateConfigReadiness(
  configSchema: PluginConfigSchema | undefined,
  config: Record<string, unknown>,
  configMeta?: PluginConfigMeta
): PluginConfigReadiness {
  if (!configSchema || Object.keys(configSchema).length === 0) {
    return {
      configRequired: false,
      configReady: true,
      missingConfigFields: [],
    };
  }

  const missingConfigFields: string[] = [];
  let configRequired = false;

  for (const [key, descriptor] of Object.entries(configSchema)) {
    if (!descriptor?.required) {
      continue;
    }

    configRequired = true;
    const value = config[key];
    const type = getDescriptorType(descriptor);
    const secretConfigured = Boolean(configMeta?.secretFields?.[key]?.configured);

    if (value === undefined || value === null) {
      if (type === 'secret' && secretConfigured) {
        continue;
      }
      missingConfigFields.push(key);
      continue;
    }

    if (type === 'string' && (typeof value !== 'string' || value.trim().length === 0)) {
      missingConfigFields.push(key);
      continue;
    }

    if (type === 'secret' && ((typeof value !== 'string' || value.trim().length === 0) && !secretConfigured)) {
      missingConfigFields.push(key);
      continue;
    }

    if (type === 'object' && (!isPlainObject(value) || Object.keys(value).length === 0)) {
      missingConfigFields.push(key);
      continue;
    }

    if (type === 'array' && (!Array.isArray(value) || value.length === 0)) {
      missingConfigFields.push(key);
      continue;
    }
  }

  return {
    configRequired,
    configReady: !configRequired || missingConfigFields.length === 0,
    missingConfigFields,
  };
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * Deep equality for plain config values. Keys are compared unordered so a
 * server echo that serializes the same object differently never reads as an
 * unsaved edit.
 */
export function isSameConfigValue(a: unknown, b: unknown): boolean {
  return stableSerialize(a) === stableSerialize(b);
}
