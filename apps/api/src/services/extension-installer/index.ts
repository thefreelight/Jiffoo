/**
 * Extension Installer Service
 * 
 * 统一的扩展安装器入口，支持主题和插件的 ZIP 安装
 * 基于 .kiro/specs/single-tenant-core-architecture/design.md
 */

import { Readable } from 'stream';
import {
  IExtensionInstaller,
  ExtensionKind,
  InstallResult,
  UninstallResult,
  InstalledExtensionMeta,
  ThemeTarget,
} from './types';
import { themeInstaller } from './theme-installer';
import { pluginFsInstaller } from './plugin-fs-installer';

// Re-export types
export * from './types';

/**
 * 统一扩展安装器实现
 */
export class ExtensionInstaller implements IExtensionInstaller {
  /**
   * 从 ZIP 安装扩展
   * 
   * 内部做三件事：
   * 1. 解压到正确目录 - 根据 kind 决定目标路径
   * 2. 读取并校验 manifest - theme.json / manifest.json
   * 3. 保存元数据 - .installed.json
   */
  async installFromZip(kind: ExtensionKind, zipStream: Readable): Promise<InstallResult> {
    switch (kind) {
      case 'theme-shop': {
        const theme = await themeInstaller.install('shop', zipStream);
        return {
          kind,
          slug: theme.slug,
          version: theme.version,
          source: theme.source,
          fsPath: theme.fsPath,
        };
      }
      case 'theme-admin': {
        const theme = await themeInstaller.install('admin', zipStream);
        return {
          kind,
          slug: theme.slug,
          version: theme.version,
          source: theme.source,
          fsPath: theme.fsPath,
        };
      }
      case 'plugin': {
        const plugin = await pluginFsInstaller.install(zipStream);
        return {
          kind,
          slug: plugin.slug,
          version: plugin.version,
          source: plugin.source,
          fsPath: plugin.fsPath,
        };
      }
      default:
        throw new Error(`Unknown extension kind: ${kind}`);
    }
  }

  /**
   * 卸载扩展
   */
  async uninstall(kind: ExtensionKind, slug: string): Promise<UninstallResult> {
    try {
      switch (kind) {
        case 'theme-shop':
          await themeInstaller.uninstall('shop', slug);
          break;
        case 'theme-admin':
          await themeInstaller.uninstall('admin', slug);
          break;
        case 'plugin':
          await pluginFsInstaller.uninstall(slug);
          break;
        default:
          throw new Error(`Unknown extension kind: ${kind}`);
      }
      return { kind, slug, success: true };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 列出已安装的扩展
   */
  async listInstalled(kind: ExtensionKind): Promise<InstalledExtensionMeta[]> {
    switch (kind) {
      case 'theme-shop':
        return themeInstaller.list('shop');
      case 'theme-admin':
        return themeInstaller.list('admin');
      case 'plugin':
        return pluginFsInstaller.list();
      default:
        throw new Error(`Unknown extension kind: ${kind}`);
    }
  }

  /**
   * 获取扩展详情
   */
  async getInstalled(kind: ExtensionKind, slug: string): Promise<InstalledExtensionMeta | null> {
    switch (kind) {
      case 'theme-shop':
        return themeInstaller.get('shop', slug);
      case 'theme-admin':
        return themeInstaller.get('admin', slug);
      case 'plugin':
        return pluginFsInstaller.get(slug);
      default:
        throw new Error(`Unknown extension kind: ${kind}`);
    }
  }
}

/** 单例实例 */
export const extensionInstaller = new ExtensionInstaller();

// 导出子安装器（方便直接调用）
export { themeInstaller } from './theme-installer';
export { pluginFsInstaller } from './plugin-fs-installer';

// 导出插件动态加载器
export {
  loadPlugin,
  loadAllPlugins,
  getLoadedPlugins,
  getLoadedPlugin,
  isPluginLoaded,
  type LoadedPluginInfo,
  type PluginLoadOptions,
} from './plugin-loader';

