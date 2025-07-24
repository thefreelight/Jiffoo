import { EventEmitter } from 'events';
import semver from 'semver';
import { Logger } from '../logger/logger';

export interface VersionInfo {
  current: string;
  latest: string;
  hasUpdate: boolean;
  releaseNotes: string;
  downloadUrl: string;
  publishedAt: string;
  prerelease: boolean;
  assets: Array<{
    name: string;
    downloadUrl: string;
    size: number;
  }>;
}

export interface VersionCheckConfig {
  repository: string; // 'thefreelight/Jiffoo'
  checkInterval: number; // 检查间隔（毫秒）
  includePrerelease: boolean;
  autoCheck: boolean;
}

/**
 * 版本管理器
 * 负责检测GitHub上的新版本发布
 */
export class VersionManager extends EventEmitter {
  private logger: Logger;
  private config: VersionCheckConfig;
  private currentVersion: string;
  private checkTimer?: NodeJS.Timeout;
  private lastCheckTime?: Date;
  private latestVersionInfo?: VersionInfo;

  constructor(config: VersionCheckConfig) {
    super();
    this.logger = new Logger('VersionManager');
    this.config = config;
    this.currentVersion = this.getCurrentVersion();
    
    if (config.autoCheck) {
      this.startPeriodicCheck();
    }
  }

  /**
   * 获取当前版本
   */
  private getCurrentVersion(): string {
    try {
      const packageJson = require('../../../../../package.json');
      return packageJson.version;
    } catch (error) {
      this.logger.error('Failed to read current version from package.json', error);
      return '0.0.0';
    }
  }

  /**
   * 开始定期检查
   */
  public startPeriodicCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    this.checkTimer = setInterval(async () => {
      try {
        await this.checkForUpdates();
      } catch (error) {
        this.logger.error('Periodic version check failed', error);
      }
    }, this.config.checkInterval);

    this.logger.info(`Started periodic version check every ${this.config.checkInterval}ms`);
  }

  /**
   * 停止定期检查
   */
  public stopPeriodicCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
      this.logger.info('Stopped periodic version check');
    }
  }

  /**
   * 检查更新
   */
  public async checkForUpdates(): Promise<VersionInfo> {
    this.logger.info('Checking for updates...');
    this.lastCheckTime = new Date();

    try {
      const latestRelease = await this.fetchLatestRelease();
      const versionInfo = this.buildVersionInfo(latestRelease);
      
      this.latestVersionInfo = versionInfo;

      if (versionInfo.hasUpdate) {
        this.logger.info(`New version available: ${versionInfo.latest} (current: ${versionInfo.current})`);
        this.emit('update_available', versionInfo);
      } else {
        this.logger.info('No updates available');
        this.emit('no_update', versionInfo);
      }

      this.emit('check_completed', versionInfo);
      return versionInfo;

    } catch (error) {
      this.logger.error('Failed to check for updates', error);
      this.emit('check_failed', error);
      throw error;
    }
  }

  /**
   * 从GitHub API获取最新发布信息
   */
  private async fetchLatestRelease(): Promise<any> {
    const url = this.config.includePrerelease 
      ? `https://api.github.com/repos/${this.config.repository}/releases`
      : `https://api.github.com/repos/${this.config.repository}/releases/latest`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Jiffoo-Update-System'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // 如果包含预发布版本，返回第一个（最新的）
    if (this.config.includePrerelease && Array.isArray(data)) {
      return data[0];
    }
    
    return data;
  }

  /**
   * 构建版本信息对象
   */
  private buildVersionInfo(release: any): VersionInfo {
    const latestVersion = release.tag_name.replace(/^v/, ''); // 移除 'v' 前缀
    const hasUpdate = semver.gt(latestVersion, this.currentVersion);

    return {
      current: this.currentVersion,
      latest: latestVersion,
      hasUpdate,
      releaseNotes: release.body || '',
      downloadUrl: release.tarball_url,
      publishedAt: release.published_at,
      prerelease: release.prerelease,
      assets: (release.assets || []).map((asset: any) => ({
        name: asset.name,
        downloadUrl: asset.browser_download_url,
        size: asset.size
      }))
    };
  }

  /**
   * 获取最新版本信息
   */
  public getLatestVersionInfo(): VersionInfo | undefined {
    return this.latestVersionInfo;
  }

  /**
   * 获取最后检查时间
   */
  public getLastCheckTime(): Date | undefined {
    return this.lastCheckTime;
  }

  /**
   * 手动触发版本检查
   */
  public async manualCheck(): Promise<VersionInfo> {
    return await this.checkForUpdates();
  }

  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<VersionCheckConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.autoCheck !== undefined) {
      if (newConfig.autoCheck) {
        this.startPeriodicCheck();
      } else {
        this.stopPeriodicCheck();
      }
    } else if (newConfig.checkInterval && this.checkTimer) {
      // 重启定期检查以应用新的间隔
      this.startPeriodicCheck();
    }
  }

  /**
   * 销毁实例
   */
  public destroy(): void {
    this.stopPeriodicCheck();
    this.removeAllListeners();
  }
}
