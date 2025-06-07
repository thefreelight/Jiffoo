import { FastifyInstance } from 'fastify';
import { Plugin, PluginManager, PluginLicenseType } from './types';
import { licenseService } from './license-service';
import { ecosystemController } from './ecosystem-control';
import { promises as fs } from 'fs';
import path from 'path';

export class DefaultPluginManager implements PluginManager {
  private loadedPlugins: Plugin[] = [];
  private app: FastifyInstance;

  constructor(app: FastifyInstance) {
    this.app = app;
  }

  async loadPlugin(plugin: Plugin): Promise<void> {
    try {
      // 1. 验证插件生态控制（官方认证）
      const authenticityCheck = await ecosystemController.validatePluginAuthenticity(plugin);
      if (!authenticityCheck.valid) {
        if (authenticityCheck.action === 'BLOCK') {
          throw new Error(`Plugin blocked: ${authenticityCheck.reason}`);
        } else if (authenticityCheck.action === 'WARN') {
          this.app.log.warn(`Plugin warning: ${authenticityCheck.reason}`);
        }
      }

      // 2. 验证插件许可证
      const licenseValid = await this.validatePluginLicense(plugin);
      if (!licenseValid) {
        throw new Error(`Invalid license for plugin ${plugin.name}`);
      }

      await plugin.register(this.app);
      this.loadedPlugins.push(plugin);
      this.app.log.info(`Plugin loaded: ${plugin.name} ${plugin.version || ''} (License: ${plugin.license.type}, Authenticated: ${authenticityCheck.valid})`);
    } catch (error) {
      this.app.log.error(`Failed to load plugin ${plugin.name}:`, error);
      throw error;
    }
  }

  async loadPluginsFromDirectory(directory: string): Promise<void> {
    try {
      const files = await fs.readdir(directory);
      const pluginFiles = files.filter(file =>
        file.endsWith('.ts') || file.endsWith('.js')
      );

      for (const file of pluginFiles) {
        try {
          const pluginPath = path.join(directory, file);
          const pluginModule = await import(pluginPath);

          if (pluginModule.default && typeof pluginModule.default.register === 'function') {
            await this.loadPlugin(pluginModule.default);
          }
        } catch (error) {
          this.app.log.warn(`Failed to load plugin from ${file}:`, error);
        }
      }
    } catch (error) {
      this.app.log.warn(`Failed to read plugins directory ${directory}:`, error);
    }
  }

  getLoadedPlugins(): Plugin[] {
    return [...this.loadedPlugins];
  }

  async validatePluginLicense(plugin: Plugin): Promise<boolean> {
    try {
      const result = await licenseService.validateLicense(plugin.name, plugin.license);

      if (!result.valid) {
        this.app.log.warn(`Plugin ${plugin.name} license validation failed: ${result.reason}`);
        return false;
      }

      // 检查许可证是否即将过期（7天内）
      if (result.expiresAt) {
        const daysUntilExpiry = Math.ceil((result.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry <= 7) {
          this.app.log.warn(`Plugin ${plugin.name} license expires in ${daysUntilExpiry} days`);
        }
      }

      return true;
    } catch (error) {
      this.app.log.error(`License validation error for plugin ${plugin.name}:`, error);
      return false;
    }
  }
}
