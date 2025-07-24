import { EventEmitter } from 'events';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../logger/logger';

const execAsync = promisify(exec);

export interface ServiceConfig {
  name: string;
  type: 'docker' | 'pm2' | 'systemd' | 'kubernetes';
  config: any;
  healthCheck: {
    url?: string;
    command?: string;
    timeout: number;
    retries: number;
  };
}

export interface UpdatePackage {
  version: string;
  downloadUrl: string;
  checksum: string;
  signature?: string;
  extractPath: string;
}

/**
 * 热更新执行器
 * 负责执行具体的更新操作
 */
export class HotUpdateExecutor extends EventEmitter {
  private logger: Logger;
  private workingDir: string;
  private backupDir: string;
  private services: Map<string, ServiceConfig> = new Map();

  constructor(workingDir: string = '/tmp/jiffoo-updates') {
    super();
    this.logger = new Logger('HotUpdateExecutor');
    this.workingDir = workingDir;
    this.backupDir = path.join(workingDir, 'backups');
    
    this.initializeDirectories();
    this.loadServiceConfigs();
  }

  /**
   * 初始化工作目录
   */
  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.workingDir, { recursive: true });
      await fs.mkdir(this.backupDir, { recursive: true });
      this.logger.info(`Initialized working directories: ${this.workingDir}`);
    } catch (error) {
      this.logger.error('Failed to initialize directories', error);
      throw error;
    }
  }

  /**
   * 加载服务配置
   */
  private loadServiceConfigs(): void {
    // 默认服务配置
    const defaultServices: ServiceConfig[] = [
      {
        name: 'backend',
        type: 'pm2',
        config: {
          script: 'dist/server.js',
          name: 'jiffoo-backend',
          instances: 1
        },
        healthCheck: {
          url: 'http://localhost:3001/health',
          timeout: 5000,
          retries: 3
        }
      },
      {
        name: 'admin',
        type: 'pm2',
        config: {
          script: 'server.js',
          name: 'jiffoo-admin',
          cwd: './apps/admin',
          instances: 1
        },
        healthCheck: {
          url: 'http://localhost:3000/api/health',
          timeout: 5000,
          retries: 3
        }
      },
      {
        name: 'frontend',
        type: 'pm2',
        config: {
          script: 'server.js',
          name: 'jiffoo-frontend',
          cwd: './apps/frontend',
          instances: 1
        },
        healthCheck: {
          url: 'http://localhost:3002/api/health',
          timeout: 5000,
          retries: 3
        }
      }
    ];

    defaultServices.forEach(service => {
      this.services.set(service.name, service);
    });
  }

  /**
   * 下载更新包
   */
  public async downloadUpdatePackage(updatePackage: UpdatePackage): Promise<string> {
    this.logger.info(`Downloading update package for version ${updatePackage.version}`);
    
    const packagePath = path.join(this.workingDir, `update-${updatePackage.version}.tar.gz`);
    
    try {
      // 使用curl下载（生产环境中应该使用更安全的方法）
      const downloadCommand = `curl -L -o "${packagePath}" "${updatePackage.downloadUrl}"`;
      await execAsync(downloadCommand);
      
      // 验证校验和
      await this.verifyChecksum(packagePath, updatePackage.checksum);
      
      // 验证数字签名（如果提供）
      if (updatePackage.signature) {
        await this.verifySignature(packagePath, updatePackage.signature);
      }
      
      this.logger.info(`Successfully downloaded and verified update package: ${packagePath}`);
      return packagePath;
      
    } catch (error) {
      this.logger.error('Failed to download update package', error);
      throw error;
    }
  }

  /**
   * 验证校验和
   */
  private async verifyChecksum(filePath: string, expectedChecksum: string): Promise<void> {
    try {
      const { stdout } = await execAsync(`sha256sum "${filePath}"`);
      const actualChecksum = stdout.split(' ')[0];
      
      if (actualChecksum !== expectedChecksum) {
        throw new Error(`Checksum mismatch. Expected: ${expectedChecksum}, Actual: ${actualChecksum}`);
      }
      
      this.logger.info('Checksum verification passed');
    } catch (error) {
      this.logger.error('Checksum verification failed', error);
      throw error;
    }
  }

  /**
   * 验证数字签名
   */
  private async verifySignature(filePath: string, signature: string): Promise<void> {
    // 这里应该实现GPG签名验证
    // 暂时跳过实现
    this.logger.info('Signature verification skipped (not implemented)');
  }

  /**
   * 解压更新包
   */
  public async extractUpdatePackage(packagePath: string, extractPath: string): Promise<void> {
    this.logger.info(`Extracting update package to ${extractPath}`);
    
    try {
      await fs.mkdir(extractPath, { recursive: true });
      
      const extractCommand = `tar -xzf "${packagePath}" -C "${extractPath}" --strip-components=1`;
      await execAsync(extractCommand);
      
      this.logger.info('Update package extracted successfully');
    } catch (error) {
      this.logger.error('Failed to extract update package', error);
      throw error;
    }
  }

  /**
   * 创建备份
   */
  public async createBackup(version: string): Promise<string> {
    this.logger.info(`Creating backup for version ${version}`);
    
    const backupPath = path.join(this.backupDir, `backup-${version}-${Date.now()}`);
    const currentPath = process.cwd();
    
    try {
      await fs.mkdir(backupPath, { recursive: true });
      
      // 备份关键目录和文件
      const backupItems = [
        'apps',
        'packages',
        'plugins',
        'package.json',
        'pnpm-workspace.yaml',
        'turbo.json'
      ];
      
      for (const item of backupItems) {
        const sourcePath = path.join(currentPath, item);
        const targetPath = path.join(backupPath, item);
        
        try {
          await execAsync(`cp -r "${sourcePath}" "${targetPath}"`);
        } catch (error) {
          this.logger.warn(`Failed to backup ${item}:`, error);
        }
      }
      
      this.logger.info(`Backup created successfully: ${backupPath}`);
      return backupPath;
      
    } catch (error) {
      this.logger.error('Failed to create backup', error);
      throw error;
    }
  }

  /**
   * 停止服务
   */
  public async stopServices(serviceNames?: string[]): Promise<void> {
    const servicesToStop = serviceNames || Array.from(this.services.keys());
    
    this.logger.info(`Stopping services: ${servicesToStop.join(', ')}`);
    
    for (const serviceName of servicesToStop) {
      const service = this.services.get(serviceName);
      if (!service) {
        this.logger.warn(`Service ${serviceName} not found`);
        continue;
      }
      
      try {
        await this.stopService(service);
        this.logger.info(`Service ${serviceName} stopped successfully`);
      } catch (error) {
        this.logger.error(`Failed to stop service ${serviceName}:`, error);
        throw error;
      }
    }
  }

  /**
   * 停止单个服务
   */
  private async stopService(service: ServiceConfig): Promise<void> {
    switch (service.type) {
      case 'pm2':
        await execAsync(`pm2 stop ${service.config.name}`);
        break;
        
      case 'docker':
        await execAsync(`docker stop ${service.config.containerName}`);
        break;
        
      case 'systemd':
        await execAsync(`systemctl stop ${service.config.serviceName}`);
        break;
        
      case 'kubernetes':
        await execAsync(`kubectl scale deployment ${service.config.deploymentName} --replicas=0`);
        break;
        
      default:
        throw new Error(`Unsupported service type: ${service.type}`);
    }
  }

  /**
   * 启动服务
   */
  public async startServices(serviceNames?: string[]): Promise<void> {
    const servicesToStart = serviceNames || Array.from(this.services.keys());
    
    this.logger.info(`Starting services: ${servicesToStart.join(', ')}`);
    
    for (const serviceName of servicesToStart) {
      const service = this.services.get(serviceName);
      if (!service) {
        this.logger.warn(`Service ${serviceName} not found`);
        continue;
      }
      
      try {
        await this.startService(service);
        this.logger.info(`Service ${serviceName} started successfully`);
      } catch (error) {
        this.logger.error(`Failed to start service ${serviceName}:`, error);
        throw error;
      }
    }
  }

  /**
   * 启动单个服务
   */
  private async startService(service: ServiceConfig): Promise<void> {
    switch (service.type) {
      case 'pm2':
        await execAsync(`pm2 start ${service.config.name}`);
        break;
        
      case 'docker':
        await execAsync(`docker start ${service.config.containerName}`);
        break;
        
      case 'systemd':
        await execAsync(`systemctl start ${service.config.serviceName}`);
        break;
        
      case 'kubernetes':
        await execAsync(`kubectl scale deployment ${service.config.deploymentName} --replicas=${service.config.replicas || 1}`);
        break;
        
      default:
        throw new Error(`Unsupported service type: ${service.type}`);
    }
  }

  /**
   * 健康检查
   */
  public async performHealthCheck(serviceNames?: string[]): Promise<Map<string, boolean>> {
    const servicesToCheck = serviceNames || Array.from(this.services.keys());
    const results = new Map<string, boolean>();
    
    this.logger.info(`Performing health check for services: ${servicesToCheck.join(', ')}`);
    
    for (const serviceName of servicesToCheck) {
      const service = this.services.get(serviceName);
      if (!service) {
        results.set(serviceName, false);
        continue;
      }
      
      try {
        const isHealthy = await this.checkServiceHealth(service);
        results.set(serviceName, isHealthy);
        
        if (isHealthy) {
          this.logger.info(`Service ${serviceName} is healthy`);
        } else {
          this.logger.warn(`Service ${serviceName} is unhealthy`);
        }
      } catch (error) {
        this.logger.error(`Health check failed for service ${serviceName}:`, error);
        results.set(serviceName, false);
      }
    }
    
    return results;
  }

  /**
   * 检查单个服务健康状态
   */
  private async checkServiceHealth(service: ServiceConfig): Promise<boolean> {
    const { healthCheck } = service;
    
    for (let attempt = 1; attempt <= healthCheck.retries; attempt++) {
      try {
        if (healthCheck.url) {
          // HTTP健康检查
          const response = await fetch(healthCheck.url, {
            method: 'GET',
            timeout: healthCheck.timeout
          });
          
          if (response.ok) {
            return true;
          }
        } else if (healthCheck.command) {
          // 命令行健康检查
          await execAsync(healthCheck.command);
          return true;
        }
      } catch (error) {
        this.logger.warn(`Health check attempt ${attempt}/${healthCheck.retries} failed for ${service.name}:`, error);
        
        if (attempt < healthCheck.retries) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒后重试
        }
      }
    }
    
    return false;
  }

  /**
   * 应用更新
   */
  public async applyUpdate(extractPath: string): Promise<void> {
    this.logger.info('Applying update...');
    
    const currentPath = process.cwd();
    
    try {
      // 复制新文件
      const updateItems = [
        'apps',
        'packages',
        'plugins',
        'package.json',
        'pnpm-workspace.yaml',
        'turbo.json'
      ];
      
      for (const item of updateItems) {
        const sourcePath = path.join(extractPath, item);
        const targetPath = path.join(currentPath, item);
        
        try {
          // 备份现有文件
          await execAsync(`mv "${targetPath}" "${targetPath}.old"`);
          // 复制新文件
          await execAsync(`cp -r "${sourcePath}" "${targetPath}"`);
          // 删除备份
          await execAsync(`rm -rf "${targetPath}.old"`);
        } catch (error) {
          this.logger.warn(`Failed to update ${item}:`, error);
        }
      }
      
      // 安装依赖
      await execAsync('pnpm install');
      
      // 构建项目
      await execAsync('pnpm build');
      
      this.logger.info('Update applied successfully');
      
    } catch (error) {
      this.logger.error('Failed to apply update', error);
      throw error;
    }
  }

  /**
   * 运行数据库迁移
   */
  public async runDatabaseMigration(): Promise<void> {
    this.logger.info('Running database migration...');
    
    try {
      // 运行Prisma迁移
      await execAsync('cd apps/backend && npx prisma migrate deploy');
      
      this.logger.info('Database migration completed successfully');
    } catch (error) {
      this.logger.error('Database migration failed', error);
      throw error;
    }
  }

  /**
   * 清理临时文件
   */
  public async cleanup(keepBackups = true): Promise<void> {
    this.logger.info('Cleaning up temporary files...');
    
    try {
      // 清理工作目录中的临时文件
      const files = await fs.readdir(this.workingDir);
      
      for (const file of files) {
        if (file.startsWith('update-') && file.endsWith('.tar.gz')) {
          await fs.unlink(path.join(this.workingDir, file));
        }
        
        if (file.startsWith('extract-') && !keepBackups) {
          await execAsync(`rm -rf "${path.join(this.workingDir, file)}"`);
        }
      }
      
      this.logger.info('Cleanup completed');
    } catch (error) {
      this.logger.error('Cleanup failed', error);
      // 清理失败不应该阻止更新过程
    }
  }
}
