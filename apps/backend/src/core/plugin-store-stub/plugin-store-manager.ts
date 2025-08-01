/**
 * Plugin Store Manager - Open Source Stub Version
 * 
 * This is a stub implementation for the open source version.
 * Commercial plugin store features are available in the commercial version.
 */

export interface PluginMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  tags: string[];
  pricing: {
    type: 'free' | 'paid' | 'freemium';
    plans?: {
      [key: string]: {
        price: number;
        features: string[];
      };
    };
  };
  features: string[];
  requirements: {
    minVersion: string;
    dependencies: string[];
    permissions: string[];
  };
  media: {
    icon: string;
    screenshots: string[];
  };
  documentation: {
    readme: string;
    changelog: string;
    apiDocs?: string;
  };
  support: {
    email: string;
    documentation: string;
    community: string;
    issues: string;
  };
  stats: {
    downloads: number;
    activeInstalls: number;
    rating: number;
    reviewCount: number;
  };
  status: 'active' | 'deprecated' | 'beta' | 'coming-soon';
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseRequest {
  userId: string;
  pluginId: string;
  licenseType: 'trial' | 'monthly' | 'yearly' | 'lifetime';
  paymentMethodId?: string;
}

export interface PurchaseResult {
  success: boolean;
  licenseKey?: string;
  paymentIntentId?: string;
  error?: string;
  trialEndsAt?: Date;
}

export class PluginStoreManager {
  private pluginCatalog: Map<string, PluginMetadata> = new Map();
  private initialized = false;

  constructor() {
    this.initializeCatalogSync();
  }

  private initializeCatalogSync() {
    // Initialize with basic open source plugins
    const openSourcePlugins: PluginMetadata[] = [
      {
        id: 'basic-auth',
        name: 'Basic Authentication',
        description: 'Simple username/password authentication',
        version: '1.0.0',
        author: 'Jiffoo Team',
        category: 'authentication',
        tags: ['auth', 'basic', 'opensource'],
        pricing: { type: 'free' },
        features: ['Username/password login', 'Session management', 'Basic security'],
        requirements: {
          minVersion: '1.0.0',
          dependencies: [],
          permissions: ['auth.login', 'auth.logout']
        },
        media: {
          icon: '/plugins/basic-auth/icon.png',
          screenshots: []
        },
        documentation: {
          readme: '/plugins/basic-auth/README.md',
          changelog: '/plugins/basic-auth/CHANGELOG.md'
        },
        support: {
          email: 'support@jiffoo.com',
          documentation: 'https://docs.jiffoo.com/plugins/basic-auth',
          community: 'https://community.jiffoo.com',
          issues: 'https://github.com/jiffoo/basic-auth/issues'
        },
        stats: {
          downloads: 1000,
          activeInstalls: 500,
          rating: 4.2,
          reviewCount: 25
        },
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    openSourcePlugins.forEach(plugin => {
      this.pluginCatalog.set(plugin.id, plugin);
    });

    this.initialized = true;
  }

  async getAvailablePlugins(): Promise<PluginMetadata[]> {
    return Array.from(this.pluginCatalog.values());
  }

  async getPlugin(pluginId: string): Promise<PluginMetadata | null> {
    return this.pluginCatalog.get(pluginId) || null;
  }

  async searchPlugins(query: string, category?: string): Promise<PluginMetadata[]> {
    const plugins = Array.from(this.pluginCatalog.values());
    
    return plugins.filter(plugin => {
      const matchesQuery = !query || 
        plugin.name.toLowerCase().includes(query.toLowerCase()) ||
        plugin.description.toLowerCase().includes(query.toLowerCase()) ||
        plugin.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()));
      
      const matchesCategory = !category || plugin.category === category;
      
      return matchesQuery && matchesCategory;
    });
  }

  async purchasePlugin(request: PurchaseRequest): Promise<PurchaseResult> {
    const plugin = this.pluginCatalog.get(request.pluginId);
    
    if (!plugin) {
      return {
        success: false,
        error: 'Plugin not found'
      };
    }

    if (plugin.pricing.type === 'free') {
      return {
        success: true,
        licenseKey: `free-${request.pluginId}-${Date.now()}`
      };
    }

    return {
      success: false,
      error: 'Commercial plugin purchases are available in the commercial version',
    };
  }

  async getUserPurchases(userId: string): Promise<any[]> {
    // Return empty array for open source version
    return [];
  }

  async updatePluginStats(pluginId: string, action: 'download' | 'install' | 'uninstall'): Promise<void> {
    const plugin = this.pluginCatalog.get(pluginId);
    if (!plugin) return;

    switch (action) {
      case 'download':
        plugin.stats.downloads++;
        break;
      case 'install':
        plugin.stats.activeInstalls++;
        break;
      case 'uninstall':
        plugin.stats.activeInstalls = Math.max(0, plugin.stats.activeInstalls - 1);
        break;
    }

    plugin.updatedAt = new Date().toISOString();
  }

  async getPluginCategories(): Promise<string[]> {
    const plugins = Array.from(this.pluginCatalog.values());
    const categories = new Set(plugins.map(p => p.category));
    return Array.from(categories);
  }

  async getFeaturedPlugins(): Promise<PluginMetadata[]> {
    const plugins = Array.from(this.pluginCatalog.values());
    return plugins
      .filter(p => p.status === 'active')
      .sort((a, b) => b.stats.rating - a.stats.rating)
      .slice(0, 6);
  }

  async getPopularPlugins(): Promise<PluginMetadata[]> {
    const plugins = Array.from(this.pluginCatalog.values());
    return plugins
      .filter(p => p.status === 'active')
      .sort((a, b) => b.stats.downloads - a.stats.downloads)
      .slice(0, 10);
  }
}

// Export singleton instance
export const pluginStoreManager = new PluginStoreManager();
