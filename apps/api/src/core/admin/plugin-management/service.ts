import { FastifyInstance } from 'fastify';
import {
  MarketplaceQuery,
  InstalledQuery,
  InstallPluginRequest,
  ConfigurePluginRequest,
  MarketplaceResponse,
  InstalledPluginsResponse,
  PluginInstallationResult,
  PluginConfigData
} from './types';
import { clearMallContextCacheForTenant } from '@/core/mall/context/cache';
import { generateSignature } from '@/utils/signature';

/**
 * Admin Plugin Management Service
 * 
 * This service provides business logic for plugin management operations.
 * It wraps the decorator methods from plugin-registry and plugin-installer
 * and provides additional data transformation and error handling.
 */
export class AdminPluginService {
  
  /**
   * Get marketplace plugins with filtering and sorting
   * 
   * @param fastify - Fastify instance with plugin decorators
   * @param filters - Query filters for marketplace
   * @returns Marketplace response with plugins and total count
   */
  static async getMarketplacePlugins(
    fastify: FastifyInstance,
    filters: MarketplaceQuery = {}
  ): Promise<MarketplaceResponse> {
    try {
      // Call decorator method to get all available plugins
      const plugins = await (fastify as any).getAvailablePlugins();
      
      // Apply filters
      let filtered = plugins;
      
      if (filters.category) {
        filtered = filtered.filter((p: any) => p.category === filters.category);
      }
      
      if (filters.businessModel) {
        filtered = filtered.filter((p: any) => p.businessModel === filters.businessModel);
      }
      
      // Apply sorting
      const sortBy = filters.sortBy || 'name';
      const sortOrder = filters.sortOrder || 'asc';
      
      filtered.sort((a: any, b: any) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        
        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
          return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
      });
      
      return {
        plugins: filtered,
        total: filtered.length
      };
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to get marketplace plugins');
      throw new Error('Failed to retrieve marketplace plugins');
    }
  }
  
  /**
   * Get installed plugins for tenant
   * 
   * @param fastify - Fastify instance with plugin decorators
   * @param tenantId - Tenant ID
   * @param filters - Query filters for installed plugins
   * @returns Installed plugins response with plugins and total count
   */
  static async getInstalledPlugins(
    fastify: FastifyInstance,
    tenantId: number,
    filters: InstalledQuery = {}
  ): Promise<InstalledPluginsResponse> {
    try {
      // Call decorator method to get tenant plugins
      const plugins = await (fastify as any).getTenantPlugins(tenantId);
      
      // Apply filters
      let filtered = plugins;
      
      if (filters.status) {
        filtered = filtered.filter((p: any) => p.status === filters.status);
      }
      
      if (filters.enabled !== undefined) {
        filtered = filtered.filter((p: any) => p.enabled === filters.enabled);
      }
      
      return {
        plugins: filtered,
        total: filtered.length
      };
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to get installed plugins');
      throw new Error('Failed to retrieve installed plugins');
    }
  }
  
  /**
   * Check if a plugin is a theme plugin
   *
   * @param plugin - Plugin object
   * @returns True if plugin is a theme plugin
   */
  private static isThemePlugin(plugin: any): boolean {
    return plugin.category === 'theme' ||
           (plugin.tags && JSON.parse(plugin.tags || '[]').includes('theme'));
  }

  /**
   * Check if a plugin is a license-based plugin (buyout model)
   * These plugins use pluginLicense instead of subscription
   *
   * @param pluginSlug - Plugin slug
   * @returns True if plugin is license-based
   */
  private static isLicensePlugin(pluginSlug: string): boolean {
    const licensePlugins = ['affiliate', 'agent'];
    return licensePlugins.includes(pluginSlug);
  }

  /**
   * Install a license-based plugin (affiliate/agent)
   * These plugins don't use subscription system, they use pluginLicense
   *
   * @param fastify - Fastify instance
   * @param tenantId - Tenant ID
   * @param plugin - Plugin object
   * @param options - Installation options
   * @returns Installation result
   */
  private static async installLicensePlugin(
    fastify: FastifyInstance,
    tenantId: number,
    plugin: any,
    options: InstallPluginRequest = {}
  ): Promise<PluginInstallationResult> {
    // 1. Check if already installed
    const existingInstallation = await fastify.prisma.pluginInstallation.findFirst({
      where: {
        tenantId,
        pluginId: plugin.id
      }
    });

    if (existingInstallation) {
      throw new Error('Plugin is already installed');
    }

    // 2. Check if plugin is active
    if (plugin.status !== 'ACTIVE') {
      throw new Error('Plugin is not available for installation');
    }

    // 3. Check or create license
    // For now, we auto-create ACTIVE license when installing from admin UI
    let license = await fastify.prisma.pluginLicense.findFirst({
      where: {
        tenantId,
        pluginId: plugin.id
      }
    });

    if (!license) {
      // Create new license (admin install = auto-grant license)
      // Only use fields that exist in PluginLicense schema:
      // tenantId, pluginId, status, purchaseDate, activatedAt, amount, currency
      license = await fastify.prisma.pluginLicense.create({
        data: {
          tenantId,
          pluginId: plugin.id,
          status: 'ACTIVE',
          purchaseDate: new Date(),
          activatedAt: new Date(),
          amount: 0, // Admin install = free grant
          currency: 'USD'
        }
      });
      fastify.log.info(`✅ Created license for ${plugin.slug}: ${license.id}`);
    } else if (license.status !== 'ACTIVE') {
      // Reactivate existing license
      license = await fastify.prisma.pluginLicense.update({
        where: { id: license.id },
        data: {
          status: 'ACTIVE',
          activatedAt: new Date()
        }
      });
      fastify.log.info(`✅ Reactivated license for ${plugin.slug}: ${license.id}`);
    }

    // 4. Create plugin installation
    const installation = await fastify.prisma.pluginInstallation.create({
      data: {
        tenantId,
        pluginId: plugin.id,
        status: 'ACTIVE',
        enabled: true,
        installedAt: new Date(),
        configData: options.configData ? JSON.stringify(options.configData) : JSON.stringify({
          licenseId: license.id
        })
      },
      include: {
        plugin: true
      }
    });

    // 5. Update plugin install count
    await fastify.prisma.plugin.update({
      where: { id: plugin.id },
      data: {
        installCount: { increment: 1 }
      }
    });

    fastify.log.info(`✅ License plugin ${plugin.slug} installed for tenant ${tenantId}`);

    return {
      success: true,
      installation: {
        id: installation.id,
        status: installation.status,
        enabled: installation.enabled,
        installedAt: installation.installedAt,
        plugin: {
          id: installation.plugin.id,
          name: installation.plugin.name,
          slug: installation.plugin.slug,
          businessModel: 'buyout' // License-based = buyout model
        }
      },
      message: `${plugin.name} has been successfully installed`
    };
  }

  /**
   * Install a theme plugin
   * Theme plugins don't use subscription system, they use pluginInstallation + tenant.theme
   *
   * @param fastify - Fastify instance
   * @param tenantId - Tenant ID
   * @param plugin - Plugin object
   * @param options - Installation options
   * @returns Installation result
   */
  private static async installThemePlugin(
    fastify: FastifyInstance,
    tenantId: number,
    plugin: any,
    options: InstallPluginRequest = {}
  ): Promise<PluginInstallationResult> {
    // 1. Check if already installed
    const existingInstallation = await fastify.prisma.pluginInstallation.findFirst({
      where: {
        tenantId,
        pluginId: plugin.id
      }
    });

    if (existingInstallation) {
      // Theme already installed, just enable it
      const updatedInstallation = await fastify.prisma.pluginInstallation.update({
        where: { id: existingInstallation.id },
        data: { enabled: true },
        include: { plugin: true }
      });

      // Proceed with theme activation
      return await this.activateTheme(fastify, tenantId, plugin, updatedInstallation);
    }

    // 2. Check if plugin is active
    if (plugin.status !== 'ACTIVE') {
      throw new Error('Plugin is not available for installation');
    }

    // 3. Create plugin installation
    const installation = await fastify.prisma.pluginInstallation.create({
      data: {
        tenantId,
        pluginId: plugin.id,
        status: 'ACTIVE',
        enabled: true,
        installedAt: new Date(),
        configData: options.configData ? JSON.stringify(options.configData) : JSON.stringify({})
      },
      include: {
        plugin: true
      }
    });

    // 4. Update plugin install count
    await fastify.prisma.plugin.update({
      where: { id: plugin.id },
      data: {
        installCount: { increment: 1 }
      }
    });

    // 5. Activate theme
    return await this.activateTheme(fastify, tenantId, plugin, installation);
  }

  /**
   * Activate a theme for tenant (disable other themes, update tenant.theme, clear cache)
   */
  private static async activateTheme(
    fastify: FastifyInstance,
    tenantId: number,
    plugin: any,
    installation: any
  ): Promise<PluginInstallationResult> {
    // 1. Disable all other theme plugins for this tenant
    const otherThemePlugins = await fastify.prisma.pluginInstallation.findMany({
      where: {
        tenantId,
        plugin: { category: 'theme' },
        id: { not: installation.id }
      },
      include: { plugin: true }
    });

    for (const otherInstallation of otherThemePlugins) {
      await fastify.prisma.pluginInstallation.update({
        where: { id: otherInstallation.id },
        data: { enabled: false }
      });
      fastify.log.info(`✅ Disabled theme plugin: ${otherInstallation.plugin.slug}`);
    }

    // 2. Update tenant's theme field with unified JSON structure
    const themeSlug = this.extractThemeSlug(plugin);
    const themeData = {
      slug: themeSlug,
      config: {},
      version: plugin.version,
      pluginSlug: plugin.slug
    };

    await fastify.prisma.tenant.update({
      where: { id: tenantId },
      data: { theme: JSON.stringify(themeData) }
    });

    fastify.log.info(`✅ Tenant theme updated: ${JSON.stringify(themeData)}`);

    // 3. Clear mall context cache for this tenant
    clearMallContextCacheForTenant(tenantId);
    fastify.log.info(`🗑️ Mall context cache cleared for tenant ${tenantId}`);

    fastify.log.info(`✅ Theme plugin ${plugin.slug} installed and activated for tenant ${tenantId}`);

    return {
      success: true,
      installation: {
        id: installation.id,
        status: installation.status,
        enabled: installation.enabled,
        installedAt: installation.installedAt,
        plugin: {
          id: installation.plugin.id,
          name: installation.plugin.name,
          slug: installation.plugin.slug,
          businessModel: 'free' // Theme = free model
        }
      },
      message: `${plugin.name} has been successfully installed and activated`
    };
  }

  /**
   * Install a plugin for tenant
   * 
   * @param fastify - Fastify instance with plugin decorators
   * @param tenantId - Tenant ID
   * @param pluginSlug - Plugin slug
   * @param options - Installation options
   * @returns Installation result
   */
  static async installPlugin(
    fastify: FastifyInstance,
    tenantId: number,
    pluginSlug: string,
    options: InstallPluginRequest = {}
  ): Promise<PluginInstallationResult> {
    try {
      // First, check if this is an external plugin that requires OAuth installation
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: pluginSlug }
      });

      if (!plugin) {
        throw new Error('Plugin not found');
      }

      // Check if external plugin requires OAuth installation
      if (plugin.runtimeType === 'external-http') {
        if (plugin.oauthConfig) {
          const oauthConfig = JSON.parse(plugin.oauthConfig);

          if (oauthConfig.installUrl) {
            // Generate OAuth state for external plugin installation
            const state = this.generateOAuthState(tenantId, plugin.id);

            // Store state in Redis with expiration (30 minutes)
            const stateKey = `oauth:install:${state}`;
            const stateData = {
              tenantId,
              pluginId: plugin.id,
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
            };

            await fastify.redis.setex(stateKey, 30 * 60, JSON.stringify(stateData));

            // Build install URL
            const installUrl = new URL(oauthConfig.installUrl);
            installUrl.searchParams.set('client_id', process.env.PLATFORM_CLIENT_ID || 'jiffoo-platform');
            installUrl.searchParams.set('state', state);
            installUrl.searchParams.set('redirect_uri', oauthConfig.redirectUri || `${process.env.API_URL}/api/admin/plugins/oauth/callback`);
            installUrl.searchParams.set('scope', oauthConfig.scopes || 'read write');

            return {
              success: true,
              installation: null as any,
              requiresOAuth: true,
              oauthUrl: installUrl.toString(),
              message: 'External plugin requires OAuth installation'
            };
          }
        }

        // If no OAuth config, proceed with normal installation
      }

      // ============================================
      // 🆕 Special handling for non-subscription plugins
      // These plugins bypass the standard subscription flow
      // ============================================

      // 1. License-based plugins (affiliate, agent) - use pluginLicense
      if (this.isLicensePlugin(pluginSlug)) {
        fastify.log.info(`📜 License plugin detected: ${pluginSlug}, using license-based installation...`);
        return await this.installLicensePlugin(fastify, tenantId, plugin, options);
      }

      // 2. Theme plugins - use pluginInstallation + tenant.theme
      if (this.isThemePlugin(plugin)) {
        fastify.log.info(`🎨 Theme plugin detected: ${pluginSlug}, using theme-based installation...`);
        return await this.installThemePlugin(fastify, tenantId, plugin, options);
      }

      // ============================================
      // Standard subscription-based plugin installation
      // For plugins with subscription plans (Stripe, Resend, Google, etc.)
      // ============================================

      // Call decorator method to install plugin (for subscription-based plugins)
      const result = await (fastify as any).installPlugin(tenantId, pluginSlug, options);

      return result;
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to install plugin');

      // Re-throw with more specific error messages
      if (error.message === 'Plugin not found') {
        throw new Error('Plugin not found');
      } else if (error.message === 'Plugin is already installed') {
        throw new Error('Plugin is already installed');
      } else if (error.message === 'Plugin is not available for installation') {
        throw new Error('Plugin is not available for installation');
      } else {
        throw new Error('Failed to install plugin');
      }
    }
  }

  /**
   * Generate OAuth state for external plugin installation
   */
  private static generateOAuthState(tenantId: number, pluginId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return Buffer.from(`${tenantId}:${pluginId}:${timestamp}:${random}`).toString('base64url');
  }


  /**
   * Extract theme slug from plugin tags
   * 
   * @param plugin - Plugin object
   * @returns Theme slug (e.g., "default")
   */
  private static extractThemeSlug(plugin: any): string {
    if (plugin.tags) {
      try {
        const tags = JSON.parse(plugin.tags);
        const themeSlugTag = tags.find((tag: string) => tag.startsWith('themeSlug:'));
        if (themeSlugTag) {
          return themeSlugTag.replace('themeSlug:', '');
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    // Fallback: use plugin slug without prefix
    return plugin.slug.replace('shop-theme-', '');
  }
  
  /**
   * Get plugin configuration
   * 
   * @param fastify - Fastify instance with Prisma
   * @param tenantId - Tenant ID
   * @param pluginSlug - Plugin slug
   * @returns Plugin configuration data
   */
  static async getPluginConfig(
    fastify: FastifyInstance,
    tenantId: number,
    pluginSlug: string
  ): Promise<PluginConfigData> {
    try {
      // Query plugin installation
      const installation = await (fastify as any).prisma.pluginInstallation.findFirst({
        where: {
          tenantId,
          plugin: { slug: pluginSlug }
        },
        include: {
          plugin: true
        }
      });
      
      if (!installation) {
        throw new Error('Plugin is not installed');
      }
      
      // Parse config data
      const configData = installation.configData 
        ? JSON.parse(installation.configData) 
        : null;
      
      return {
        pluginSlug: installation.plugin.slug,
        configData,
        configSchema: undefined // TODO: Add config schema support
      };
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to get plugin config');
      
      if (error.message === 'Plugin is not installed') {
        throw new Error('Plugin is not installed');
      } else {
        throw new Error('Failed to retrieve plugin configuration');
      }
    }
  }
  
  /**
   * Update plugin configuration
   * 
   * @param fastify - Fastify instance with plugin decorators
   * @param tenantId - Tenant ID
   * @param pluginSlug - Plugin slug
   * @param configData - Configuration data
   * @returns Updated configuration result
   */
  static async updatePluginConfig(
    fastify: FastifyInstance,
    tenantId: number,
    pluginSlug: string,
    configData: Record<string, any>
  ): Promise<PluginConfigData> {
    try {
      // Call decorator method to configure plugin
      const result = await (fastify as any).configurePlugin(tenantId, pluginSlug, configData);
      
      return {
        pluginSlug: result.installation.plugin.slug,
        configData: result.installation.configData
      };
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to update plugin config');
      
      if (error.message === 'Plugin is not installed') {
        throw new Error('Plugin is not installed');
      } else {
        throw new Error('Failed to update plugin configuration');
      }
    }
  }
  
  /**
   * Uninstall a plugin
   * 
   * @param fastify - Fastify instance with plugin decorators
   * @param tenantId - Tenant ID
   * @param pluginSlug - Plugin slug
   * @returns Uninstall result
   */
  static async uninstallPlugin(
    fastify: FastifyInstance,
    tenantId: number,
    pluginSlug: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if this is a theme plugin before uninstalling
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: pluginSlug }
      });

      if (plugin && this.isThemePlugin(plugin)) {
        fastify.log.info(`🎨 Uninstalling theme plugin: ${pluginSlug}`);
        
        // Check if this is the currently enabled theme
        const installation = await fastify.prisma.pluginInstallation.findFirst({
          where: {
            tenantId,
            plugin: { slug: pluginSlug }
          }
        });

        if (installation && installation.enabled) {
          fastify.log.info(`🎨 Currently enabled theme being uninstalled, finding fallback...`);
          
          // Find another installed theme plugin
          const otherTheme = await fastify.prisma.pluginInstallation.findFirst({
            where: {
              tenantId,
              plugin: { category: 'theme' },
              id: { not: installation.id }
            },
            include: { plugin: true }
          });

          if (otherTheme) {
            // Enable the other theme
            await fastify.prisma.pluginInstallation.update({
              where: { id: otherTheme.id },
              data: { enabled: true }
            });

            const themeSlug = this.extractThemeSlug(otherTheme.plugin);
            const themeData = {
              slug: themeSlug,
              config: {},
              version: otherTheme.plugin.version,
              pluginSlug: otherTheme.plugin.slug
            };

            await fastify.prisma.tenant.update({
              where: { id: tenantId },
              data: { theme: JSON.stringify(themeData) }
            });

            fastify.log.info(`✅ Switched to fallback theme: ${otherTheme.plugin.slug}`);
            
            // Clear mall context cache for this tenant
            clearMallContextCacheForTenant(tenantId);
            fastify.log.info(`🗑️ Mall context cache cleared for tenant ${tenantId}`);
          } else {
            // No other theme installed, auto-install default theme
            fastify.log.info(`🎨 No other theme installed, auto-installing default theme...`);
            
            const defaultTheme = await fastify.prisma.plugin.findUnique({
              where: { slug: 'shop-theme-default' }
            });

            if (defaultTheme) {
              // Install default theme
              const defaultInstallation = await fastify.prisma.pluginInstallation.create({
                data: {
                  tenantId,
                  pluginId: defaultTheme.id,
                  status: 'ACTIVE',
                  enabled: true,
                  configData: JSON.stringify({})
                }
              });

              const themeData = {
                slug: 'default',
                config: {},
                version: defaultTheme.version,
                pluginSlug: defaultTheme.slug
              };

              await fastify.prisma.tenant.update({
                where: { id: tenantId },
                data: { theme: JSON.stringify(themeData) }
              });

              fastify.log.info(`✅ Default theme auto-installed and enabled`);
              
              // Clear mall context cache for this tenant
              clearMallContextCacheForTenant(tenantId);
              fastify.log.info(`🗑️ Mall context cache cleared for tenant ${tenantId}`);
            } else {
              fastify.log.error(`❌ Default theme plugin not found`);
              throw new Error('Cannot uninstall the last theme plugin. Default theme not available.');
            }
          }
        }
      }

      // Handle external plugin uninstallation
      if (plugin && plugin.runtimeType === 'external-http') {
        fastify.log.info(`🌐 Uninstalling external plugin: ${pluginSlug}`);

        // Get the installation record before uninstalling
        const installation = await fastify.prisma.pluginInstallation.findFirst({
          where: {
            tenantId,
            plugin: { slug: pluginSlug }
          }
        });

        if (installation && plugin.externalBaseUrl) {
          try {
            const uninstallUrl = `${plugin.externalBaseUrl}/uninstall`;
            const timestamp = new Date().toISOString();

            // Generate HMAC signature for /uninstall call
            const sharedSecret = plugin.integrationSecrets ? JSON.parse(plugin.integrationSecrets).sharedSecret : '';
            const uninstallBody = JSON.stringify({
              tenantId,
              installationId: installation.id,
              reason: 'admin_uninstall'
            });

            // Use unified signature generation
            const signature = generateSignature(sharedSecret, 'POST', '/uninstall', uninstallBody, timestamp);

            const uninstallResponse = await fetch(uninstallUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Platform-Id': 'jiffoo',
                'X-Platform-Env': process.env.NODE_ENV || 'development',
                'X-Platform-Timestamp': timestamp,
                'X-Plugin-Slug': plugin.slug,
                'X-Tenant-ID': tenantId.toString(),
                'X-Installation-ID': installation.id,
                'X-Platform-Signature': signature
              },
              body: uninstallBody
            });

            if (!uninstallResponse.ok) {
              fastify.log.warn('External plugin /uninstall call failed:', await uninstallResponse.text());
              // Don't fail the uninstallation, just log the warning
            } else {
              fastify.log.info('✅ External plugin /uninstall called successfully');
            }
          } catch (error) {
            fastify.log.warn('Failed to call external plugin /uninstall:', error);
            // Don't fail the uninstallation
          }
        }
      }

      // Call decorator method to uninstall plugin
      const result = await (fastify as any).uninstallPlugin(tenantId, pluginSlug);

      return result;
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to uninstall plugin');
      
      if (error.message === 'Plugin is not installed') {
        throw new Error('Plugin is not installed');
      } else {
        throw new Error('Failed to uninstall plugin');
      }
    }
  }
  
  /**
   * Toggle plugin status (enable/disable)
   * 
   * @param fastify - Fastify instance with plugin decorators
   * @param tenantId - Tenant ID
   * @param pluginSlug - Plugin slug
   * @param enabled - Whether to enable or disable
   * @returns Toggle result
   */
  static async togglePlugin(
    fastify: FastifyInstance,
    tenantId: number,
    pluginSlug: string,
    enabled: boolean
  ): Promise<{ success: boolean; installation: any; message: string }> {
    try {
      // Call decorator method to toggle plugin
      const result = await (fastify as any).togglePlugin(tenantId, pluginSlug, enabled);
      
      // Special handling for theme plugins
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: pluginSlug }
      });

      if (plugin && this.isThemePlugin(plugin)) {
        if (enabled) {
          fastify.log.info(`🎨 Enabling theme plugin: ${pluginSlug}`);
          
          // Disable all other theme plugins for this tenant
          const otherThemePlugins = await fastify.prisma.pluginInstallation.findMany({
            where: {
              tenantId,
              plugin: { category: 'theme' },
              id: { not: result.installation.id }
            },
            include: { plugin: true }
          });

          for (const installation of otherThemePlugins) {
            await fastify.prisma.pluginInstallation.update({
              where: { id: installation.id },
              data: { enabled: false }
            });
            fastify.log.info(`✅ Disabled theme plugin: ${installation.plugin.slug}`);
          }

          // Update tenant's theme field
          const themeSlug = this.extractThemeSlug(plugin);
          const themeData = {
            slug: themeSlug,
            config: {},
            version: plugin.version,
            pluginSlug: plugin.slug
          };

          await fastify.prisma.tenant.update({
            where: { id: tenantId },
            data: { theme: JSON.stringify(themeData) }
          });

          fastify.log.info(`✅ Tenant theme updated: ${JSON.stringify(themeData)}`);
          
          // Clear mall context cache for this tenant
          clearMallContextCacheForTenant(tenantId);
          fastify.log.info(`🗑️ Mall context cache cleared for tenant ${tenantId}`);
        } else {
          fastify.log.info(`🎨 Disabling theme plugin: ${pluginSlug}`);
          
          // Check if this is the last enabled theme plugin
          const enabledThemePlugins = await fastify.prisma.pluginInstallation.findMany({
            where: {
              tenantId,
              plugin: { category: 'theme' },
              enabled: true,
              id: { not: result.installation.id }
            }
          });

          if (enabledThemePlugins.length === 0) {
            fastify.log.warn(`⚠️ No other theme plugins enabled, auto-enabling default theme...`);
            
            // Auto-enable default theme plugin
            const defaultTheme = await fastify.prisma.pluginInstallation.findFirst({
              where: {
                tenantId,
                plugin: { slug: 'shop-theme-default' }
              },
              include: { plugin: true }
            });

            if (defaultTheme) {
              await fastify.prisma.pluginInstallation.update({
                where: { id: defaultTheme.id },
                data: { enabled: true }
              });

              const themeData = {
                slug: 'default',
                config: {},
                version: defaultTheme.plugin.version,
                pluginSlug: defaultTheme.plugin.slug
              };

              await fastify.prisma.tenant.update({
                where: { id: tenantId },
                data: { theme: JSON.stringify(themeData) }
              });

              fastify.log.info(`✅ Default theme auto-enabled and tenant theme updated`);
              
              // Clear mall context cache for this tenant
              clearMallContextCacheForTenant(tenantId);
              fastify.log.info(`🗑️ Mall context cache cleared for tenant ${tenantId}`);
            } else {
              fastify.log.error(`❌ Default theme plugin not found for tenant ${tenantId}`);
              throw new Error('Cannot disable the last theme plugin. Default theme not available.');
            }
          }
        }
      }
      
      return result;
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to toggle plugin');
      
      if (error.message === 'Plugin is not installed') {
        throw new Error('Plugin is not installed');
      } else if (error.message.includes('Cannot enable expired plugin')) {
        throw new Error('Cannot enable expired plugin. Please renew subscription.');
      } else {
        throw new Error('Failed to toggle plugin status');
      }
    }
  }

  /**
   * Search plugins by keyword
   *
   * @param fastify - Fastify instance with plugin decorators
   * @param query - Search query string
   * @param category - Optional category filter
   * @returns Search results
   */
  static async searchPlugins(
    fastify: FastifyInstance,
    query: string,
    category?: string
  ): Promise<{ query: string; results: any[]; total: number }> {
    try {
      // Call decorator method to search plugins
      const results = await (fastify as any).searchPlugins(query, category);

      return {
        query,
        results,
        total: results.length
      };
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to search plugins');
      throw new Error('Failed to search plugins');
    }
  }

  /**
   * Get detailed information about a specific plugin
   *
   * @param fastify - Fastify instance with plugin decorators
   * @param pluginSlug - Plugin slug
   * @param tenantId - Tenant ID (to check installation status)
   * @returns Plugin details with installation info
   */
  static async getPluginDetails(
    fastify: FastifyInstance,
    pluginSlug: string,
    tenantId: number
  ): Promise<any> {
    try {
      fastify.log.info(`[SERVICE] Calling decorator with slug: ${pluginSlug}, tenantId: ${tenantId}`);

      // Check if decorator exists
      const decoratorType = typeof (fastify as any).getPluginDetails;
      fastify.log.info(`[SERVICE] Decorator exists: ${decoratorType}`);
      fastify.log.info(`[SERVICE] Decorator is function: ${decoratorType === 'function'}`);

      // Call decorator method to get plugin details
      const plugin = await (fastify as any).getPluginDetails(pluginSlug, tenantId);

      fastify.log.info(`[SERVICE] Decorator returned: ${plugin ? 'EXISTS' : 'NULL'}`);
      fastify.log.info(`[SERVICE] Decorator returned type: ${typeof plugin}`);
      fastify.log.info(`[SERVICE] Plugin keys: ${plugin ? Object.keys(plugin).join(', ') : 'N/A'}`);
      fastify.log.info(`[SERVICE] subscriptionPlans count: ${plugin?.subscriptionPlans?.length || 0}`);

      return plugin;
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to get plugin details');

      if (error.message === 'Plugin not found') {
        throw new Error('Plugin not found');
      } else {
        throw new Error('Failed to retrieve plugin details');
      }
    }
  }

  /**
   * Get all plugin categories
   *
   * @param fastify - Fastify instance with plugin decorators
   * @returns List of categories with plugin counts
   */
  static async getCategories(
    fastify: FastifyInstance
  ): Promise<{ categories: Array<{ id: string; name: string; count: number }> }> {
    try {
      // Call decorator method to get categories
      const categories = await (fastify as any).getPluginCategories();

      return {
        categories
      };
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to get plugin categories');
      throw new Error('Failed to retrieve plugin categories');
    }
  }

  /**
   * Get plugin usage statistics for a tenant
   *
   * @param fastify - Fastify instance with plugin decorators
   * @param tenantId - Tenant ID
   * @param pluginSlug - Plugin slug
   * @returns Usage statistics including current usage and limits
   */
  static async getPluginUsage(
    fastify: FastifyInstance,
    tenantId: number,
    pluginSlug: string
  ): Promise<any> {
    try {
      // Check if plugin is installed (include TRIAL status)
      const installation = await fastify.prisma.pluginInstallation.findFirst({
        where: {
          tenantId,
          plugin: { slug: pluginSlug },
          status: { in: ['ACTIVE', 'TRIAL'] }
        },
        include: {
          plugin: {
            include: {
              subscriptionPlans: true
            }
          }
        }
      });

      if (!installation) {
        throw new Error('Plugin is not installed');
      }

      // Get active subscription
      const subscription = await fastify.prisma.subscription.findFirst({
        where: {
          tenantId,
          plugin: { slug: pluginSlug },
          status: { in: ['active', 'trialing', 'past_due'] }
        }
      });

      // Get subscription plan if subscription exists
      let subscriptionPlan = null;
      if (subscription) {
        subscriptionPlan = await fastify.prisma.subscriptionPlan.findFirst({
          where: {
            pluginId: installation.plugin.id,
            planId: subscription.planId
          }
        });
      }

      // Determine period for usage query
      let period: string;
      if (subscription) {
        const startDate = subscription.currentPeriodStart.toISOString().split('T')[0];
        period = `${subscription.id}:${startDate}`;
      } else {
        // Free plan: use current month
        period = new Date().toISOString().slice(0, 7);
      }

      // Get usage data
      const usageRecords = await fastify.prisma.pluginUsage.findMany({
        where: {
          tenantId,
          pluginSlug,
          period
        }
      });

      // Parse limits from subscription plan or default
      let limits: any = {};
      if (subscriptionPlan) {
        limits = JSON.parse(subscriptionPlan.limits || '{}');
      } else {
        // Default free plan limits - only api_calls for any plugin
        limits = {
          api_calls: 1000
        };
      }

      // Build usage summary
      const usage: any = {};
      usageRecords.forEach(record => {
        usage[record.metricName] = {
          current: record.value,
          limit: limits[record.metricName] || null,
          percentage: limits[record.metricName]
            ? Math.round((record.value / limits[record.metricName]) * 100)
            : 0
        };
      });

      // Add metrics that haven't been used yet
      Object.keys(limits).forEach(metric => {
        if (!usage[metric]) {
          usage[metric] = {
            current: 0,
            limit: limits[metric],
            percentage: 0
          };
        }
      });

      return {
        pluginSlug,
        period,
        subscription: subscription ? {
          id: subscription.id,
          planId: subscription.planId,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd
        } : null,
        usage,
        limits
      };
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to get plugin usage');
      throw error;
    }
  }

  /**
   * Get plugin subscription information for a tenant
   *
   * @param fastify - Fastify instance with plugin decorators
   * @param tenantId - Tenant ID
   * @param pluginSlug - Plugin slug
   * @returns Subscription details including plan and billing info
   */
  static async getPluginSubscription(
    fastify: FastifyInstance,
    tenantId: number,
    pluginSlug: string
  ): Promise<any> {
    try {
      // Check if plugin is installed (include TRIAL status)
      const installation = await fastify.prisma.pluginInstallation.findFirst({
        where: {
          tenantId,
          plugin: { slug: pluginSlug },
          status: { in: ['ACTIVE', 'TRIAL'] }
        },
        include: {
          plugin: {
            include: {
              subscriptionPlans: {
                where: { isActive: true },
                orderBy: { amount: 'asc' }
              }
            }
          }
        }
      });

      if (!installation) {
        throw new Error('Plugin is not installed');
      }

      // Get all subscriptions (including history) - similar to Super Admin
      const allSubscriptions = await fastify.prisma.subscription.findMany({
        where: {
          tenantId,
          plugin: { slug: pluginSlug }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (allSubscriptions.length === 0) {
        // Return available plans even if no subscription
        return {
          hasSubscription: false,
          availablePlans: installation.plugin.subscriptionPlans.map(plan => ({
            id: plan.id,
            planId: plan.planId,
            name: plan.name,
            description: plan.description,
            amount: plan.amount,
            currency: plan.currency,
            billingCycle: plan.billingCycle,
            trialDays: plan.trialDays,
            features: JSON.parse(plan.features || '[]'),
            limits: JSON.parse(plan.limits || '{}')
          })),
          usage: null,
          invoices: [],
          changes: [],
          events: []
        };
      }

      // Separate current subscription and history
      const currentSubscription = allSubscriptions.find(sub =>
        ['active', 'trialing', 'past_due'].includes(sub.status)
      ) || allSubscriptions[0];

      const historySubscriptions = allSubscriptions.filter(sub =>
        sub.id !== currentSubscription?.id
      );

      // Get invoices, changes, events for current subscription
      const subscription = await fastify.prisma.subscription.findUnique({
        where: { id: currentSubscription.id },
        include: {
          invoices: {
            orderBy: { createdAt: 'desc' },
            take: 20
          },
          changes: {
            orderBy: { createdAt: 'desc' },
            take: 20
          },
          events: {
            orderBy: { createdAt: 'desc' },
            take: 50
          }
        }
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Get subscription plan details
      const subscriptionPlan = await fastify.prisma.subscriptionPlan.findFirst({
        where: {
          pluginId: installation.plugin.id,
          planId: subscription.planId
        }
      });

      // Get usage data - similar to Super Admin implementation
      // Query all usage records for this tenant and plugin
      const allUsageRecords = await fastify.prisma.pluginUsage.findMany({
        where: {
          tenantId,
          pluginSlug
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // 根据插件类型确定需要查询的指标
      let expectedMetrics: string[]
      if (pluginSlug === 'stripe') {
        expectedMetrics = ['transactions', 'api_calls', 'refunds']
      } else if (pluginSlug === 'resend') {
        expectedMetrics = ['api_calls', 'emails_sent']
      } else if (pluginSlug === 'google') {
        expectedMetrics = ['api_calls', 'login_attempts']
      } else {
        expectedMetrics = ['api_calls']
      }

      const limits = subscriptionPlan ? (typeof subscriptionPlan.limits === 'string' ? JSON.parse(subscriptionPlan.limits) : subscriptionPlan.limits) : {};

      // 动态构建usage对象
      const usage: any = {}

      for (const metric of expectedMetrics) {
        // Find usage records for current subscription (period format: subscriptionId:date)
        let metricUsage = allUsageRecords.find(u =>
          u.metricName === metric && u.period.startsWith(currentSubscription.id)
        );

        // Fallback to latest usage records if subscription-specific not found
        if (!metricUsage) {
          metricUsage = allUsageRecords.find(u => u.metricName === metric);
        }

        usage[metric] = {
          current: metricUsage?.value || 0,
          limit: limits[metric] || -1,
          percentage: 0
        };

        // Calculate percentage
        if (usage[metric].limit > 0) {
          usage[metric].percentage = (usage[metric].current / usage[metric].limit) * 100;
        }
      }

      // Check for pending downgrade
      let pendingChange = null;
      if (subscription.cancelAtPeriodEnd) {
        const change = await fastify.prisma.subscriptionChange.findFirst({
          where: {
            subscriptionId: subscription.id,
            changeType: 'downgraded',
            effectiveDate: { gt: new Date() }
          },
          orderBy: { createdAt: 'desc' }
        });

        if (change) {
          const daysRemaining = Math.ceil(
            (change.effectiveDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );

          pendingChange = {
            type: 'downgrade',
            fromPlan: change.fromPlanId,
            targetPlan: change.toPlanId,
            effectiveDate: change.effectiveDate.toISOString(),
            daysRemaining
          };
        }
      }

      return {
        hasSubscription: true,
        subscription: {
          id: subscription.id,
          planId: subscription.planId,
          status: subscription.status,
          billingCycle: subscription.billingCycle,
          amount: subscription.amount,
          currency: subscription.currency,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          trialStart: subscription.trialStart,
          trialEnd: subscription.trialEnd,
          autoRenew: subscription.autoRenew,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          plan: subscriptionPlan ? {
            name: subscriptionPlan.name,
            description: subscriptionPlan.description,
            features: JSON.parse(subscriptionPlan.features || '[]'),
            limits: JSON.parse(subscriptionPlan.limits || '{}')
          } : null
        },
        usage,
        pendingChange,
        subscriptionHistory: await Promise.all(
          historySubscriptions.map(async (sub) => {
            // Get usage for this subscription
            const subApiCallsUsage = allUsageRecords.find(u =>
              u.metricName === 'api_calls' && u.period.startsWith(sub.id)
            );
            const subTransactionsUsage = allUsageRecords.find(u =>
              u.metricName === 'transactions' && u.period.startsWith(sub.id)
            );

            // Get plan limits for this subscription
            const subPlan = await fastify.prisma.subscriptionPlan.findFirst({
              where: {
                pluginId: installation.plugin.id,
                planId: sub.planId
              }
            });
            const subLimits = subPlan && subPlan.limits ? (typeof subPlan.limits === 'string' ? JSON.parse(subPlan.limits) : subPlan.limits) : {};

            return {
              id: sub.id,
              planId: sub.planId,
              status: sub.status,
              amount: sub.amount,
              currency: sub.currency,
              createdAt: sub.createdAt,
              canceledAt: sub.canceledAt,
              usage: {
                api_calls: {
                  current: subApiCallsUsage?.value || 0,
                  limit: subLimits.api_calls || -1
                },
                transactions: {
                  current: subTransactionsUsage?.value || 0,
                  limit: subLimits.transactions || -1
                }
              }
            };
          })
        ),
        availablePlans: installation.plugin.subscriptionPlans.map(plan => ({
          id: plan.id,
          planId: plan.planId,
          name: plan.name,
          description: plan.description,
          amount: plan.amount,
          currency: plan.currency,
          billingCycle: plan.billingCycle,
          trialDays: plan.trialDays,
          features: JSON.parse(plan.features || '[]'),
          limits: JSON.parse(plan.limits || '{}'),
          isCurrent: plan.planId === subscription.planId
        }))
      };
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to get plugin subscription');
      throw error;
    }
  }

  /**
   * Create upgrade checkout session for plugin subscription
   * This method creates a Stripe Checkout session for upgrading to a paid plan
   * Note: This does NOT directly modify the subscription - payment must be completed first
   *
   * @param fastify - Fastify instance with plugin decorators
   * @param tenantId - Tenant ID
   * @param pluginSlug - Plugin slug
   * @param newPlanId - New plan ID to upgrade to
   * @param successUrl - URL to redirect after successful payment
   * @param cancelUrl - URL to redirect if payment is cancelled
   * @returns Checkout session details with payment URL
   */
  static async createUpgradeCheckoutSession(
    fastify: FastifyInstance,
    tenantId: number,
    pluginSlug: string,
    newPlanId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<any> {
    try {
      // Check if plugin is installed
      const installation = await fastify.prisma.pluginInstallation.findFirst({
        where: {
          tenantId,
          plugin: { slug: pluginSlug },
          status: 'ACTIVE'
        },
        include: {
          plugin: {
            include: {
              subscriptionPlans: {
                where: { isActive: true }
              }
            }
          }
        }
      });

      if (!installation) {
        throw new Error('Plugin is not installed');
      }

      // Validate new plan exists
      const newPlan = installation.plugin.subscriptionPlans.find(
        (p: any) => p.planId === newPlanId
      );

      if (!newPlan) {
        throw new Error('Plan not found');
      }

      // Get current subscription to detect upgrade vs downgrade
      const currentSubscription = await fastify.prisma.subscription.findFirst({
        where: {
          tenantId,
          plugin: { slug: pluginSlug },
          status: { in: ['active', 'trialing', 'past_due'] }
        }
      });

      // Detect if this is a downgrade (new plan amount < current plan amount)
      if (currentSubscription && newPlan.amount < currentSubscription.amount) {
        // This is a downgrade - should use downgrade endpoint
        return {
          success: true,
          isDowngrade: true,
          message: 'This is a downgrade. Please use the downgrade flow.',
          currentPlan: {
            planId: currentSubscription.planId,
            amount: currentSubscription.amount
          },
          targetPlan: {
            planId: newPlan.planId,
            amount: newPlan.amount
          }
        };
      }

      // For free plans, directly update subscription without payment
      if (newPlan.amount === 0) {
        if (!currentSubscription) {
          // Create new free subscription
          const subscription = await (fastify as any).createSubscription(
            tenantId,
            pluginSlug,
            newPlanId,
            {}
          );

          return {
            success: true,
            immediate: true,
            message: 'Switched to free plan successfully',
            subscription
          };
        }

        // Update existing subscription to free plan
        const updatedSubscription = await (fastify as any).updateSubscription(
          currentSubscription.id,
          {
            planId: newPlanId,
            amount: newPlan.amount,
            currency: newPlan.currency,
            billingCycle: newPlan.billingCycle
          }
        );

        return {
          success: true,
          immediate: true,
          message: 'Switched to free plan successfully',
          subscription: updatedSubscription
        };
      }

      // Check if this is a proration upgrade (existing paid subscription)
      if (currentSubscription && currentSubscription.stripeSubscriptionId && currentSubscription.planId !== 'free') {
        // This is a proration upgrade - call Stripe plugin API directly
        fastify.log.info(`🔄 Proration upgrade detected: ${currentSubscription.planId} → ${newPlanId}`);

        try {
          // Make internal API call to Stripe plugin upgrade endpoint
          const upgradeResponse = await fastify.inject({
            method: 'POST',
            url: '/api/plugins/stripe/api/plan/upgrade',
            headers: {
              'x-tenant-id': tenantId.toString(),
              'content-type': 'application/json'
            },
            payload: {
              targetPlan: newPlanId
            }
          });

          if (upgradeResponse.statusCode !== 200) {
            const errorData = JSON.parse(upgradeResponse.payload);
            throw new Error(errorData.error || `HTTP ${upgradeResponse.statusCode}`);
          }

          const upgradeResult = JSON.parse(upgradeResponse.payload);
          fastify.log.info(`✅ Proration upgrade completed via Admin API: ${currentSubscription.planId} → ${newPlanId}`);

          return {
            success: true,
            immediate: false,
            requiresPayment: false,
            message: 'Plan upgraded successfully with proration',
            planDetails: {
              planId: newPlan.planId,
              name: newPlan.name,
              amount: newPlan.amount,
              currency: newPlan.currency,
              billingCycle: newPlan.billingCycle
            },
            ...upgradeResult
          };
        } catch (error: any) {
          fastify.log.error({ err: error }, 'Failed to process proration upgrade');
          // 如果内部API调用失败，回退到标准流程（返回requiresPayment: true）
          fastify.log.info(`🔄 Proration upgrade failed, falling back to standard checkout flow`);

          return {
            success: true,
            immediate: false,
            requiresPayment: true,
            message: 'Upgrade requires payment processing',
            planDetails: {
              planId: newPlan.planId,
              name: newPlan.name,
              amount: newPlan.amount,
              currency: newPlan.currency,
              billingCycle: newPlan.billingCycle
            }
          };
        }
      }

      // For paid plans without existing subscription, return plan details and indicate payment is required
      // Frontend will call Stripe plugin API directly to create checkout session
      return {
        success: true,
        requiresPayment: true,
        message: 'Payment required for this plan. Please complete checkout.',
        planDetails: {
          planId: newPlan.planId,
          name: newPlan.name,
          amount: newPlan.amount,
          currency: newPlan.currency,
          billingCycle: newPlan.billingCycle
        }
      };
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to create upgrade checkout session');
      throw error;
    }
  }

  /**
   * Verify Stripe Checkout session and update subscription
   *
   * @param fastify - Fastify instance
   * @param tenantId - Tenant ID
   * @param pluginSlug - Plugin slug
   * @param sessionId - Stripe Checkout session ID
   * @returns Verification result with subscription data
   */
  static async verifyCheckoutSession(
    fastify: FastifyInstance,
    tenantId: number,
    pluginSlug: string,
    sessionId: string
  ): Promise<any> {
    try {
      // Get Stripe instance from environment
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

      // Retrieve the checkout session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // Verify session is completed
      if (session.payment_status !== 'paid') {
        throw new Error('Payment not completed');
      }

      // Get plugin installation
      const installation = await fastify.prisma.pluginInstallation.findFirst({
        where: {
          tenantId,
          plugin: { slug: pluginSlug },
          status: 'ACTIVE'
        },
        include: {
          plugin: {
            include: {
              subscriptionPlans: true
            }
          }
        }
      });

      if (!installation) {
        throw new Error('Plugin is not installed');
      }

      // Get plan ID from session metadata
      const planId = session.metadata?.planId || session.metadata?.targetPlan;

      if (!planId) {
        throw new Error('Plan ID not found in session metadata');
      }

      // Find the plan
      const plan = installation.plugin.subscriptionPlans.find(
        (p: any) => p.planId === planId
      );

      if (!plan) {
        throw new Error('Plan not found');
      }

      // Get or create Stripe subscription
      let stripeSubscriptionId = session.subscription as string;

      // Find existing subscription
      const existingSubscription = await fastify.prisma.subscription.findFirst({
        where: {
          tenantId,
          plugin: { slug: pluginSlug },
          status: { in: ['active', 'trialing', 'past_due'] }
        }
      });

      let subscription;

      if (existingSubscription) {
        // Update existing subscription
        subscription = await fastify.prisma.subscription.update({
          where: { id: existingSubscription.id },
          data: {
            planId: planId,
            stripeSubscriptionId: stripeSubscriptionId,
            stripeCustomerId: session.customer as string,
            status: 'active',
            amount: plan.amount,
            currency: plan.currency,
            billingCycle: plan.billingCycle,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            metadata: JSON.stringify({
              sessionId: sessionId,
              paymentIntentId: session.payment_intent
            })
          }
        });
      } else {
        // Create new subscription
        subscription = await fastify.prisma.subscription.create({
          data: {
            tenantId,
            pluginId: installation.plugin.id,
            planId: planId,
            stripeSubscriptionId: stripeSubscriptionId,
            stripeCustomerId: session.customer as string,
            status: 'active',
            amount: plan.amount,
            currency: plan.currency,
            billingCycle: plan.billingCycle,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            metadata: JSON.stringify({
              sessionId: sessionId,
              paymentIntentId: session.payment_intent
            })
          }
        });
      }

      fastify.log.info(`Checkout session verified and subscription updated: ${subscription.id}`);

      // 🔑 重要：检查是否是升级支付，如果是则重置使用量
      const isUpgrade = session.metadata?.isUpgrade === 'true';
      const fromPlan = session.metadata?.fromPlan || 'unknown';

      if (isUpgrade) {
        try {
          fastify.log.info(`🔄 Detected upgrade payment: ${fromPlan} → ${planId}, resetting usage...`);

          // 调用 Stripe 插件的使用量重置函数
          // 需要获取 Stripe 插件实例来调用重置函数
          const stripePlugin = (fastify as any).plugins?.get?.('stripe');
          if (stripePlugin && typeof stripePlugin.resetPluginUsageForUpgrade === 'function') {
            await stripePlugin.resetPluginUsageForUpgrade(fastify, tenantId, pluginSlug, subscription, {
              fromPlan: fromPlan,
              toPlan: planId,
              upgradeType: fromPlan === 'free' ? 'free_to_paid' : 'paid_to_paid',
              sessionId: sessionId
            });
            fastify.log.info(`✅ Usage reset completed for ${fromPlan} → ${planId} upgrade`);
          } else {
            // 备用方案：只创建新订阅的使用量记录，不删除任何历史记录
            fastify.log.warn('Stripe plugin resetPluginUsageForUpgrade not available, using fallback method');

            // 只创建新的使用量记录（从0开始），不删除任何历史记录
            const startDate = subscription.currentPeriodStart.toISOString().split('T')[0];
            const newPeriod = `${subscription.id}:${startDate}`;

            // 根据插件类型确定使用量指标
            let metrics: string[]
            if (pluginSlug === 'stripe') {
              metrics = ['transactions', 'api_calls', 'refunds']
            } else if (pluginSlug === 'resend') {
              metrics = ['api_calls', 'emails_sent']
            } else if (pluginSlug === 'google') {
              metrics = ['api_calls', 'login_attempts']
            } else {
              metrics = ['api_calls']
            }

            const usageData = metrics.map(metric => ({
              tenantId: tenantId,
              pluginSlug: pluginSlug,
              metricName: metric,
              value: 0,
              period: newPeriod
            }))

            await fastify.prisma.pluginUsage.createMany({
              data: usageData,
              skipDuplicates: true
            });

            fastify.log.info(`✅ Created new usage records for period: ${newPeriod} (fallback method)`);
          }
        } catch (resetError: any) {
          fastify.log.error({ err: resetError }, 'Failed to reset usage for upgrade');
          // 不抛出错误，因为订阅已经成功更新，使用量重置失败不应该影响支付确认
        }
      }

      return {
        success: true,
        message: 'Payment verified and subscription updated successfully',
        subscription: subscription,
        session: {
          id: session.id,
          paymentStatus: session.payment_status,
          amountTotal: session.amount_total,
          currency: session.currency
        }
      };
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to verify checkout session');
      throw error;
    }
  }
}

