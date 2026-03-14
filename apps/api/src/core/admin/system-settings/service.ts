/**
 * System Settings Service
 * Handles platform-wide configuration settings using Prisma
 */

import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';

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
        delete sanitized['general.currency'];
        delete sanitized['admin.localization.currency'];
        const currency = sanitized['localization.currency'];
        if (typeof currency !== 'string' || currency.trim().length === 0) {
            sanitized['localization.currency'] = 'USD';
        }
        return sanitized;
    }

    /**
     * Helper to get full settings object from DB (with cache)
     */
    private async getSettingsObject(): Promise<Record<string, any>> {
        // Try cache first
        const cached = await CacheService.get<Record<string, any>>(SETTINGS_CACHE_KEY);
        if (cached) {
            return cached;
        }

        const system = await prisma.systemSettings.findUnique({
            where: { id: SYSTEM_ID }
        });

        if (!system?.settings) return {};
        try {
            const parsed = typeof system.settings === 'string'
                ? JSON.parse(system.settings)
                : system.settings;
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                return {};
            }
            const settings = this.sanitizeSettings(parsed as Record<string, any>);
            // Cache for TTL seconds
            await CacheService.set(SETTINGS_CACHE_KEY, settings, { ttl: CACHE_TTL });
            return settings;
        } catch {
            return {};
        }
    }

    /**
     * Helper to save full settings object to DB (and invalidate cache)
     */
    private async saveSettingsObject(settings: Record<string, any>) {
        const sanitized = this.sanitizeSettings(settings);
        await prisma.systemSettings.upsert({
            where: { id: SYSTEM_ID },
            update: { settings: sanitized },
            create: {
                id: SYSTEM_ID,
                settings: sanitized,
                siteName: 'Jiffoo Mall'
            }
        });
        // Invalidate cache after update
        await CacheService.delete(SETTINGS_CACHE_KEY);
        await CacheService.delete(LOCALIZATION_CACHE_KEY);
        // Bump store context version so /api/store/context cache refreshes
        await CacheService.incrementStoreContextVersion();
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
            locale: settings['localization.locale'] || 'en-US',
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
    async batchUpdate(updates: Record<string, SettingValue>): Promise<Record<string, any>> {
        const settings = await this.getSettingsObject();
        Object.assign(settings, updates);
        await this.saveSettingsObject(settings);

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

        if (normalized.length === 0) {
            return Array.from(DEFAULT_COUNTRIES_REQUIRE_STATE_POSTAL);
        }

        return Array.from(new Set(normalized));
    }
}

export const systemSettingsService = new SystemSettingsService();
