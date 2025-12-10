/**
 * Jiffoo Plugin SDK - Validators
 *
 * Validation utilities for plugin manifests and settings schemas.
 */

import type { PluginManifest } from './types';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validation error
 */
export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

/**
 * Valid plugin categories
 */
export const VALID_CATEGORIES = [
  'payment',
  'email',
  'integration',
  'theme',
  'analytics',
  'marketing',
  'shipping',
  'seo',
  'social',
  'security',
  'other'
] as const;

/**
 * Valid capability types
 */
export const VALID_CAPABILITIES = [
  'payment.process',
  'payment.refund',
  'email.send',
  'email.template',
  'auth.oauth',
  'auth.sso',
  'webhook.receive',
  'webhook.send',
  'storage.upload',
  'storage.download',
  'analytics.track',
  'analytics.report',
  'shipping.calculate',
  'shipping.track',
  'seo.sitemap',
  'seo.meta',
  'social.share',
  'social.login'
] as const;

/**
 * Validate plugin manifest
 */
export function validateManifest(manifest: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!manifest || typeof manifest !== 'object') {
    return {
      valid: false,
      errors: [{ path: '', message: 'Manifest must be an object', code: 'INVALID_TYPE' }]
    };
  }

  const m = manifest as Record<string, unknown>;

  // Required fields
  if (!m.slug || typeof m.slug !== 'string') {
    errors.push({ path: 'slug', message: 'slug is required and must be a string', code: 'REQUIRED' });
  } else if (!/^[a-z0-9-]+$/.test(m.slug)) {
    errors.push({ path: 'slug', message: 'slug must be lowercase alphanumeric with hyphens', code: 'INVALID_FORMAT' });
  }

  if (!m.name || typeof m.name !== 'string') {
    errors.push({ path: 'name', message: 'name is required and must be a string', code: 'REQUIRED' });
  }

  if (!m.version || typeof m.version !== 'string') {
    errors.push({ path: 'version', message: 'version is required and must be a string', code: 'REQUIRED' });
  } else if (!/^\d+\.\d+\.\d+/.test(m.version)) {
    errors.push({ path: 'version', message: 'version must follow semver format (x.y.z)', code: 'INVALID_FORMAT' });
  }

  if (!m.description || typeof m.description !== 'string') {
    errors.push({ path: 'description', message: 'description is required and must be a string', code: 'REQUIRED' });
  }

  if (!m.author || typeof m.author !== 'string') {
    errors.push({ path: 'author', message: 'author is required and must be a string', code: 'REQUIRED' });
  }

  if (!m.category || typeof m.category !== 'string') {
    errors.push({ path: 'category', message: 'category is required and must be a string', code: 'REQUIRED' });
  } else if (!VALID_CATEGORIES.includes(m.category as any)) {
    errors.push({ path: 'category', message: `category must be one of: ${VALID_CATEGORIES.join(', ')}`, code: 'INVALID_VALUE' });
  }

  // Capabilities
  if (!Array.isArray(m.capabilities)) {
    errors.push({ path: 'capabilities', message: 'capabilities must be an array', code: 'INVALID_TYPE' });
  } else if (m.capabilities.length === 0) {
    errors.push({ path: 'capabilities', message: 'capabilities must have at least one item', code: 'EMPTY_ARRAY' });
  }

  // Optional webhooks
  if (m.webhooks !== undefined) {
    if (typeof m.webhooks !== 'object' || m.webhooks === null) {
      errors.push({ path: 'webhooks', message: 'webhooks must be an object', code: 'INVALID_TYPE' });
    } else {
      const wh = m.webhooks as Record<string, unknown>;
      if (!Array.isArray(wh.events)) {
        errors.push({ path: 'webhooks.events', message: 'webhooks.events must be an array', code: 'INVALID_TYPE' });
      }
      if (typeof wh.url !== 'string') {
        errors.push({ path: 'webhooks.url', message: 'webhooks.url must be a string', code: 'INVALID_TYPE' });
      }
    }
  }

  // Optional configSchema
  if (m.configSchema !== undefined) {
    const schemaResult = validateSettingsSchema(m.configSchema);
    if (!schemaResult.valid) {
      errors.push(...schemaResult.errors.map(e => ({
        ...e,
        path: `configSchema.${e.path}`
      })));
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Settings field types
 */
export type SettingsFieldType = 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'secret' | 'url' | 'email';

/**
 * Settings field definition
 */
export interface SettingsField {
  type: SettingsFieldType;
  label: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

/**
 * Settings schema definition
 */
export interface SettingsSchema {
  [key: string]: SettingsField;
}

/**
 * Validate settings schema
 */
export function validateSettingsSchema(schema: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!schema || typeof schema !== 'object') {
    return {
      valid: false,
      errors: [{ path: '', message: 'Settings schema must be an object', code: 'INVALID_TYPE' }]
    };
  }

  const s = schema as Record<string, unknown>;
  const validTypes: SettingsFieldType[] = ['string', 'number', 'boolean', 'select', 'multiselect', 'secret', 'url', 'email'];

  for (const [key, field] of Object.entries(s)) {
    if (!field || typeof field !== 'object') {
      errors.push({ path: key, message: 'Field must be an object', code: 'INVALID_TYPE' });
      continue;
    }

    const f = field as Record<string, unknown>;

    if (!f.type || typeof f.type !== 'string') {
      errors.push({ path: `${key}.type`, message: 'type is required', code: 'REQUIRED' });
    } else if (!validTypes.includes(f.type as SettingsFieldType)) {
      errors.push({ path: `${key}.type`, message: `type must be one of: ${validTypes.join(', ')}`, code: 'INVALID_VALUE' });
    }

    if (!f.label || typeof f.label !== 'string') {
      errors.push({ path: `${key}.label`, message: 'label is required', code: 'REQUIRED' });
    }

    // Validate select/multiselect options
    if ((f.type === 'select' || f.type === 'multiselect') && !Array.isArray(f.options)) {
      errors.push({ path: `${key}.options`, message: 'options is required for select/multiselect', code: 'REQUIRED' });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate settings values against schema
 */
export function validateSettings(schema: SettingsSchema, values: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];

  for (const [key, field] of Object.entries(schema)) {
    const value = values[key];

    // Check required
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push({ path: key, message: `${field.label} is required`, code: 'REQUIRED' });
      continue;
    }

    if (value === undefined || value === null) continue;

    // Type validation
    switch (field.type) {
      case 'string':
      case 'secret':
        if (typeof value !== 'string') {
          errors.push({ path: key, message: `${field.label} must be a string`, code: 'INVALID_TYPE' });
        }
        break;
      case 'number':
        if (typeof value !== 'number') {
          errors.push({ path: key, message: `${field.label} must be a number`, code: 'INVALID_TYPE' });
        } else {
          if (field.validation?.min !== undefined && value < field.validation.min) {
            errors.push({ path: key, message: field.validation.message || `${field.label} must be at least ${field.validation.min}`, code: 'MIN' });
          }
          if (field.validation?.max !== undefined && value > field.validation.max) {
            errors.push({ path: key, message: field.validation.message || `${field.label} must be at most ${field.validation.max}`, code: 'MAX' });
          }
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push({ path: key, message: `${field.label} must be a boolean`, code: 'INVALID_TYPE' });
        }
        break;
      case 'url':
        if (typeof value !== 'string' || !isValidUrl(value)) {
          errors.push({ path: key, message: `${field.label} must be a valid URL`, code: 'INVALID_FORMAT' });
        }
        break;
      case 'email':
        if (typeof value !== 'string' || !isValidEmail(value)) {
          errors.push({ path: key, message: `${field.label} must be a valid email`, code: 'INVALID_FORMAT' });
        }
        break;
      case 'select':
        if (!field.options?.some(o => o.value === value)) {
          errors.push({ path: key, message: `${field.label} must be one of the available options`, code: 'INVALID_VALUE' });
        }
        break;
      case 'multiselect':
        if (!Array.isArray(value)) {
          errors.push({ path: key, message: `${field.label} must be an array`, code: 'INVALID_TYPE' });
        } else {
          const validValues = field.options?.map(o => o.value) || [];
          for (const v of value) {
            if (!validValues.includes(v)) {
              errors.push({ path: key, message: `${field.label} contains invalid option: ${v}`, code: 'INVALID_VALUE' });
            }
          }
        }
        break;
    }

    // Pattern validation
    if (field.validation?.pattern && typeof value === 'string') {
      const regex = new RegExp(field.validation.pattern);
      if (!regex.test(value)) {
        errors.push({ path: key, message: field.validation.message || `${field.label} format is invalid`, code: 'PATTERN' });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

function isValidEmail(str: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

