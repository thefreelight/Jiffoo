/**
 * Plugin Dynamic Loader
 * 
 * Dynamically load plugins from extensions/plugins/ directory
 * Support internal-fastify and external-http runtime types
 * 
 * Based on .kiro/specs/single-tenant-core-architecture/design.md
 */

import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { InstalledPlugin, PluginManifest, PluginRuntimeType } from './types';
import { LoggerService } from '@/core/logger/unified-logger';

// Absolute path to the extensions plugins directory
const EXTENSIONS_PLUGINS_DIR = path.join(process.cwd(), 'extensions', 'plugins');

// Loaded plugins registry
const loadedPlugins: Map<string, LoadedPluginInfo> = new Map();

/** Loaded plugin information */
export interface LoadedPluginInfo {
  slug: string;
  name: string;
  version: string;
  runtimeType: PluginRuntimeType;
  status: 'loaded' | 'failed' | 'disabled';
  error?: string;
  loadedAt: Date;
}

/** Plugin loading options */
export interface PluginLoadOptions {
  /** Whether to enable the plugin (default: true) */
  enabled?: boolean;
  /** Custom prefix (default: /api/plugins/{slug}/api) */
  prefix?: string;
  /** Plugin configuration */
  config?: Record<string, any>;
}

/**
 * Read plugin manifest
 */
async function readPluginManifest(pluginDir: string): Promise<PluginManifest | null> {
  const manifestPath = path.join(pluginDir, 'manifest.json');
  try {
    const content = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(content) as PluginManifest;
  } catch (error) {
    return null;
  }
}

/**
 * Read plugin .installed.json metadata
 */
async function readInstalledMeta(pluginDir: string): Promise<InstalledPlugin | null> {
  const metaPath = path.join(pluginDir, '.installed.json');
  try {
    const content = await fs.readFile(metaPath, 'utf-8');
    return JSON.parse(content) as InstalledPlugin;
  } catch (error) {
    return null;
  }
}

/**
 * Load a single internal-fastify plugin
 */
async function loadInternalPlugin(
  fastify: FastifyInstance,
  pluginDir: string,
  manifest: PluginManifest,
  options: PluginLoadOptions = {}
): Promise<LoadedPluginInfo> {
  const slug = manifest.slug;
  const entryModule = manifest.entryModule || 'server/index.js';
  const entryPath = path.join(pluginDir, entryModule);

  // Check if entry file exists
  if (!existsSync(entryPath)) {
    throw new Error(`Plugin entry module not found: ${entryPath}`);
  }

  // Dynamically import plugin module
  const pluginModule = await import(entryPath);
  const pluginFn = pluginModule.default || pluginModule;

  if (typeof pluginFn !== 'function') {
    throw new Error(`Plugin ${slug} does not export a valid Fastify plugin function`);
  }

  // Register plugin with Fastify
  const prefix = options.prefix || `/api/plugins/${slug}/api`;
  await fastify.register(pluginFn, {
    prefix,
    ...options.config,
  });

  LoggerService.logSystem(`Loaded internal-fastify plugin: ${slug} at ${prefix}`);

  return {
    slug,
    name: manifest.name,
    version: manifest.version,
    runtimeType: 'internal-fastify',
    status: 'loaded',
    loadedAt: new Date(),
  };
}

/**
 * Load a single external-http plugin (proxy mode)
 */
async function loadExternalPlugin(
  fastify: FastifyInstance,
  manifest: PluginManifest,
  options: PluginLoadOptions = {}
): Promise<LoadedPluginInfo> {
  const slug = manifest.slug;
  const baseUrl = manifest.externalBaseUrl;

  if (!baseUrl) {
    throw new Error(`Plugin ${slug} is external-http but missing externalBaseUrl`);
  }

  // Register proxy routes
  const prefix = options.prefix || `/api/plugins/${slug}/api`;

  // Simple proxy implementation - forward requests to external services
  fastify.all(`${prefix}/*`, async (request, reply) => {
    const targetPath = (request.params as any)['*'] || '';
    const targetUrl = `${baseUrl}/${targetPath}`;

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: request.headers as any,
        body: request.method !== 'GET' && request.method !== 'HEAD'
          ? JSON.stringify(request.body)
          : undefined,
      });

      const data = await response.json();
      return reply.status(response.status).send(data);
    } catch (error: any) {
      return reply.status(502).send({
        error: 'Plugin proxy error',
        message: error.message
      });
    }
  });

  LoggerService.logSystem(`Loaded external-http plugin: ${slug} -> ${baseUrl}`);

  return {
    slug,
    name: manifest.name,
    version: manifest.version,
    runtimeType: 'external-http',
    status: 'loaded',
    loadedAt: new Date(),
  };
}

/**
 * Load a single plugin
 */
export async function loadPlugin(
  fastify: FastifyInstance,
  slug: string,
  options: PluginLoadOptions = {}
): Promise<LoadedPluginInfo> {
  const pluginDir = path.join(EXTENSIONS_PLUGINS_DIR, slug);

  // Check if plugin directory exists
  if (!existsSync(pluginDir)) {
    throw new Error(`Plugin directory not found: ${pluginDir}`);
  }

  // Read manifest
  const manifest = await readPluginManifest(pluginDir);
  if (!manifest) {
    throw new Error(`Plugin manifest not found in ${pluginDir}`);
  }

  // Check if enabled
  if (options.enabled === false) {
    const info: LoadedPluginInfo = {
      slug: manifest.slug,
      name: manifest.name,
      version: manifest.version,
      runtimeType: manifest.runtimeType,
      status: 'disabled',
      loadedAt: new Date(),
    };
    loadedPlugins.set(slug, info);
    return info;
  }

  try {
    let info: LoadedPluginInfo;

    if (manifest.runtimeType === 'internal-fastify') {
      info = await loadInternalPlugin(fastify, pluginDir, manifest, options);
    } else if (manifest.runtimeType === 'external-http') {
      info = await loadExternalPlugin(fastify, manifest, options);
    } else {
      throw new Error(`Unknown plugin runtime type: ${manifest.runtimeType}`);
    }

    loadedPlugins.set(slug, info);
    return info;
  } catch (error: any) {
    const info: LoadedPluginInfo = {
      slug: manifest.slug,
      name: manifest.name,
      version: manifest.version,
      runtimeType: manifest.runtimeType,
      status: 'failed',
      error: error.message,
      loadedAt: new Date(),
    };
    loadedPlugins.set(slug, info);
    LoggerService.logError(error, { context: `Loading plugin ${slug}` });
    throw error;
  }
}

/**
 * Load all installed plugins
 */
export async function loadAllPlugins(
  fastify: FastifyInstance,
  options: { skipOnError?: boolean } = {}
): Promise<LoadedPluginInfo[]> {
  const results: LoadedPluginInfo[] = [];

  // Ensure directory exists
  if (!existsSync(EXTENSIONS_PLUGINS_DIR)) {
    LoggerService.logSystem('No extensions/plugins directory found, skipping plugin loading');
    return results;
  }

  // Read all plugin directories
  const entries = await fs.readdir(EXTENSIONS_PLUGINS_DIR, { withFileTypes: true });
  const pluginDirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'));

  LoggerService.logSystem(`Found ${pluginDirs.length} plugins in extensions/plugins/`);

  for (const dir of pluginDirs) {
    try {
      const info = await loadPlugin(fastify, dir.name);
      results.push(info);
    } catch (error: any) {
      if (options.skipOnError) {
        LoggerService.logError(error, { context: `Skipping failed plugin: ${dir.name}` });
        results.push({
          slug: dir.name,
          name: dir.name,
          version: 'unknown',
          runtimeType: 'internal-fastify',
          status: 'failed',
          error: error.message,
          loadedAt: new Date(),
        });
      } else {
        throw error;
      }
    }
  }

  return results;
}

/**
 * Get list of loaded plugins
 */
export function getLoadedPlugins(): LoadedPluginInfo[] {
  return Array.from(loadedPlugins.values());
}

/**
 * Get information for a single loaded plugin
 */
export function getLoadedPlugin(slug: string): LoadedPluginInfo | undefined {
  return loadedPlugins.get(slug);
}

/**
 * Check if a plugin is loaded
 */
export function isPluginLoaded(slug: string): boolean {
  const info = loadedPlugins.get(slug);
  return info?.status === 'loaded';
}
