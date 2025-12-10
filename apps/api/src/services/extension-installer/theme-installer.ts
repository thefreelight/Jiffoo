/**
 * Theme Installer Service
 * 
 * 处理主题的 ZIP 安装、卸载和列表
 */

import { Readable } from 'stream';
import path from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  IThemeInstaller,
  ThemeTarget,
  InstalledTheme,
  ThemeManifest,
} from './types';
import {
  extractZipToTemp,
  cleanupTemp,
  readJsonFile,
  validateThemeManifest,
  getThemeDir,
  moveDir,
  dirExists,
  removeDir,
  ensureDir,
} from './utils';

/** 已安装主题的元数据文件名 */
const INSTALLED_META_FILE = '.installed.json';

/**
 * 主题安装器实现
 */
export class ThemeInstaller implements IThemeInstaller {
  /**
   * 从 ZIP 安装主题
   */
  async install(target: ThemeTarget, zipStream: Readable): Promise<InstalledTheme> {
    let tempDir: string | null = null;

    try {
      // 1. 解压到临时目录
      tempDir = await extractZipToTemp(zipStream);

      // 2. 读取 theme.json
      const manifestPath = path.join(tempDir, 'theme.json');
      const manifest = await readJsonFile<ThemeManifest>(manifestPath);

      // 3. 校验 manifest
      validateThemeManifest(manifest);

      // 4. 确定目标目录
      const targetDir = getThemeDir(target, manifest.slug);

      // 5. 检查是否已存在（更新场景）
      const exists = await dirExists(targetDir);
      const now = new Date();

      // 6. 移动到目标目录
      await moveDir(tempDir, targetDir);
      tempDir = null; // 已移动，不需要清理

      // 7. 创建已安装元数据
      const installedTheme: InstalledTheme = {
        id: uuidv4(),
        slug: manifest.slug,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description || '',
        category: manifest.category || 'general',
        target,
        source: 'local-zip',
        fsPath: targetDir,
        thumbnail: manifest.thumbnail,
        author: manifest.author,
        authorUrl: manifest.authorUrl,
        installedAt: exists ? now : now, // TODO: 保留原安装时间
        updatedAt: now,
      };

      // 8. 写入元数据文件
      await this.saveInstalledMeta(target, manifest.slug, installedTheme);

      return installedTheme;
    } finally {
      // 清理临时目录
      if (tempDir) {
        await cleanupTemp(tempDir);
      }
    }
  }

  /**
   * 卸载主题
   */
  async uninstall(target: ThemeTarget, slug: string): Promise<void> {
    const targetDir = getThemeDir(target, slug);

    if (!(await dirExists(targetDir))) {
      throw new Error(`Theme "${slug}" is not installed for target "${target}"`);
    }

    await removeDir(targetDir);
  }

  /**
   * 列出已安装的主题
   */
  async list(target: ThemeTarget): Promise<InstalledTheme[]> {
    const themesDir = getThemeDir(target);
    
    // 确保目录存在
    await ensureDir(themesDir);

    const entries = await fs.readdir(themesDir, { withFileTypes: true });
    const themes: InstalledTheme[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const theme = await this.get(target, entry.name);
        if (theme) {
          themes.push(theme);
        }
      }
    }

    return themes;
  }

  /**
   * 获取已安装主题详情
   */
  async get(target: ThemeTarget, slug: string): Promise<InstalledTheme | null> {
    const targetDir = getThemeDir(target, slug);

    if (!(await dirExists(targetDir))) {
      return null;
    }

    // 优先读取 .installed.json
    const metaPath = path.join(targetDir, INSTALLED_META_FILE);
    try {
      return await readJsonFile<InstalledTheme>(metaPath);
    } catch {
      // 如果没有元数据文件，从 theme.json 重建
      return this.rebuildMetaFromManifest(target, slug, targetDir);
    }
  }

  /**
   * 保存已安装元数据
   */
  private async saveInstalledMeta(
    target: ThemeTarget,
    slug: string,
    meta: InstalledTheme
  ): Promise<void> {
    const targetDir = getThemeDir(target, slug);
    const metaPath = path.join(targetDir, INSTALLED_META_FILE);
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  }

  /**
   * 从 manifest 重建元数据
   */
  private async rebuildMetaFromManifest(
    target: ThemeTarget,
    slug: string,
    targetDir: string
  ): Promise<InstalledTheme | null> {
    try {
      const manifestPath = path.join(targetDir, 'theme.json');
      const manifest = await readJsonFile<ThemeManifest>(manifestPath);
      const stat = await fs.stat(targetDir);

      return {
        id: uuidv4(),
        slug: manifest.slug || slug,
        name: manifest.name || slug,
        version: manifest.version || '0.0.0',
        description: manifest.description || '',
        category: manifest.category || 'general',
        target,
        source: 'local-zip',
        fsPath: targetDir,
        thumbnail: manifest.thumbnail,
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
export const themeInstaller = new ThemeInstaller();

