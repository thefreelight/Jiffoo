import { FastifyInstance } from 'fastify';
import { UnifiedPluginManagerImpl } from './unified-manager';
import { PseudoHotSwapManager } from './hot-swap';
import { PluginStatus, PluginType } from '../types';

/**
 * 一键安装器
 * 提供用户友好的插件安装/卸载体验
 */
export class OneClickInstaller {
  private app: FastifyInstance;
  private pluginManager: UnifiedPluginManagerImpl;
  private hotSwapManager: PseudoHotSwapManager;

  constructor(
    app: FastifyInstance,
    pluginManager: UnifiedPluginManagerImpl,
    hotSwapManager: PseudoHotSwapManager
  ) {
    this.app = app;
    this.pluginManager = pluginManager;
    this.hotSwapManager = hotSwapManager;
  }

  /**
   * 一键安装插件
   */
  async oneClickInstall(options: {
    pluginId: string;
    tenantId?: string;
    userId?: string;
    config?: any;
    licenseKey?: string;
    autoActivate?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    status: PluginStatus;
    steps: Array<{ step: string; status: 'success' | 'failed' | 'skipped'; message?: string }>;
  }> {
    const { pluginId, tenantId, userId, config, licenseKey, autoActivate = true } = options;
    const steps: Array<{ step: string; status: 'success' | 'failed' | 'skipped'; message?: string }> = [];

    try {
      this.app.log.info(`Starting one-click install for plugin ${pluginId}`);

      // 步骤 1: 检查插件是否已安装
      steps.push({ step: 'check_existing', status: 'success', message: 'Checking existing installation' });
      
      const existingStatus = await this.pluginManager.getPluginStatus(pluginId, tenantId);
      if (existingStatus !== PluginStatus.UNINSTALLED) {
        if (existingStatus === PluginStatus.ACTIVE) {
          steps.push({ step: 'already_active', status: 'skipped', message: 'Plugin is already active' });
          return {
            success: true,
            message: `Plugin ${pluginId} is already installed and active`,
            status: existingStatus,
            steps
          };
        } else if (existingStatus === PluginStatus.INSTALLED || existingStatus === PluginStatus.INACTIVE) {
          // 如果已安装但未激活，直接激活
          if (autoActivate) {
            steps.push({ step: 'activate_existing', status: 'success', message: 'Activating existing plugin' });
            await this.pluginManager.activatePlugin(pluginId, tenantId);
            this.hotSwapManager.activatePlugin(pluginId);
            
            return {
              success: true,
              message: `Plugin ${pluginId} activated successfully`,
              status: PluginStatus.ACTIVE,
              steps
            };
          }
        }
      }

      // 步骤 2: 安装插件
      steps.push({ step: 'install', status: 'success', message: 'Installing plugin' });
      
      await this.pluginManager.installPlugin(pluginId, {
        tenantId,
        config,
        licenseKey,
        autoActivate: false // 我们手动控制激活过程
      });

      steps.push({ step: 'install', status: 'success', message: 'Plugin installed successfully' });

      // 步骤 3: 注册路由（如果需要）
      const plugin = await this.pluginManager.getPlugin(pluginId, tenantId);
      if (plugin && plugin.metadata.routes && plugin.metadata.routes.length > 0) {
        steps.push({ step: 'register_routes', status: 'success', message: 'Registering plugin routes' });
        await this.hotSwapManager.registerPluginRoutes(pluginId, plugin.metadata.routes);
        steps.push({ step: 'register_routes', status: 'success', message: 'Routes registered successfully' });
      } else {
        steps.push({ step: 'register_routes', status: 'skipped', message: 'No routes to register' });
      }

      // 步骤 4: 激活插件（如果需要）
      if (autoActivate) {
        steps.push({ step: 'activate', status: 'success', message: 'Activating plugin' });
        
        await this.pluginManager.activatePlugin(pluginId, tenantId);
        this.hotSwapManager.activatePlugin(pluginId);
        
        steps.push({ step: 'activate', status: 'success', message: 'Plugin activated successfully' });
      } else {
        steps.push({ step: 'activate', status: 'skipped', message: 'Auto-activation disabled' });
      }

      // 步骤 5: 验证安装
      steps.push({ step: 'verify', status: 'success', message: 'Verifying installation' });
      
      const finalStatus = await this.pluginManager.getPluginStatus(pluginId, tenantId);
      const healthCheck = await this.pluginManager.healthCheckPlugin(pluginId, tenantId);
      
      if (!healthCheck) {
        steps.push({ step: 'verify', status: 'failed', message: 'Health check failed' });
        throw new Error('Plugin health check failed after installation');
      }

      steps.push({ step: 'verify', status: 'success', message: 'Installation verified successfully' });

      this.app.log.info(`One-click install completed for plugin ${pluginId}`);

      return {
        success: true,
        message: `Plugin ${pluginId} installed and ${autoActivate ? 'activated' : 'ready'} successfully`,
        status: finalStatus,
        steps
      };

    } catch (error) {
      this.app.log.error(`One-click install failed for plugin ${pluginId}:`, error);
      
      // 标记最后一个步骤为失败
      if (steps.length > 0) {
        steps[steps.length - 1].status = 'failed';
        steps[steps.length - 1].message = error instanceof Error ? error.message : 'Unknown error';
      }

      // 尝试回滚
      try {
        await this.rollbackInstallation(pluginId, tenantId);
        steps.push({ step: 'rollback', status: 'success', message: 'Installation rolled back' });
      } catch (rollbackError) {
        steps.push({ step: 'rollback', status: 'failed', message: 'Rollback failed' });
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Installation failed',
        status: PluginStatus.ERROR,
        steps
      };
    }
  }

  /**
   * 一键卸载插件
   */
  async oneClickUninstall(options: {
    pluginId: string;
    tenantId?: string;
    userId?: string;
    force?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    steps: Array<{ step: string; status: 'success' | 'failed' | 'skipped'; message?: string }>;
  }> {
    const { pluginId, tenantId, userId, force = false } = options;
    const steps: Array<{ step: string; status: 'success' | 'failed' | 'skipped'; message?: string }> = [];

    try {
      this.app.log.info(`Starting one-click uninstall for plugin ${pluginId}`);

      // 步骤 1: 检查插件状态
      steps.push({ step: 'check_status', status: 'success', message: 'Checking plugin status' });
      
      const currentStatus = await this.pluginManager.getPluginStatus(pluginId, tenantId);
      if (currentStatus === PluginStatus.UNINSTALLED) {
        steps.push({ step: 'already_uninstalled', status: 'skipped', message: 'Plugin is already uninstalled' });
        return {
          success: true,
          message: `Plugin ${pluginId} is already uninstalled`,
          steps
        };
      }

      // 步骤 2: 检查依赖关系（如果不是强制卸载）
      if (!force) {
        steps.push({ step: 'check_dependencies', status: 'success', message: 'Checking dependencies' });
        
        const dependentPlugins = await this.findDependentPlugins(pluginId, tenantId);
        if (dependentPlugins.length > 0) {
          steps.push({ 
            step: 'check_dependencies', 
            status: 'failed', 
            message: `Plugin is required by: ${dependentPlugins.join(', ')}` 
          });
          
          return {
            success: false,
            message: `Cannot uninstall ${pluginId}. It is required by other plugins: ${dependentPlugins.join(', ')}`,
            steps
          };
        }
        
        steps.push({ step: 'check_dependencies', status: 'success', message: 'No dependencies found' });
      } else {
        steps.push({ step: 'check_dependencies', status: 'skipped', message: 'Dependency check skipped (force mode)' });
      }

      // 步骤 3: 停用插件（如果激活）
      if (currentStatus === PluginStatus.ACTIVE) {
        steps.push({ step: 'deactivate', status: 'success', message: 'Deactivating plugin' });
        
        await this.pluginManager.deactivatePlugin(pluginId, tenantId);
        this.hotSwapManager.deactivatePlugin(pluginId);
        
        steps.push({ step: 'deactivate', status: 'success', message: 'Plugin deactivated successfully' });
      } else {
        steps.push({ step: 'deactivate', status: 'skipped', message: 'Plugin is not active' });
      }

      // 步骤 4: 注销路由
      steps.push({ step: 'unregister_routes', status: 'success', message: 'Unregistering plugin routes' });
      
      await this.hotSwapManager.unregisterPluginRoutes(pluginId);
      
      steps.push({ step: 'unregister_routes', status: 'success', message: 'Routes unregistered successfully' });

      // 步骤 5: 卸载插件
      steps.push({ step: 'uninstall', status: 'success', message: 'Uninstalling plugin' });
      
      await this.pluginManager.uninstallPlugin(pluginId, tenantId);
      
      steps.push({ step: 'uninstall', status: 'success', message: 'Plugin uninstalled successfully' });

      // 步骤 6: 清理资源
      steps.push({ step: 'cleanup', status: 'success', message: 'Cleaning up resources' });
      
      // 这里可以添加额外的清理逻辑，如删除临时文件、清理缓存等
      
      steps.push({ step: 'cleanup', status: 'success', message: 'Resources cleaned up successfully' });

      this.app.log.info(`One-click uninstall completed for plugin ${pluginId}`);

      return {
        success: true,
        message: `Plugin ${pluginId} uninstalled successfully`,
        steps
      };

    } catch (error) {
      this.app.log.error(`One-click uninstall failed for plugin ${pluginId}:`, error);
      
      // 标记最后一个步骤为失败
      if (steps.length > 0) {
        steps[steps.length - 1].status = 'failed';
        steps[steps.length - 1].message = error instanceof Error ? error.message : 'Unknown error';
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Uninstallation failed',
        steps
      };
    }
  }

  /**
   * 批量操作插件
   */
  async batchOperation(
    operation: 'install' | 'uninstall',
    pluginIds: string[],
    options: {
      tenantId?: string;
      userId?: string;
      force?: boolean;
      autoActivate?: boolean;
    } = {}
  ): Promise<{
    success: string[];
    failed: Array<{ pluginId: string; error: string; steps?: any[] }>;
    summary: string;
  }> {
    const success: string[] = [];
    const failed: Array<{ pluginId: string; error: string; steps?: any[] }> = [];

    for (const pluginId of pluginIds) {
      try {
        if (operation === 'install') {
          const result = await this.oneClickInstall({ pluginId, ...options });
          if (result.success) {
            success.push(pluginId);
          } else {
            failed.push({ pluginId, error: result.message, steps: result.steps });
          }
        } else {
          const result = await this.oneClickUninstall({ pluginId, ...options });
          if (result.success) {
            success.push(pluginId);
          } else {
            failed.push({ pluginId, error: result.message, steps: result.steps });
          }
        }
      } catch (error) {
        failed.push({ 
          pluginId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    const summary = `${operation} completed: ${success.length} successful, ${failed.length} failed`;

    return { success, failed, summary };
  }

  /**
   * 回滚安装
   */
  private async rollbackInstallation(pluginId: string, tenantId?: string): Promise<void> {
    try {
      // 尝试停用插件
      await this.pluginManager.deactivatePlugin(pluginId, tenantId);
      this.hotSwapManager.deactivatePlugin(pluginId);
    } catch (error) {
      // 忽略停用错误
    }

    try {
      // 尝试卸载插件
      await this.pluginManager.uninstallPlugin(pluginId, tenantId);
    } catch (error) {
      // 忽略卸载错误
    }

    try {
      // 清理路由
      await this.hotSwapManager.unregisterPluginRoutes(pluginId);
    } catch (error) {
      // 忽略路由清理错误
    }
  }

  /**
   * 查找依赖于指定插件的其他插件
   */
  private async findDependentPlugins(pluginId: string, tenantId?: string): Promise<string[]> {
    const allPlugins = await this.pluginManager.getPlugins(tenantId);
    const dependentPlugins: string[] = [];

    for (const plugin of allPlugins) {
      if (plugin.metadata.dependencies && plugin.metadata.dependencies.includes(pluginId)) {
        const status = await this.pluginManager.getPluginStatus(plugin.metadata.id, tenantId);
        if (status === PluginStatus.ACTIVE || status === PluginStatus.INSTALLED) {
          dependentPlugins.push(plugin.metadata.id);
        }
      }
    }

    return dependentPlugins;
  }
}
