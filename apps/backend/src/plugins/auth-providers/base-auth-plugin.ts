/**
 * Base Authentication Provider Plugin
 * All third-party login plugins must extend this class
 */

export interface AuthProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  avatar?: string;
  name?: string;
  accessToken?: string;
  refreshToken?: string;
  profile?: any; // Raw profile data from provider
}

export abstract class BaseAuthPlugin {
  protected config: AuthProviderConfig;
  protected pluginId: string;
  protected pluginName: string;
  protected version: string;
  protected price: number; // Plugin price in cents
  protected isLicensed: boolean = false;

  constructor(
    pluginId: string,
    pluginName: string,
    version: string,
    price: number,
    config: AuthProviderConfig
  ) {
    this.pluginId = pluginId;
    this.pluginName = pluginName;
    this.version = version;
    this.price = price;
    this.config = config;
  }

  // Abstract methods that must be implemented by each provider
  abstract generateAuthUrl(state: string): string;
  abstract exchangeCodeForUser(code: string, state: string): Promise<UserProfile>;
  abstract refreshUserToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string }>;

  // Plugin metadata
  getPluginInfo() {
    return {
      id: this.pluginId,
      name: this.pluginName,
      version: this.version,
      price: this.price,
      type: 'auth-provider',
      isLicensed: this.isLicensed,
    };
  }

  // License validation
  async validateLicense(licenseKey: string): Promise<boolean> {
    // This will integrate with the licensing system
    // For now, return true for development
    this.isLicensed = true;
    return true;
  }

  // Check if plugin is properly configured
  isConfigured(): boolean {
    return !!(
      this.config.clientId &&
      this.config.clientSecret &&
      this.config.redirectUri
    );
  }

  // Get required configuration fields
  getConfigSchema() {
    return {
      clientId: {
        type: 'string',
        required: true,
        label: 'Client ID',
        description: `${this.pluginName} application client ID`,
      },
      clientSecret: {
        type: 'string',
        required: true,
        label: 'Client Secret',
        description: `${this.pluginName} application client secret`,
        sensitive: true,
      },
      redirectUri: {
        type: 'string',
        required: true,
        label: 'Redirect URI',
        description: 'OAuth callback URL',
        default: '/auth/callback/' + this.pluginId,
      },
      scope: {
        type: 'array',
        required: false,
        label: 'Scope',
        description: 'OAuth scope permissions',
        default: this.getDefaultScope(),
      },
    };
  }

  // Default scope for this provider
  protected abstract getDefaultScope(): string[];

  // Update configuration
  updateConfig(newConfig: Partial<AuthProviderConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  // Plugin activation/deactivation hooks
  async onActivate(): Promise<void> {
    console.log(`Auth plugin ${this.pluginName} activated`);
  }

  async onDeactivate(): Promise<void> {
    console.log(`Auth plugin ${this.pluginName} deactivated`);
  }

  // Error handling
  protected handleError(error: any, context: string): never {
    console.error(`${this.pluginName} error in ${context}:`, error);
    throw new Error(`${this.pluginName} authentication failed: ${error.message}`);
  }

  // Utility method to make HTTP requests
  protected async makeRequest(url: string, options: RequestInit = {}): Promise<any> {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `Jiffoo-Mall-${this.pluginName}-Plugin/${this.version}`,
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      this.handleError(error, 'HTTP request');
    }
  }
}

// Plugin registry for auth providers
export class AuthPluginRegistry {
  private static plugins: Map<string, BaseAuthPlugin> = new Map();

  static register(plugin: BaseAuthPlugin) {
    this.plugins.set(plugin.getPluginInfo().id, plugin);
  }

  static unregister(pluginId: string) {
    this.plugins.delete(pluginId);
  }

  static get(pluginId: string): BaseAuthPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  static getAll(): BaseAuthPlugin[] {
    return Array.from(this.plugins.values());
  }

  static getAvailable(): BaseAuthPlugin[] {
    return this.getAll().filter(plugin => plugin.isConfigured());
  }

  static getLicensed(): BaseAuthPlugin[] {
    return this.getAll().filter(plugin => plugin.getPluginInfo().isLicensed);
  }
}

// Plugin manager for auth providers
export class AuthPluginManager {
  static async loadPlugin(pluginId: string, config: AuthProviderConfig): Promise<void> {
    try {
      // Dynamic import of plugin
      const pluginModule = await import(`./providers/${pluginId}-plugin`);
      const PluginClass = pluginModule.default;
      
      const plugin = new PluginClass(config);
      
      // Validate license
      const licenseKey = await this.getLicenseKey(pluginId);
      if (licenseKey) {
        await plugin.validateLicense(licenseKey);
      }

      // Register plugin
      AuthPluginRegistry.register(plugin);
      
      // Activate plugin
      await plugin.onActivate();
      
      console.log(`Auth plugin ${pluginId} loaded successfully`);
    } catch (error) {
      console.error(`Failed to load auth plugin ${pluginId}:`, error);
      throw error;
    }
  }

  static async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = AuthPluginRegistry.get(pluginId);
    if (plugin) {
      await plugin.onDeactivate();
      AuthPluginRegistry.unregister(pluginId);
      console.log(`Auth plugin ${pluginId} unloaded`);
    }
  }

  private static async getLicenseKey(pluginId: string): Promise<string | null> {
    // This will integrate with the licensing system
    // For now, return null
    return null;
  }
}
