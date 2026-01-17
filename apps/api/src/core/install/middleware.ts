import { FastifyRequest, FastifyReply } from 'fastify';
import { InstallService } from './service';

// Cache installation status to avoid checking database on every request
let cachedInstallStatus: { isInstalled: boolean; checkedAt: number } | null = null;
const CACHE_TTL = 60000; // 60 seconds

/**
 * Installation status check middleware
 * - When not installed, only allow access to /api/install endpoints
 * - When installed, prevent access to /api/install/complete
 */
export async function installationCheckMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const path = request.url;

  // Skip health check and installation status check
  if (path === '/health' || path === '/api/install/status' || path === '/api/install/check-database') {
    return;
  }

  // Check cache
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

  // Handle when not installed
  if (!isInstalled) {
    // Allow installation related requests
    if (isInstallPath) {
      return;
    }
    // Other API requests return 503
    return reply.status(503).send({
      success: false,
      error: 'System not installed',
      message: 'Please complete the installation first',
      redirect: '/install'
    });
  }

  // When installed, prevent access to /api/install/complete
  if (isInstalled && path === '/api/install/complete') {
    return reply.status(400).send({
      success: false,
      error: 'Already installed',
      message: 'System is already installed'
    });
  }
}

/**
 * Reset installation status cache
 * Called after installation is complete
 */
export function resetInstallationCache() {
  cachedInstallStatus = null;
}

