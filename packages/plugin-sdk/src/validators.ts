/**
 * Jiffoo Plugin SDK - Validators
 *
 * Validation utilities for plugin manifests and settings.
 */

import { PluginManifest, PluginConfig } from './types';

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
 * Valid plugin capabilities
 */
export const VALID_CAPABILITIES = [
    'webhook.receive',
    'webhook.send',
    'api.read',
    'api.write',
    'admin.panel',
    'storefront.widget',
    'checkout.modify',
    'order.process',
    'payment.process',
    'shipping.calculate',
    'email.send',
    'sms.send',
    'analytics.track',
    'customer.sync',
    'inventory.sync',
    'product.sync'
] as const;

/**
 * Validation error
 */
export interface ValidationError {
    path: string;
    message: string;
    code: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}

/**
 * Settings field types
 */
export type SettingsFieldType =
    | 'string'
    | 'number'
    | 'boolean'
    | 'select'
    | 'multiselect'
    | 'password'
    | 'url'
    | 'email'
    | 'textarea';

/**
 * Settings field definition
 */
export interface SettingsField {
    key: string;
    type: SettingsFieldType;
    label: string;
    description?: string;
    required?: boolean;
    default?: any;
    options?: { value: string; label: string }[];
    validation?: {
        min?: number;
        max?: number;
        pattern?: string;
    };
}

/**
 * Settings schema
 */
export interface SettingsSchema {
    fields: SettingsField[];
}

/**
 * Validate a plugin manifest
 */
export function validateManifest(manifest: Partial<PluginManifest | PluginConfig>): ValidationResult {
    const errors: ValidationError[] = [];

    // Required fields
    if (!manifest.slug) {
        errors.push({ path: 'slug', message: 'Plugin slug is required', code: 'REQUIRED' });
    } else if (!/^[a-z0-9-]+$/.test(manifest.slug)) {
        errors.push({ path: 'slug', message: 'Slug must be lowercase alphanumeric with hyphens', code: 'FORMAT' });
    }

    if (!manifest.name) {
        errors.push({ path: 'name', message: 'Plugin name is required', code: 'REQUIRED' });
    }

    if (!manifest.version) {
        errors.push({ path: 'version', message: 'Plugin version is required', code: 'REQUIRED' });
    } else if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
        errors.push({ path: 'version', message: 'Version must follow semver format', code: 'FORMAT' });
    }

    if (!manifest.category) {
        errors.push({ path: 'category', message: 'Plugin category is required', code: 'REQUIRED' });
    } else if (!VALID_CATEGORIES.includes(manifest.category as any)) {
        errors.push({
            path: 'category',
            message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
            code: 'INVALID'
        });
    }

    if (!manifest.capabilities || !Array.isArray(manifest.capabilities)) {
        errors.push({ path: 'capabilities', message: 'Plugin capabilities array is required', code: 'REQUIRED' });
    } else {
        manifest.capabilities.forEach((cap, index) => {
            if (!VALID_CAPABILITIES.includes(cap as any)) {
                errors.push({
                    path: `capabilities[${index}]`,
                    message: `Invalid capability: ${cap}`,
                    code: 'INVALID'
                });
            }
        });
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate settings schema
 */
export function validateSettingsSchema(schema: SettingsSchema): ValidationResult {
    const errors: ValidationError[] = [];

    if (!schema.fields || !Array.isArray(schema.fields)) {
        errors.push({ path: 'fields', message: 'Settings schema must have fields array', code: 'REQUIRED' });
        return { valid: false, errors };
    }

    schema.fields.forEach((field, index) => {
        if (!field.key) {
            errors.push({ path: `fields[${index}].key`, message: 'Field key is required', code: 'REQUIRED' });
        }
        if (!field.type) {
            errors.push({ path: `fields[${index}].type`, message: 'Field type is required', code: 'REQUIRED' });
        }
        if (!field.label) {
            errors.push({ path: `fields[${index}].label`, message: 'Field label is required', code: 'REQUIRED' });
        }
        if (field.type === 'select' || field.type === 'multiselect') {
            if (!field.options || !Array.isArray(field.options) || field.options.length === 0) {
                errors.push({ path: `fields[${index}].options`, message: 'Select fields must have options', code: 'REQUIRED' });
            }
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate settings values against schema
 */
export function validateSettings(
    settings: Record<string, any>,
    schema: SettingsSchema
): ValidationResult {
    const errors: ValidationError[] = [];

    for (const field of schema.fields) {
        const value = settings[field.key];

        // Check required
        if (field.required && (value === undefined || value === null || value === '')) {
            errors.push({ path: field.key, message: `${field.label} is required`, code: 'REQUIRED' });
            continue;
        }

        if (value === undefined || value === null) continue;

        // Type-specific validation
        switch (field.type) {
            case 'number':
                if (typeof value !== 'number') {
                    errors.push({ path: field.key, message: `${field.label} must be a number`, code: 'TYPE' });
                } else if (field.validation) {
                    if (field.validation.min !== undefined && value < field.validation.min) {
                        errors.push({ path: field.key, message: `${field.label} must be at least ${field.validation.min}`, code: 'MIN' });
                    }
                    if (field.validation.max !== undefined && value > field.validation.max) {
                        errors.push({ path: field.key, message: `${field.label} must be at most ${field.validation.max}`, code: 'MAX' });
                    }
                }
                break;

            case 'url':
                try {
                    new URL(value);
                } catch {
                    errors.push({ path: field.key, message: `${field.label} must be a valid URL`, code: 'FORMAT' });
                }
                break;

            case 'email':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    errors.push({ path: field.key, message: `${field.label} must be a valid email`, code: 'FORMAT' });
                }
                break;

            case 'select':
                if (!field.options?.some(opt => opt.value === value)) {
                    errors.push({ path: field.key, message: `${field.label} has invalid selection`, code: 'INVALID' });
                }
                break;

            case 'multiselect':
                if (!Array.isArray(value)) {
                    errors.push({ path: field.key, message: `${field.label} must be an array`, code: 'TYPE' });
                } else {
                    value.forEach((v: string) => {
                        if (!field.options?.some(opt => opt.value === v)) {
                            errors.push({ path: field.key, message: `${field.label} contains invalid selection: ${v}`, code: 'INVALID' });
                        }
                    });
                }
                break;
        }

        // Pattern validation
        if (field.validation?.pattern && typeof value === 'string') {
            const regex = new RegExp(field.validation.pattern);
            if (!regex.test(value)) {
                errors.push({ path: field.key, message: `${field.label} format is invalid`, code: 'FORMAT' });
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
