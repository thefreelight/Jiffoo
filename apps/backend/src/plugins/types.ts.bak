import { FastifyInstance } from 'fastify';

export enum PluginLicenseType {
  MIT = 'MIT',
  COMMERCIAL = 'COMMERCIAL',
  PREMIUM = 'PREMIUM',
  ENTERPRISE = 'ENTERPRISE'
}

export interface PluginLicense {
  type: PluginLicenseType;
  key?: string;
  validUntil?: Date;
  features?: string[];
  maxUsers?: number;
  domain?: string;
}

export interface Plugin {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  license: PluginLicense;
  register(app: FastifyInstance): Promise<void>;
  validateLicense?(): Promise<boolean>;
}

export interface PluginManager {
  loadPlugin(plugin: Plugin): Promise<void>;
  loadPluginsFromDirectory(directory: string): Promise<void>;
  getLoadedPlugins(): Plugin[];
  validatePluginLicense(plugin: Plugin): Promise<boolean>;
}
