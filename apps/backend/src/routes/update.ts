import { Router } from 'express';
import { VersionManager, VersionCheckConfig } from '../core/update-system/version-manager';
import { UpdateCoordinator, UpdateStatus } from '../core/update-system/update-coordinator';
import { HotUpdateExecutor } from '../core/update-system/hot-update-executor';
import { Logger } from '../core/logger/logger';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
const logger = new Logger('UpdateAPI');

// 初始化更新系统组件
const versionManager = new VersionManager({
  repository: 'thefreelight/Jiffoo',
  checkInterval: 60 * 60 * 1000, // 1小时检查一次
  includePrerelease: false,
  autoCheck: true
});

const updateCoordinator = new UpdateCoordinator();
const hotUpdateExecutor = new HotUpdateExecutor();

// WebSocket连接存储
const wsConnections = new Set<any>();

// 设置事件监听器
versionManager.on('update_available', (versionInfo) => {
  logger.info('New version available:', versionInfo.latest);
  broadcastToClients('update_available', versionInfo);
});

versionManager.on('check_failed', (error) => {
  logger.error('Version check failed:', error);
  broadcastToClients('check_failed', { error: error.message });
});

updateCoordinator.on('update_started', (data) => {
  broadcastToClients('update_started', data);
});

updateCoordinator.on('update_completed', (data) => {
  broadcastToClients('update_completed', data);
});

updateCoordinator.on('update_failed', (data) => {
  broadcastToClients('update_failed', data);
});

updateCoordinator.on('step_progress', (data) => {
  broadcastToClients('step_progress', data);
});

function broadcastToClients(event: string, data: any) {
  wsConnections.forEach(ws => {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(JSON.stringify({ event, data }));
    }
  });
}

/**
 * 获取当前版本信息
 */
router.get('/version', authenticateToken, async (req, res) => {
  try {
    const currentVersion = require('../../../../package.json').version;
    const latestVersionInfo = versionManager.getLatestVersionInfo();
    const lastCheckTime = versionManager.getLastCheckTime();

    res.json({
      success: true,
      data: {
        current: currentVersion,
        latest: latestVersionInfo,
        lastCheck: lastCheckTime
      }
    });
  } catch (error) {
    logger.error('Failed to get version info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get version information'
    });
  }
});

/**
 * 手动检查更新
 */
router.post('/check', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const versionInfo = await versionManager.manualCheck();
    
    res.json({
      success: true,
      data: versionInfo
    });
  } catch (error) {
    logger.error('Manual version check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check for updates'
    });
  }
});

/**
 * 获取更新配置
 */
router.get('/config', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    // 这里应该从数据库或配置文件读取
    const config = {
      autoCheck: true,
      checkInterval: 60 * 60 * 1000,
      includePrerelease: false,
      autoUpdate: false,
      maintenanceMode: false,
      updateStrategy: 'rolling'
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Failed to get update config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get update configuration'
    });
  }
});

/**
 * 更新配置
 */
router.put('/config', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { autoCheck, checkInterval, includePrerelease } = req.body;

    // 更新版本管理器配置
    versionManager.updateConfig({
      autoCheck,
      checkInterval,
      includePrerelease
    });

    // 这里应该保存配置到数据库
    
    res.json({
      success: true,
      message: 'Configuration updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update configuration'
    });
  }
});

/**
 * 创建更新计划
 */
router.post('/plan', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { strategy, rollbackEnabled, maintenanceMode, scheduledAt } = req.body;
    
    const latestVersionInfo = versionManager.getLatestVersionInfo();
    if (!latestVersionInfo || !latestVersionInfo.hasUpdate) {
      return res.status(400).json({
        success: false,
        error: 'No update available'
      });
    }

    const plan = await updateCoordinator.createUpdatePlan(latestVersionInfo, {
      strategy,
      rollbackEnabled,
      maintenanceMode,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined
    });

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    logger.error('Failed to create update plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create update plan'
    });
  }
});

/**
 * 执行更新
 */
router.post('/execute', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { planId } = req.body;
    
    // 这里应该从数据库获取计划
    // 暂时使用当前计划
    const currentPlan = updateCoordinator.getCurrentPlan();
    if (!currentPlan) {
      return res.status(400).json({
        success: false,
        error: 'No update plan found'
      });
    }

    // 异步执行更新
    updateCoordinator.executeUpdatePlan(currentPlan).catch(error => {
      logger.error('Update execution failed:', error);
    });

    res.json({
      success: true,
      message: 'Update execution started'
    });
  } catch (error) {
    logger.error('Failed to start update execution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start update execution'
    });
  }
});

/**
 * 获取更新状态
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const status = updateCoordinator.getCurrentStatus();
    const progress = updateCoordinator.getCurrentProgress();
    const plan = updateCoordinator.getCurrentPlan();

    res.json({
      success: true,
      data: {
        status,
        progress,
        plan
      }
    });
  } catch (error) {
    logger.error('Failed to get update status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get update status'
    });
  }
});

/**
 * 取消更新
 */
router.post('/cancel', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await updateCoordinator.cancelUpdate();
    
    res.json({
      success: true,
      message: 'Update cancelled successfully'
    });
  } catch (error) {
    logger.error('Failed to cancel update:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel update'
    });
  }
});

/**
 * 获取更新历史
 */
router.get('/history', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    // 这里应该从数据库获取更新历史
    const history = [
      {
        id: 'update-1',
        version: '1.0.1',
        status: 'completed',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T10:15:00Z'),
        duration: 15 * 60 * 1000, // 15分钟
        strategy: 'rolling'
      }
    ];

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error('Failed to get update history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get update history'
    });
  }
});

/**
 * WebSocket连接处理
 */
router.ws('/ws', (ws, req) => {
  logger.info('New WebSocket connection for updates');
  
  wsConnections.add(ws);
  
  // 发送当前状态
  const status = updateCoordinator.getCurrentStatus();
  const progress = updateCoordinator.getCurrentProgress();
  
  ws.send(JSON.stringify({
    event: 'connected',
    data: { status, progress }
  }));
  
  ws.on('close', () => {
    wsConnections.delete(ws);
    logger.info('WebSocket connection closed');
  });
  
  ws.on('error', (error) => {
    logger.error('WebSocket error:', error);
    wsConnections.delete(ws);
  });
});

export default router;
