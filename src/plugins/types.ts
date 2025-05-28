import { FastifyInstance } from 'fastify';

export interface Plugin {
  name: string;
  version?: string;
  description?: string;
  register(app: FastifyInstance): Promise<void>;
}

export interface PluginManager {
  loadPlugin(plugin: Plugin): Promise<void>;
  loadPluginsFromDirectory(directory: string): Promise<void>;
  getLoadedPlugins(): Plugin[];
}
