/**
 * Plugin File System Installer Service
 * 
 * 处理插件的 ZIP 安装到文件系统、卸载和列表
 * 注意：这个是文件系统层面的安装，与现有的 plugin-installer.ts (数据库层面) 互补
 */

import { Readable } from 'stream';
import path from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  IPluginInstaller,
  InstalledPlugin,
  PluginManifest,
} from './types';
import {
  extractZipToTemp,
  cleanupTemp,
  readJsonFile,
  validatePluginManifest,
  getPluginDir,
  moveDir,
  dirExists,
  removeDir,
  ensureDir,
} from './utils';

/** 已安装插件的元数据文件名 */
const INSTALLED_META_FILE = '.installed.json';

/**
 * 插件文件系统安装器实现
 */
export class PluginFsInstaller implements IPluginInstaller {
  /**
   * 从 ZIP 安装插件到文件系统
   */
  async install(zipStream: Readable): Promise<InstalledPlugin> {
    let tempDir: string | null = null;

    try {
      // 1. 解压到临时目录
      tempDir = await extractZipToTemp(zipStream);

      // 2. 读取 manifest.json
      const manifestPath = path.join(tempDir, 'manifest.json');
      const manifest = await readJsonFile<PluginManifest>(manifestPath);

      // 3. 校验 manifest
      validatePluginManifest(manifest);

      // 4. 确定目标目录
      const targetDir = getPluginDir(manifest.slug);

      // 5. 检查是否已存在（更新场景）
      const exists = await dirExists(targetDir);
      const now = new Date();

      // 6. 移动到目标目录
      await moveDir(tempDir, targetDir);
      tempDir = null; // 已移动，不需要清理

      // 7. 创建已安装元数据
      const installedPlugin: InstalledPlugin = {
        id: uuidv4(),
        slug: manifest.slug,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description || '',
        category: manifest.category || 'general',
        runtimeType: manifest.runtimeType,
        entryModule: manifest.entryModule,
        externalBaseUrl: manifest.externalBaseUrl,
        source: 'local-zip',
        fsPath: targetDir,
        permissions: manifest.permissions,
        author: manifest.author,
        authorUrl: manifest.authorUrl,
        installedAt: exists ? now : now, // TODO: 保留原安装时间
        updatedAt: now,
      };

      // 8. 写入元数据文件
      await this.saveInstalledMeta(manifest.slug, installedPlugin);

      return installedPlugin;
    } finally {
      // 清理临时目录
      if (tempDir) {
        await cleanupTemp(tempDir);
      }
    }
  }

  /**
   * 卸载插件
   */
  async uninstall(slug: string): Promise<void> {
    const targetDir = getPluginDir(slug);

    if (!(await dirExists(targetDir))) {
      throw new Error(`Plugin "${slug}" is not installed`);
    }

    await removeDir(targetDir);
  }

  /**
   * 列出已安装的插件
   */
  async list(): Promise<InstalledPlugin[]> {
    const pluginsDir = getPluginDir();
    
    // 确保目录存在
    await ensureDir(pluginsDir);

    const entries = await fs.readdir(pluginsDir, { withFileTypes: true });
    const plugins: InstalledPlugin[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const plugin = await this.get(entry.name);
        if (plugin) {
          plugins.push(plugin);
        }
      }
    }

    return plugins;
  }

  /**
   * 获取已安装插件详情
   */
  async get(slug: string): Promise<InstalledPlugin | null> {
    const targetDir = getPluginDir(slug);

    if (!(await dirExists(targetDir))) {
      return null;
    }

    // 优先读取 .installed.json
    const metaPath = path.join(targetDir, INSTALLED_META_FILE);
    try {
      return await readJsonFile<InstalledPlugin>(metaPath);
    } catch {
      // 如果没有元数据文件，从 manifest.json 重建
      return this.rebuildMetaFromManifest(slug, targetDir);
    }
  }

  /**
   * 保存已安装元数据
   */
  private async saveInstalledMeta(slug: string, meta: InstalledPlugin): Promise<void> {
    const targetDir = getPluginDir(slug);
    const metaPath = path.join(targetDir, INSTALLED_META_FILE);
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  }

  /**
   * 从 manifest 重建元数据
   */
  private async rebuildMetaFromManifest(
    slug: string,
    targetDir: string
  ): Promise<InstalledPlugin | null> {
    try {
      const manifestPath = path.join(targetDir, 'manifest.json');
      const manifest = await readJsonFile<PluginManifest>(manifestPath);
      const stat = await fs.stat(targetDir);

      return {
        id: uuidv4(),
        slug: manifest.slug || slug,
        name: manifest.name || slug,
        version: manifest.version || '0.0.0',
        description: manifest.description || '',
        category: manifest.category || 'general',
        runtimeType: manifest.runtimeType || 'internal-fastify',
        entryModule: manifest.entryModule,
        externalBaseUrl: manifest.externalBaseUrl,
        source: 'local-zip',
        fsPath: targetDir,
        permissions: manifest.permissions,
        author: manifest.author,
        authorUrl: manifest.authorUrl,
        installedAt: stat.birthtime,
        updatedAt: stat.mtime,
      };
    } catch {
      return null;
    }
  }
}

/** 单例实例 */
export const pluginFsInstaller = new PluginFsInstaller();

