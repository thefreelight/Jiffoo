/**
 * 日志聚合和查询服务
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export interface LogQuery {
  appName?: string;
  level?: string;
  startTime?: string;
  endTime?: string;
  message?: string;
  userId?: string;
  page?: number;
  limit?: number;
  sortBy?: 'timestamp' | 'level';
  sortOrder?: 'asc' | 'desc';
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  appName: string;
  environment: string;
  meta: any;
}

export interface LogQueryResult {
  logs: LogEntry[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface LogStats {
  totalLogs: number;
  errorLogs: number;
  warningLogs: number;
  infoLogs: number;
  debugLogs: number;
  timeRange: string;
  appBreakdown: Record<string, number>;
  hourlyBreakdown: Record<string, number>;
}

/**
 * 日志聚合器类
 * 支持文件日志读取和内存缓存查询
 */
export class LogAggregator {
  private logsDir: string;
  private memoryLogs: LogEntry[] = [];
  private maxMemoryLogs: number = 10000; // 最大内存缓存条目数

  constructor(logsDir: string = path.join(process.cwd(), 'logs')) {
    this.logsDir = logsDir;
    this.ensureLogsDir();
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogsDir(): void {
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }
  }

  /**
   * 添加日志到内存缓存（供实时查询）
   */
  addLog(log: LogEntry): void {
    this.memoryLogs.push(log);

    // 保持内存日志在限制范围内
    if (this.memoryLogs.length > this.maxMemoryLogs) {
      this.memoryLogs = this.memoryLogs.slice(-this.maxMemoryLogs);
    }
  }

  /**
   * 获取内存缓存中的日志数量
   */
  getMemoryLogCount(): number {
    return this.memoryLogs.length;
  }

  /**
   * 清除内存缓存
   */
  clearMemoryLogs(): void {
    this.memoryLogs = [];
  }

  /**
   * 查询日志（同时从内存缓存和文件查询）
   */
  async queryLogs(query: LogQuery): Promise<LogQueryResult> {
    const {
      appName,
      level,
      startTime,
      endTime,
      message,
      userId,
      page = 1,
      limit = 50,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = query;

    const logs: LogEntry[] = [];

    // 先从内存缓存查询（最近的日志）
    for (const log of this.memoryLogs) {
      if (this.matchesFilter(log, { appName, level, startTime, endTime, message, userId })) {
        logs.push(log);
      }
    }

    // 再从文件查询（历史日志）
    const logFiles = await this.getLogFiles(startTime, endTime);
    for (const file of logFiles) {
      const fileLogs = await this.readLogFile(file);
      for (const log of fileLogs) {
        if (this.matchesFilter(log, { appName, level, startTime, endTime, message, userId })) {
          // 避免重复（内存中可能已有）
          if (!logs.some(l => l.id === log.id)) {
            logs.push(log);
          }
        }
      }
    }

    // 排序
    logs.sort((a, b) => {
      const aValue = sortBy === 'timestamp' ? a.timestamp : a.level;
      const bValue = sortBy === 'timestamp' ? b.timestamp : b.level;

      if (sortOrder === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });

    // 分页
    const total = logs.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLogs = logs.slice(startIndex, endIndex);

    return {
      logs: paginatedLogs,
      total,
      page,
      limit,
      hasMore: endIndex < total
    };
  }

  /**
   * 检查日志是否匹配过滤条件
   */
  private matchesFilter(
    log: LogEntry,
    filter: { appName?: string; level?: string; startTime?: string; endTime?: string; message?: string; userId?: string }
  ): boolean {
    const { appName, level, startTime, endTime, message, userId } = filter;

    if (appName && log.appName !== appName) return false;
    if (level && log.level !== level) return false;
    if (message && !log.message.toLowerCase().includes(message.toLowerCase())) return false;
    if (userId && log.meta?.userId !== userId) return false;
    if (startTime && log.timestamp < startTime) return false;
    if (endTime && log.timestamp > endTime) return false;

    return true;
  }

  /**
   * 获取日志统计（同时统计内存缓存和文件日志）
   */
  async getLogStats(timeRange: string = '24h'): Promise<LogStats> {
    const { startTime, endTime } = this.parseTimeRange(timeRange);

    const stats: LogStats = {
      totalLogs: 0,
      errorLogs: 0,
      warningLogs: 0,
      infoLogs: 0,
      debugLogs: 0,
      timeRange,
      appBreakdown: {},
      hourlyBreakdown: {}
    };

    const processedIds = new Set<string>();

    // 统计内存缓存中的日志
    for (const log of this.memoryLogs) {
      if (log.timestamp >= startTime && log.timestamp <= endTime) {
        this.updateStats(stats, log);
        processedIds.add(log.id);
      }
    }

    // 统计文件日志
    const logFiles = await this.getLogFiles(startTime, endTime);
    for (const file of logFiles) {
      const logs = await this.readLogFile(file);
      for (const log of logs) {
        if (log.timestamp >= startTime && log.timestamp <= endTime && !processedIds.has(log.id)) {
          this.updateStats(stats, log);
        }
      }
    }

    return stats;
  }

  /**
   * 更新统计数据
   */
  private updateStats(stats: LogStats, log: LogEntry): void {
    stats.totalLogs++;

    // 按级别统计
    switch (log.level) {
      case 'error':
        stats.errorLogs++;
        break;
      case 'warn':
        stats.warningLogs++;
        break;
      case 'info':
        stats.infoLogs++;
        break;
      case 'debug':
        stats.debugLogs++;
        break;
    }

    // 按应用统计
    const appName = log.appName || 'unknown';
    stats.appBreakdown[appName] = (stats.appBreakdown[appName] || 0) + 1;

    // 按小时统计
    try {
      const hour = new Date(log.timestamp).getHours().toString().padStart(2, '0');
      stats.hourlyBreakdown[hour] = (stats.hourlyBreakdown[hour] || 0) + 1;
    } catch {
      // 忽略无效时间戳
    }
  }

  /**
   * 导出日志
   */
  async exportLogs(query: LogQuery, format: 'json' | 'csv' = 'json'): Promise<string> {
    const result = await this.queryLogs({ ...query, limit: 10000 }); // 导出时不限制数量
    
    if (format === 'csv') {
      return this.convertToCSV(result.logs);
    } else {
      return JSON.stringify(result.logs, null, 2);
    }
  }

  /**
   * 获取日志文件列表
   */
  private async getLogFiles(startTime?: string, endTime?: string): Promise<string[]> {
    try {
      const files = await readdir(this.logsDir);
      const logFiles: string[] = [];

      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = path.join(this.logsDir, file);
          const stats = await stat(filePath);
          
          // 如果指定了时间范围，只包含相关的文件
          if (startTime || endTime) {
            const fileDate = stats.mtime.toISOString();
            if (startTime && fileDate < startTime) continue;
            if (endTime && fileDate > endTime) continue;
          }
          
          logFiles.push(filePath);
        }
      }

      return logFiles.sort();
    } catch (error) {
      console.error('Error reading log directory:', error);
      return [];
    }
  }

  /**
   * 读取日志文件
   */
  private async readLogFile(filePath: string): Promise<LogEntry[]> {
    const logs: LogEntry[] = [];
    
    try {
      const fileStream = createReadStream(filePath);
      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        if (line.trim()) {
          try {
            const logEntry = JSON.parse(line);
            logs.push(logEntry);
          } catch (parseError) {
            // 跳过无法解析的行
            continue;
          }
        }
      }
    } catch (error) {
      console.error(`Error reading log file ${filePath}:`, error);
    }

    return logs;
  }

  /**
   * 解析时间范围
   */
  private parseTimeRange(timeRange: string): { startTime: string; endTime: string } {
    const now = new Date();
    const endTime = now.toISOString();
    let startTime: string;

    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    }

    return { startTime, endTime };
  }

  /**
   * 转换为 CSV 格式
   */
  private convertToCSV(logs: LogEntry[]): string {
    if (logs.length === 0) return '';

    const headers = ['timestamp', 'level', 'appName', 'message', 'userId', 'component', 'url'];
    const csvLines = [headers.join(',')];

    for (const log of logs) {
      const row = [
        log.timestamp,
        log.level,
        log.appName,
        `"${log.message.replace(/"/g, '""')}"`, // 转义双引号
        log.meta?.userId || '',
        log.meta?.component || '',
        log.meta?.url || ''
      ];
      csvLines.push(row.join(','));
    }

    return csvLines.join('\n');
  }

  /**
   * 清理旧日志文件
   */
  async cleanupOldLogs(retentionDays: number = 30): Promise<void> {
    try {
      const files = await readdir(this.logsDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = path.join(this.logsDir, file);
          const stats = await stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath);
            console.log(`Deleted old log file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up old logs:', error);
    }
  }
}

// 导出单例实例
export const logAggregator = new LogAggregator();