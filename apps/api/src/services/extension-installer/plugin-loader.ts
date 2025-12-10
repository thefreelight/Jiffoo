/**
 * Plugin Dynamic Loader
 * 
 * 动态加载 extensions/plugins/ 目录中的插件
 * 支持 internal-fastify 和 external-http 两种运行时类型
 * 
 * 基于 .kiro/specs/single-tenant-core-architecture/design.md
 */

import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { InstalledPlugin, PluginManifest, PluginRuntimeType } from './types';
import { LoggerService } from '@/core/logger/unified-logger';

// 扩展插件目录的绝对路径
const EXTENSIONS_PLUGINS_DIR = path.join(process.cwd(), 'extensions', 'plugins');

// 已加载的插件记录
const loadedPlugins: Map<string, LoadedPluginInfo> = new Map();

/** 已加载插件信息 */
export interface LoadedPluginInfo {
  slug: string;
  name: string;
  version: string;
  runtimeType: PluginRuntimeType;
  status: 'loaded' | 'failed' | 'disabled';
  error?: string;
  loadedAt: Date;
}

/** 插件加载选项 */
export interface PluginLoadOptions {
  /** 是否启用插件（默认 true） */
  enabled?: boolean;
  /** 自定义前缀（默认 /api/plugins/{slug}/api） */
  prefix?: string;
  /** 插件配置 */
  config?: Record<string, any>;
}

/**
 * 读取插件 manifest
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
 * 读取插件的 .installed.json 元数据
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
 * 加载单个 internal-fastify 插件
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

  // 检查入口文件是否存在
  if (!existsSync(entryPath)) {
    throw new Error(`Plugin entry module not found: ${entryPath}`);
  }

  // 动态导入插件模块
  const pluginModule = await import(entryPath);
  const pluginFn = pluginModule.default || pluginModule;

  if (typeof pluginFn !== 'function') {
    throw new Error(`Plugin ${slug} does not export a valid Fastify plugin function`);
  }

  // 注册插件到 Fastify
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
 * 加载单个 external-http 插件（代理模式）
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

  // 注册代理路由
  const prefix = options.prefix || `/api/plugins/${slug}/api`;
  
  // 简单的代理实现 - 将请求转发到外部服务
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
 * 加载单个插件
 */
export async function loadPlugin(
  fastify: FastifyInstance,
  slug: string,
  options: PluginLoadOptions = {}
): Promise<LoadedPluginInfo> {
  const pluginDir = path.join(EXTENSIONS_PLUGINS_DIR, slug);

  // 检查插件目录是否存在
  if (!existsSync(pluginDir)) {
    throw new Error(`Plugin directory not found: ${pluginDir}`);
  }

  // 读取 manifest
  const manifest = await readPluginManifest(pluginDir);
  if (!manifest) {
    throw new Error(`Plugin manifest not found in ${pluginDir}`);
  }

  // 检查是否启用
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
 * 加载所有已安装的插件
 */
export async function loadAllPlugins(
  fastify: FastifyInstance,
  options: { skipOnError?: boolean } = {}
): Promise<LoadedPluginInfo[]> {
  const results: LoadedPluginInfo[] = [];

  // 确保目录存在
  if (!existsSync(EXTENSIONS_PLUGINS_DIR)) {
    LoggerService.logSystem('No extensions/plugins directory found, skipping plugin loading');
    return results;
  }

  // 读取所有插件目录
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
 * 获取已加载的插件列表
 */
export function getLoadedPlugins(): LoadedPluginInfo[] {
  return Array.from(loadedPlugins.values());
}

/**
 * 获取单个已加载的插件信息
 */
export function getLoadedPlugin(slug: string): LoadedPluginInfo | undefined {
  return loadedPlugins.get(slug);
}

/**
 * 检查插件是否已加载
 */
export function isPluginLoaded(slug: string): boolean {
  const info = loadedPlugins.get(slug);
  return info?.status === 'loaded';
}

