/**
 * Theme Utilities
 * Shared utilities for theme initialization and management
 */

import { prisma } from '@/config/database';
import { clearMallContextCacheForTenant } from '@/core/mall/context/cache';

/**
 * Default theme configuration
 * This is the standard theme data structure used across the system
 */
export const DEFAULT_THEME_CONFIG = {
  slug: 'default',
  config: {
    brand: {
      primaryColor: '#3B82F6'
    },
    features: {
      showWishlist: true
    }
  },
  version: '1.0.0',
  pluginSlug: 'shop-theme-default'
};

/**
 * Initialize default theme for a tenant
 * This function:
 * 1. Finds the default theme plugin
 * 2. Installs it for the tenant (if not already installed)
 * 3. Updates the tenant's theme field with unified JSON structure
 * 4. Clears the mall context cache
 * 
 * @param tenantId - Tenant ID to initialize theme for
 * @param options - Optional configuration
 * @returns True if successful, false otherwise
 */
export async function initializeDefaultTheme(
  tenantId: number,
  options: {
    skipCacheClear?: boolean;
    logger?: (message: string) => void;
  } = {}
): Promise<boolean> {
  const log = options.logger || console.log;
  
  try {
    // Find default theme plugin
    const themePlugin = await prisma.plugin.findUnique({
      where: { slug: 'shop-theme-default' }
    });

    if (!themePlugin) {
      log(`⚠️ Default theme plugin not found for tenant ${tenantId}`);
      return false;
    }

    // Install default theme plugin (upsert to handle re-initialization)
    await prisma.pluginInstallation.upsert({
      where: {
        tenantId_pluginId: {
          tenantId,
          pluginId: themePlugin.id
        }
      },
      update: {
        status: 'ACTIVE',
        enabled: true
      },
      create: {
        tenantId,
        pluginId: themePlugin.id,
        status: 'ACTIVE',
        enabled: true,
        configData: JSON.stringify({})
      }
    });

    log(`✅ Default theme plugin installed for tenant ${tenantId}`);

    // Update tenant's theme field with unified JSON structure
    const themeData = {
      ...DEFAULT_THEME_CONFIG,
      version: themePlugin.version,
      pluginSlug: themePlugin.slug
    };

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { theme: JSON.stringify(themeData) }
    });

    log(`✅ Tenant ${tenantId} theme initialized: ${JSON.stringify(themeData)}`);

    // Clear mall context cache for this tenant
    if (!options.skipCacheClear) {
      clearMallContextCacheForTenant(tenantId);
      log(`🗑️ Mall context cache cleared for tenant ${tenantId}`);
    }

    return true;
  } catch (error) {
    log(`❌ Failed to initialize default theme for tenant ${tenantId}: ${error}`);
    return false;
  }
}
