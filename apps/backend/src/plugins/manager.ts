import { FastifyInstance } from 'fastify';
import { Plugin, PluginManager } from './types';
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
      await plugin.register(this.app);
      this.loadedPlugins.push(plugin);
      this.app.log.info(`Plugin loaded: ${plugin.name} ${plugin.version || ''}`);
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
}
