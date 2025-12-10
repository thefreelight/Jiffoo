import { FastifyRequest, FastifyReply } from 'fastify';
import { InstallService } from './service';

// 缓存安装状态，避免每次请求都查询数据库
let cachedInstallStatus: { isInstalled: boolean; checkedAt: number } | null = null;
const CACHE_TTL = 60000; // 60 seconds

/**
 * 安装状态检查中间件
 * - 未安装时，只允许访问 /api/install 相关端点
 * - 已安装时，阻止访问 /api/install/complete
 */
export async function installationCheckMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const path = request.url;
  
  // 跳过健康检查和安装状态检查
  if (path === '/health' || path === '/api/install/status' || path === '/api/install/check-database') {
    return;
  }

  // 检查缓存
  const now = Date.now();
  if (!cachedInstallStatus || now - cachedInstallStatus.checkedAt > CACHE_TTL) {
    const status = await InstallService.checkInstallationStatus();
    cachedInstallStatus = {
      isInstalled: status.isInstalled,
      checkedAt: now
    };
  }

  const isInstalled = cachedInstallStatus.isInstalled;
  const isInstallPath = path.startsWith('/api/install');

  // 未安装时的处理
  if (!isInstalled) {
    // 允许安装相关的请求
    if (isInstallPath) {
      return;
    }
    // 其他 API 请求返回 503
    return reply.status(503).send({
      success: false,
      error: 'System not installed',
      message: 'Please complete the installation first',
      redirect: '/install'
    });
  }

  // 已安装时，阻止访问 /api/install/complete
  if (isInstalled && path === '/api/install/complete') {
    return reply.status(400).send({
      success: false,
      error: 'Already installed',
      message: 'System is already installed'
    });
  }
}

/**
 * 重置安装状态缓存
 * 在完成安装后调用
 */
export function resetInstallationCache() {
  cachedInstallStatus = null;
}

