/**
 * Metrics Collector Service
 *
 * Provides system metrics collection for CPU, memory, and disk usage
 */

import * as os from 'os';
import * as fs from 'fs';

/**
 * CPU Metrics
 */
export interface CpuMetrics {
  /** CPU usage percentage (0-100) */
  usage: number;
  /** Number of CPU cores */
  cores: number;
  /** CPU model/type */
  model: string;
  /** CPU speed in MHz */
  speed: number;
}

/**
 * Memory Metrics
 */
export interface MemoryMetrics {
  /** Total memory in bytes */
  total: number;
  /** Used memory in bytes */
  used: number;
  /** Free memory in bytes */
  free: number;
  /** Memory usage percentage (0-100) */
  usage: number;
}

/**
 * Disk Metrics
 */
export interface DiskMetrics {
  /** Total disk space in bytes */
  total: number;
  /** Used disk space in bytes */
  used: number;
  /** Free disk space in bytes */
  free: number;
  /** Disk usage percentage (0-100) */
  usage: number;
  /** Mount point or path */
  path: string;
}

/**
 * System Metrics Collection
 */
export interface SystemMetrics {
  /** CPU metrics */
  cpu: CpuMetrics;
  /** Memory metrics */
  memory: MemoryMetrics;
  /** Disk metrics (if available) */
  disk?: DiskMetrics;
  /** Timestamp of collection */
  timestamp: string;
  /** Uptime in milliseconds */
  uptime: number;
}

/**
 * Metrics Collector Configuration
 */
export interface MetricsCollectorConfig {
  /** Disk path to monitor (default: '/') */
  diskPath?: string;
  /** CPU sampling interval in ms (default: 1000) */
  cpuSampleInterval?: number;
}

/**
 * Default Configuration
 */
const DEFAULT_CONFIG: Required<MetricsCollectorConfig> = {
  diskPath: '/',
  cpuSampleInterval: 1000,
};

/**
 * CPU usage calculation helper
 */
interface CpuUsageSnapshot {
  idle: number;
  total: number;
}

/**
 * Metrics Collector Service Class
 */
export class MetricsCollector {
  private config: Required<MetricsCollectorConfig>;
  private previousCpuSnapshot?: CpuUsageSnapshot;

  constructor(config: MetricsCollectorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Collect all system metrics
   */
  async collectAll(): Promise<SystemMetrics> {
    const [cpu, memory, disk] = await Promise.all([
      this.collectCpuMetrics(),
      this.collectMemoryMetrics(),
      this.collectDiskMetrics().catch(() => undefined),
    ]);

    return {
      cpu,
      memory,
      disk,
      timestamp: new Date().toISOString(),
      uptime: os.uptime() * 1000, // Convert to milliseconds
    };
  }

  /**
   * Collect CPU metrics
   */
  async collectCpuMetrics(): Promise<CpuMetrics> {
    const cpus = os.cpus();
    const usage = await this.calculateCpuUsage();

    return {
      usage,
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown',
      speed: cpus[0]?.speed || 0,
    };
  }

  /**
   * Collect memory metrics
   */
  async collectMemoryMetrics(): Promise<MemoryMetrics> {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usage = (usedMemory / totalMemory) * 100;

    return {
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      usage: Math.round(usage * 100) / 100, // Round to 2 decimal places
    };
  }

  /**
   * Collect disk metrics
   *
   * Note: This is a simplified implementation. For production use,
   * consider using a library like 'diskusage' for cross-platform support.
   */
  async collectDiskMetrics(): Promise<DiskMetrics> {
    // This is a basic implementation that works on Unix-like systems
    // For Windows or more reliable cross-platform support, consider using 'diskusage' package
    try {
      const stats = await this.getDiskStats(this.config.diskPath);
      return stats;
    } catch (error) {
      // If disk stats collection fails, return a minimal object
      throw new Error(
        `Failed to collect disk metrics: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Calculate CPU usage percentage
   *
   * Uses two snapshots to calculate actual CPU usage over time
   */
  private async calculateCpuUsage(): Promise<number> {
    const currentSnapshot = this.getCpuSnapshot();

    // If no previous snapshot, wait for the sample interval and take another
    if (!this.previousCpuSnapshot) {
      this.previousCpuSnapshot = currentSnapshot;
      await this.sleep(this.config.cpuSampleInterval);
      return this.calculateCpuUsage();
    }

    const idleDiff = currentSnapshot.idle - this.previousCpuSnapshot.idle;
    const totalDiff = currentSnapshot.total - this.previousCpuSnapshot.total;

    // Update previous snapshot for next calculation
    this.previousCpuSnapshot = currentSnapshot;

    // Calculate usage percentage
    const usage = 100 - (100 * idleDiff) / totalDiff;
    return Math.round(usage * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get current CPU snapshot
   */
  private getCpuSnapshot(): CpuUsageSnapshot {
    const cpus = os.cpus();

    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += cpu.times[type as keyof typeof cpu.times];
      }
      idle += cpu.times.idle;
    }

    return { idle, total };
  }

  /**
   * Get disk statistics
   *
   * This is a platform-specific implementation
   */
  private async getDiskStats(path: string): Promise<DiskMetrics> {
    // Check if we're on a Unix-like system
    if (process.platform === 'win32') {
      throw new Error('Disk metrics not supported on Windows platform');
    }

    try {
      // Use statfs for Unix-like systems (requires Node.js fs.statfs available in Node 18+)
      const stats = await fs.promises.statfs(path);

      const total = stats.blocks * stats.bsize;
      const free = stats.bfree * stats.bsize;
      const used = total - free;
      const usage = (used / total) * 100;

      return {
        total,
        used,
        free,
        usage: Math.round(usage * 100) / 100,
        path,
      };
    } catch (error) {
      // Fallback: Return process memory usage as a proxy
      const memUsage = process.memoryUsage();
      const heapTotal = memUsage.heapTotal;
      const heapUsed = memUsage.heapUsed;

      return {
        total: heapTotal,
        used: heapUsed,
        free: heapTotal - heapUsed,
        usage: (heapUsed / heapTotal) * 100,
        path: 'process-memory',
      };
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create MetricsCollector instance
 */
export function createMetricsCollector(
  config?: MetricsCollectorConfig
): MetricsCollector {
  return new MetricsCollector(config);
}

/**
 * Quick helper to collect system metrics
 */
export async function collectSystemMetrics(
  config?: MetricsCollectorConfig
): Promise<SystemMetrics> {
  const collector = createMetricsCollector(config);
  return collector.collectAll();
}
