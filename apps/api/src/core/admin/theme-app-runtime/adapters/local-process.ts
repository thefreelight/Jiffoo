import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import {
  DEFAULT_THEME_APP_HEALTH_CHECK_PATH,
  DEFAULT_THEME_APP_HEALTH_CHECK_TIMEOUT,
  DEFAULT_THEME_APP_PORT_RANGE,
  resolveThemeAppHealthCheck,
} from '../contract';
import type { ThemeAppInstance, HealthCheckResult } from '../types';
import type {
  ThemeAppRuntimeAdapter,
  ThemeAppRuntimeHandle,
  ThemeAppRuntimeHealthCheckParams,
  ThemeAppRuntimeStartParams,
  ThemeAppRuntimeStopParams,
} from './types';
import { validatePathTraversal } from '../../extension-installer/security';

const DEFAULT_SHUTDOWN_TIMEOUT = 10000;

const allocatedPorts = new Set<number>();
const processHandles = new Map<string, ChildProcess>();

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(
  preferredPort?: number,
  range?: { min: number; max: number }
): Promise<number> {
  const portRange = range || DEFAULT_THEME_APP_PORT_RANGE;

  if (preferredPort && !allocatedPorts.has(preferredPort) && await isPortAvailable(preferredPort)) {
    return preferredPort;
  }

  for (let port = portRange.min; port <= portRange.max; port++) {
    if (!allocatedPorts.has(port) && await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available ports in range ${portRange.min}-${portRange.max}`);
}

async function performHealthCheck(
  baseUrl: string,
  healthCheckPath: string = DEFAULT_THEME_APP_HEALTH_CHECK_PATH,
  timeout: number = DEFAULT_THEME_APP_HEALTH_CHECK_TIMEOUT
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${baseUrl}${healthCheckPath}`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return {
      success: response.ok,
      statusCode: response.status,
      latencyMs: Date.now() - startTime,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      error: error.name === 'AbortError' ? 'Health check timeout' : error.message,
    };
  }
}

async function waitForHealthy(instance: ThemeAppInstance): Promise<HealthCheckResult> {
  const { path: healthCheckPath, timeout, retries, retryInterval } = resolveThemeAppHealthCheck(instance.manifest);

  let lastResult: HealthCheckResult = { success: false, latencyMs: 0 };

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryInterval));
    }

    lastResult = await performHealthCheck(instance.baseUrl!, healthCheckPath, timeout);
    if (lastResult.success) {
      return lastResult;
    }
  }

  return lastResult;
}

export const localProcessThemeAppRuntimeAdapter: ThemeAppRuntimeAdapter = {
  mode: 'local-process',

  async start({
    instanceKey,
    slug,
    target,
    themeDir,
    manifest,
    options,
    onProcessError,
    onProcessExit,
  }: ThemeAppRuntimeStartParams) {
    const port = await findAvailablePort(manifest.port?.preferred, manifest.port?.range);
    allocatedPorts.add(port);

    const instance: ThemeAppInstance = {
      slug,
      target,
      status: 'starting',
      port,
      baseUrl: `http://127.0.0.1:${port}`,
      startedAt: new Date().toISOString(),
      manifest,
    };

    const env: Record<string, string> = {
      ...process.env,
      PORT: String(port),
      NODE_ENV: process.env.NODE_ENV || 'production',
      ...manifest.env,
      ...options.env,
    };

    const serverEntry = path.join(themeDir, manifest.runtime.entry);
    validatePathTraversal(serverEntry, themeDir);

    const childProcess = spawn('node', [serverEntry], {
      cwd: themeDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    instance.pid = childProcess.pid;
    processHandles.set(instanceKey, childProcess);

    childProcess.on('error', (error) => {
      allocatedPorts.delete(port);
      processHandles.delete(instanceKey);
      onProcessError(error instanceof Error ? error : new Error(String(error)), instance);
    });

    childProcess.on('exit', (code, signal) => {
      allocatedPorts.delete(port);
      processHandles.delete(instanceKey);
      onProcessExit(code, signal, instance);
    });

    childProcess.stdout?.on('data', (data) => {
      console.log(`[ThemeApp:${slug}] ${data.toString().trim()}`);
    });

    childProcess.stderr?.on('data', (data) => {
      console.error(`[ThemeApp:${slug}] ${data.toString().trim()}`);
    });

    if (!options.skipHealthCheck) {
      const healthResult = await waitForHealthy(instance);
      instance.lastHealthCheck = {
        success: healthResult.success,
        timestamp: new Date().toISOString(),
        latencyMs: healthResult.latencyMs,
        error: healthResult.error,
      };

      if (healthResult.success) {
        instance.status = 'healthy';
      } else {
        instance.status = 'unhealthy';
        instance.error = healthResult.error || 'Health check failed';
      }
    }

    const handle: ThemeAppRuntimeHandle = {
      kind: 'local-process',
      pid: childProcess.pid,
    };

    return { instance, handle };
  },

  async stop({ instanceKey, instance, options }: ThemeAppRuntimeStopParams): Promise<void> {
    const childProcess = processHandles.get(instanceKey);
    if (!childProcess) {
      return;
    }

    instance.status = 'stopping';
    const timeout = options.timeout || DEFAULT_SHUTDOWN_TIMEOUT;

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        console.warn(`[ThemeAppAdapter] Force killing ${instanceKey} after timeout`);
        childProcess.kill('SIGKILL');
        resolve();
      }, timeout);

      childProcess.once('exit', () => {
        clearTimeout(timeoutId);
        resolve();
      });

      childProcess.kill(options.force ? 'SIGKILL' : 'SIGTERM');
    });
  },

  async checkHealth({ instance }: ThemeAppRuntimeHealthCheckParams): Promise<HealthCheckResult | null> {
    if (!instance.baseUrl) {
      return null;
    }

    const healthCheck = resolveThemeAppHealthCheck(instance.manifest);
    return performHealthCheck(instance.baseUrl, healthCheck.path, healthCheck.timeout);
  },
};
