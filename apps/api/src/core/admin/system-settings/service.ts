/**
 * System Settings Service
 * Handles platform-wide configuration settings using Prisma
 */

import { prisma } from '@/config/database';

// Keep types compatible with existing code
type SettingValue = string | number | boolean | Record<string, any>;

interface SystemSetting {
    key: string;
    value: SettingValue;
    type: 'string' | 'number' | 'boolean' | 'json';
    category: 'payment' | 'subscription' | 'branding' | 'general' | 'theme';
    label: string;
    description?: string;
    updatedAt: Date;
}

const SYSTEM_ID = 'system';

export class SystemSettingsService {

    /**
     * Helper to get full settings object from DB
     */
    private async getSettingsObject(): Promise<Record<string, any>> {
        const system = await prisma.systemSettings.findUnique({
            where: { id: SYSTEM_ID }
        });

        if (!system?.settings) return {};
        try {
            return typeof system.settings === 'string'
                ? JSON.parse(system.settings)
                : system.settings;
        } catch {
            return {};
        }
    }

    /**
     * Helper to save full settings object to DB
     */
    private async saveSettingsObject(settings: Record<string, any>) {
        await prisma.systemSettings.upsert({
            where: { id: SYSTEM_ID },
            update: { settings: JSON.stringify(settings) },
            create: {
                id: SYSTEM_ID,
                settings: JSON.stringify(settings),
                siteName: 'Jiffoo Mall'
            }
        });
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
     * Get setting with metadata (Mocked metadata for now)
     */
    async getSettingFull(key: string): Promise<SystemSetting | null> {
        const val = await this.getSetting(key);
        if (val === null) return null;

        return {
            key,
            value: val,
            type: typeof val as any,
            category: (key.split('.')[0] as any) || 'general',
            label: key,
            updatedAt: new Date()
        };
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
     * Get settings by category
     */
    async getSettingsByCategory(category: string): Promise<SystemSetting[]> {
        const settings = await this.getSettingsObject();
        return Object.entries(settings)
            .filter(([k]) => k.startsWith(category + '.'))
            .map(([k, v]) => ({
                key: k,
                value: v,
                type: typeof v as any,
                category: category as any,
                label: k,
                updatedAt: new Date()
            }));
    }

    /**
     * Batch update settings
     */
    async batchUpdate(updates: Record<string, SettingValue>): Promise<SystemSetting[]> {
        const settings = await this.getSettingsObject();
        Object.assign(settings, updates);
        await this.saveSettingsObject(settings);

        return Object.entries(updates).map(([k, v]) => ({
            key: k,
            value: v,
            type: typeof v as any,
            category: (k.split('.')[0] as any) || 'general',
            label: k,
            updatedAt: new Date()
        }));
    }

    /**
     * Reset setting to default (Mocked defaults)
     */
    async resetSetting(key: string): Promise<SystemSetting | null> {
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
}

export const systemSettingsService = new SystemSettingsService();
