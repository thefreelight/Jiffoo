import { ApiError } from '@/utils/api-errors';
/**
 * System Settings Service
 * Handles platform-wide configuration settings using Prisma
 */

import type { SystemSettings } from '@prisma/client';
import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { isStoreTimezone } from 'shared';
import { AuditService } from '@/core/audit/service';
import {
  applyFulfillmentPolicySelection,
  assertFulfillmentPolicySelection,
  clearFulfillmentPolicies,
} from '@/core/shared/fulfillment-policy';

/**
 * The minimal client surface the settings module needs for a column bump.
 */
export type SettingsClient = {
    systemSettings: {
        upsert(args: any): Promise<any>;
    };
};

/**
 * The installation-level columns of the `system_settings` row.
 */
export type InstallationSettingsUpdate = {
    siteDescription?: string;
    faviconUrl?: string;
    maintenanceMode?: boolean;
    allowRegistration?: boolean;
    requireEmailVerification?: boolean;
};

// Keep types compatible with existing code
type SettingValue = string | number | boolean | Record<string, any>;

// Simplified DTO - just KV pairs
// interface SystemSetting removed in favor of direct map usage

const SYSTEM_ID = 'system';
const SETTINGS_CACHE_KEY = 'settings:system';
const LOCALIZATION_CACHE_KEY = 'settings:localization';
const CACHE_TTL = 60; // 60 seconds TTL for settings cache
const CHECKOUT_COUNTRIES_REQUIRE_STATE_POSTAL_KEY = 'checkout.address.countries_require_state_postal';
const DEFAULT_COUNTRIES_REQUIRE_STATE_POSTAL = ['US', 'CA', 'AU', 'CN', 'GB'] as const;
/**
 * The key of the store setting that selects the fulfilment policies of the
 * product types. The value is an object that names a policy of the Core
 * catalogue for a product type, for example `{ "digital": "digital" }`. A
 * store that selects nothing keeps the default policy of every product type.
 */
const FULFILLMENT_POLICIES_KEY = 'fulfillment.policies';

/**
 * Localization context - cached configuration for currency/locale
 */
export interface LocalizationContext {
    currency: string;      // ISO 4217 code (e.g., USD, EUR, JPY)
    locale: string;        // Locale code (e.g., en-US, de-DE)
    timezone: string;      // Timezone (e.g., America/New_York)
}

function normalizeCountryCode(country: string): string {
    const value = country.trim().toUpperCase();
    if (value === 'UK') return 'GB';
    return value;
}

export class SystemSettingsService {
    private sanitizeSettings(settings: Record<string, any>): Record<string, any> {
        const sanitized = { ...settings };
        delete sanitized['branding.store_url'];
        delete sanitized['general.currency'];
        delete sanitized['admin.localization.currency'];
        const currency = sanitized['localization.currency'];
        if (typeof currency !== 'string' || currency.trim().length === 0) {
            sanitized['localization.currency'] = 'USD';
        }
        if (!['en', 'zh-Hans', 'zh-Hant'].includes(sanitized['localization.locale'])) {
            sanitized['localization.locale'] = 'en';
        }
        sanitized['localization.timezone'] ??= 'UTC';
        sanitized['orders.number_prefix'] ??= 'JF';
        return sanitized;
    }

    /**
     * Helper to get full settings object from DB (with cache)
     */
    private async getSettingsObject(): Promise<Record<string, any>> {
        // Try cache first
        const cached = await CacheService.get<Record<string, any>>(SETTINGS_CACHE_KEY);
        if (cached) {
            this.applyReadFulfillmentPolicies(cached);
            return cached;
        }

        const system = await prisma.systemSettings.findUnique({
            where: { id: SYSTEM_ID }
        });

        if (!system?.settings) return this.sanitizeSettings({});
        try {
            const parsed = typeof system.settings === 'string'
                ? JSON.parse(system.settings)
                : system.settings;
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                return this.sanitizeSettings({});
            }
            const settings = this.sanitizeSettings(parsed as Record<string, any>);
            // Cache for TTL seconds
            await CacheService.set(SETTINGS_CACHE_KEY, settings, { ttl: CACHE_TTL });
            this.applyReadFulfillmentPolicies(settings);
            return settings;
        } catch {
            return this.sanitizeSettings({});
        }
    }

    /**
     * Helper to save full settings object to DB (and invalidate cache)
     */
    private async saveSettingsObject(settings: Record<string, any>) {
        const sanitized = this.sanitizeSettings(settings);
        // The fulfilment policy selection is validated before the write, so an
        // invalid selection never reaches the registry.
        this.assertValidFulfillmentSelection(sanitized[FULFILLMENT_POLICIES_KEY]);
        await prisma.systemSettings.upsert({
            where: { id: SYSTEM_ID },
            update: { settings: sanitized },
            create: {
                id: SYSTEM_ID,
                settings: sanitized,
            }
        });
        // Invalidate cache after update
        await CacheService.delete(SETTINGS_CACHE_KEY);
        await CacheService.delete(LOCALIZATION_CACHE_KEY);
        // The selection of the store takes effect without a restart.
        this.applyFulfillmentPolicies(sanitized);
    }

    /**
     * Reject a fulfilment policy selection that the Core catalogue does not
     * know. It is a validation error of the request, never a crash.
     */
    private assertValidFulfillmentSelection(selection: unknown): void {
        if (selection === undefined || selection === null) return;
        try {
            assertFulfillmentPolicySelection(selection);
        } catch {
            throw new ApiError('VALIDATION_ERROR');
        }
    }

    /**
     * Apply the fulfilment policy selection of a settings blob to the
     * fulfilment policy registry.
     *
     * A blob without a selection holds no policy of a product type, so the
     * default policy of every product type applies again.
     */
    private applyFulfillmentPolicies(settings: Record<string, any>): void {
        const selection = settings[FULFILLMENT_POLICIES_KEY];
        if (selection === undefined || selection === null) {
            clearFulfillmentPolicies();
            return;
        }
        applyFulfillmentPolicySelection(selection);
    }

    /**
     * Apply the fulfilment policy selection of a settings blob that is read.
     *
     * Every process that reads the store settings picks the current
     * selection up here, so a process that did not write the setting applies
     * it as well and does not keep an older selection until it restarts.
     *
     * A blob without a selection is not applied here: the write path owns
     * the removal of a selection, so a read never drops the policies of the
     * store. A selection the catalogue does not know is ignored, so a read
     * never fails and never leaves the registry half applied.
     */
    private applyReadFulfillmentPolicies(settings: Record<string, any>): void {
        const selection = settings[FULFILLMENT_POLICIES_KEY];
        if (selection === undefined || selection === null) return;
        try {
            applyFulfillmentPolicySelection(selection);
        } catch {
            // The registry keeps the policies it holds.
        }
    }

    /**
     * Apply the fulfilment policy selection of the store settings to the
     * fulfilment policy registry.
     *
     * The processes call this at boot, so the registry of a running process
     * holds the selection of the store before anything is served.
     */
    async syncFulfillmentPolicies(): Promise<void> {
        const settings = await this.getSettingsObject();
        this.applyFulfillmentPolicies(settings);
    }

    /**
     * Persist the settings blob exactly as the caller composed it.
     *
     * The blob is stored verbatim (no sanitising), so a module that owns one
     * dedicated key inside the settings JSON can write it without the settings
     * module rewriting the other keys. The `system_settings` row keeps a
     * single writer: the settings module.
     */
    async saveSettingsBlob(settings: Record<string, any>): Promise<void> {
        this.assertValidFulfillmentSelection(settings[FULFILLMENT_POLICIES_KEY]);
        await prisma.systemSettings.update({
            where: { id: SYSTEM_ID },
            data: { settings: JSON.stringify(settings) },
        });
        this.applyFulfillmentPolicies(settings);
    }

    /**
     * Mark the platform as installed and store the installation settings.
     */
    async completeInstallation(tx: SettingsClient, installation: {
        installedBy: string;
        siteDescription?: string;
        settings: Record<string, any>;
        version: string;
    }): Promise<void> {
        this.assertValidFulfillmentSelection(installation.settings[FULFILLMENT_POLICIES_KEY]);
        const data = {
            isInstalled: true, installedAt: new Date(),
            installedBy: installation.installedBy, siteDescription: installation.siteDescription,
            settings: installation.settings, version: installation.version,
        };
        await tx.systemSettings.upsert({
            where: { id: SYSTEM_ID },
            create: { id: SYSTEM_ID, ...data },
            update: data,
        });
        this.applyFulfillmentPolicies(installation.settings);
    }

    /**
     * Update the installation-level flags of the `system_settings` row.
     */
    async updateInstallationSettings(data: InstallationSettingsUpdate): Promise<SystemSettings> {
        return prisma.systemSettings.update({
            where: { id: SYSTEM_ID },
            data,
        });
    }

    /**
     * Bump the plugin registry version counter of the `system_settings` row.
     */
    async incrementPluginRegistryVersion(client: SettingsClient): Promise<void> {
        await client.systemSettings.upsert({
            where: { id: SYSTEM_ID },
            create: { id: SYSTEM_ID, pluginRegistryVersion: 1 },
            update: { pluginRegistryVersion: { increment: 1 } },
        });
    }

    /**
     * Get localization context (currency, locale, timezone) - cached
     * Use this for all money formatting operations
     */
    async getLocalizationContext(): Promise<LocalizationContext> {
        // Try cache first
        const cached = await CacheService.get<LocalizationContext>(LOCALIZATION_CACHE_KEY);
        if (cached) {
            return cached;
        }

        const settings = await this.getSettingsObject();
        const context: LocalizationContext = {
            currency: settings['localization.currency'] || 'USD',
            locale: settings['localization.locale'] || 'en',
            timezone: settings['localization.timezone'] || 'UTC'
        };

        // Cache for TTL seconds
        await CacheService.set(LOCALIZATION_CACHE_KEY, context, { ttl: CACHE_TTL });
        return context;
    }

    /**
     * Get currency code - optimized single-value accessor
     */
    async getCurrency(): Promise<string> {
        return this.getShopCurrency();
    }

    /**
     * Get shop currency from localization settings
     */
    async getShopCurrency(): Promise<string> {
        const context = await this.getLocalizationContext();
        return context.currency;
    }

    /**
     * Get shop locale from localization settings
     */
    async getShopLocale(): Promise<string> {
        const context = await this.getLocalizationContext();
        return context.locale;
    }

    /**
     * Get localization timezone
     */
    async getTimezone(): Promise<string> {
        const context = await this.getLocalizationContext();
        return context.timezone;
    }

    /**
     * Get all settings
     */
    async getAllSettings(): Promise<Record<string, any>> {
        return this.getSettingsObject();
    }

    /**
     * Get a single setting
     */
    async getSetting(key: string): Promise<SettingValue | null> {
        const settings = await this.getSettingsObject();
        return settings[key] ?? null;
    }

    /**
     * Get setting (Deprecated metadata wrapper, now just returns value)
     */
    async getSettingFull(key: string): Promise<any> {
        return this.getSetting(key);
    }

    /**
     * Set a single setting
     */
    async setSetting(key: string, value: SettingValue): Promise<void> {
        if (key === 'orders.number_prefix' && (typeof value !== 'string' || !/^[A-Z]{2,6}$(?![\s\S])/.test(value))) throw new ApiError('VALIDATION_ERROR');
        if (key === 'localization.timezone' && !isStoreTimezone(value)) throw new ApiError('VALIDATION_ERROR');
        if (key === 'branding.store_url') throw new ApiError('BAD_REQUEST');
        if (key === 'localization.locale' && !['en', 'zh-Hans', 'zh-Hant'].includes(String(value))) {
            throw new ApiError('BAD_REQUEST');
        }
        this.assertValidFulfillmentSelection(key === FULFILLMENT_POLICIES_KEY ? value : undefined);
        const settings = await this.getSettingsObject();
        settings[key] = value;
        await this.saveSettingsObject(settings);
    }

    /**
     * Get settings by category - returns Map
     */
    async getSettingsByCategory(category: string): Promise<Record<string, any>> {
        const settings = await this.getSettingsObject();
        return Object.keys(settings)
            .filter(k => k.startsWith(category + '.'))
            .reduce((obj, k) => {
                obj[k] = settings[k];
                return obj;
            }, {} as Record<string, any>);
    }

    /**
     * Batch update settings - returns full settings Map
     */
    async batchUpdate(updates: Record<string, SettingValue>, actorId?: string): Promise<Record<string, any>> {
        if ('orders.number_prefix' in updates && (typeof updates['orders.number_prefix'] !== 'string' || !/^[A-Z]{2,6}$(?![\s\S])/.test(updates['orders.number_prefix']))) throw new ApiError('VALIDATION_ERROR');
        if ('localization.timezone' in updates && !isStoreTimezone(updates['localization.timezone'])) throw new ApiError('VALIDATION_ERROR');
        if ('branding.store_url' in updates) throw new ApiError('BAD_REQUEST');
        if ('localization.locale' in updates && !['en', 'zh-Hans', 'zh-Hant'].includes(String(updates['localization.locale']))) {
            throw new ApiError('BAD_REQUEST');
        }
        if (FULFILLMENT_POLICIES_KEY in updates) this.assertValidFulfillmentSelection(updates[FULFILLMENT_POLICIES_KEY]);
        const settings = await prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM public.system_settings WHERE id = 'system' FOR UPDATE`;
            const system = await tx.systemSettings.findUnique({ where: { id: SYSTEM_ID } });
            const before = this.sanitizeSettings(system?.settings && typeof system.settings === 'object' ? system.settings as Record<string, any> : {});
            const next = this.sanitizeSettings({ ...before, ...updates });
            await tx.systemSettings.upsert({ where: { id: SYSTEM_ID }, update: { settings: next }, create: { id: SYSTEM_ID, settings: next } });
            if (before['localization.timezone'] !== next['localization.timezone']) {
                if (!actorId) throw new ApiError('VALIDATION_ERROR');
                await AuditService.write(tx, { actorId, action: 'STORE_TIMEZONE_CHANGED', targetType: 'settings', targetId: 'localization.timezone',
                    summary: { from: before['localization.timezone'], to: next['localization.timezone'] } });
            }
            return next;
        });
        await CacheService.delete(SETTINGS_CACHE_KEY); await CacheService.delete(LOCALIZATION_CACHE_KEY);
        // The selection of the store takes effect without a restart.
        this.applyFulfillmentPolicies(settings);
        return settings;
    }

    /**
     * Reset setting to default (Mocked defaults)
     */
    async resetSetting(key: string): Promise<any> {
        // For Alpha, we don't have a real defaults map yet.
        // We'll just remove it for now as a "reset"
        const settings = await this.getSettingsObject();
        delete settings[key];
        await this.saveSettingsObject(settings);
        return null;
    }

    /**
     * Reset all settings
     */
    async resetAllSettings(): Promise<void> {
        await this.saveSettingsObject({});
    }

    /**
     * Export settings
     */
    async exportSettings(): Promise<Record<string, any>> {
        return this.getSettingsObject();
    }

    /**
     * Import settings
     */
    async importSettings(data: Record<string, any>): Promise<number> {
        await this.saveSettingsObject(data);
        return Object.keys(data).length;
    }

    // Typed Getters
    async getNumber(key: string, defaultValue: number = 0): Promise<number> {
        const val = await this.getSetting(key);
        return typeof val === 'number' ? val : defaultValue;
    }

    async getString(key: string, defaultValue: string = ''): Promise<string> {
        const val = await this.getSetting(key);
        return typeof val === 'string' ? val : defaultValue;
    }

    async getBoolean(key: string, defaultValue: boolean = false): Promise<boolean> {
        const val = await this.getSetting(key);
        return typeof val === 'boolean' ? val : defaultValue;
    }

    async getCheckoutCountriesRequireStatePostal(): Promise<string[]> {
        const val = await this.getSetting(CHECKOUT_COUNTRIES_REQUIRE_STATE_POSTAL_KEY);
        const source = Array.isArray(val) ? val : Array.from(DEFAULT_COUNTRIES_REQUIRE_STATE_POSTAL);
        const normalized = source
            .filter((item): item is string => typeof item === 'string')
            .map((item) => normalizeCountryCode(item))
            .filter((item) => item.length > 0);

        return Array.from(new Set(normalized));
    }
}

export const systemSettingsService = new SystemSettingsService();
