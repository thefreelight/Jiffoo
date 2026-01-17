/**
 * Baseline Store - 基线存储服务
 * 
 * 存储和加载性能基线数据
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { BenchmarkSuiteResult } from './benchmark-runner';

export interface BaselineMetadata {
  gitCommit: string;
  gitBranch?: string;
  timestamp: number;
  environment?: string;
  tags?: string[];
}

export interface StoredBaseline {
  metadata: BaselineMetadata;
  result: BenchmarkSuiteResult;
}

export interface BaselineStoreConfig {
  baseDir: string;
  maxBaselines?: number;
}

/**
 * Baseline Store 类
 */
export class BaselineStore {
  private baseDir: string;
  private maxBaselines: number;

  constructor(config: BaselineStoreConfig) {
    this.baseDir = config.baseDir;
    this.maxBaselines = config.maxBaselines ?? 100;
    
    // 确保目录存在
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * 保存基线
   */
  save(
    suiteName: string,
    result: BenchmarkSuiteResult,
    metadata: BaselineMetadata
  ): string {
    const filename = this.generateFilename(suiteName, metadata.gitCommit);
    const filepath = join(this.baseDir, filename);

    const stored: StoredBaseline = {
      metadata,
      result,
    };

    // 确保目录存在
    const dir = dirname(filepath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(filepath, JSON.stringify(stored, null, 2));
    
    // 清理旧基线
    this.cleanup(suiteName);

    return filepath;
  }

  /**
   * 加载最新基线
   */
  loadLatest(suiteName: string): StoredBaseline | null {
    const baselines = this.list(suiteName);
    if (baselines.length === 0) return null;

    // 按时间戳排序，返回最新的
    baselines.sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);
    return baselines[0];
  }

  /**
   * 加载指定 commit 的基线
   */
  loadByCommit(suiteName: string, gitCommit: string): StoredBaseline | null {
    const filename = this.generateFilename(suiteName, gitCommit);
    const filepath = join(this.baseDir, filename);

    if (!existsSync(filepath)) return null;

    const content = readFileSync(filepath, 'utf-8');
    return JSON.parse(content) as StoredBaseline;
  }

  /**
   * 列出所有基线
   */
  list(suiteName: string): StoredBaseline[] {
    const pattern = `${suiteName}-`;
    const baselines: StoredBaseline[] = [];

    if (!existsSync(this.baseDir)) return baselines;

    const files = require('fs').readdirSync(this.baseDir) as string[];
    
    for (const file of files) {
      if (file.startsWith(pattern) && file.endsWith('.json')) {
        const filepath = join(this.baseDir, file);
        const content = readFileSync(filepath, 'utf-8');
        baselines.push(JSON.parse(content) as StoredBaseline);
      }
    }

    return baselines;
  }

  /**
   * 删除基线
   */
  delete(suiteName: string, gitCommit: string): boolean {
    const filename = this.generateFilename(suiteName, gitCommit);
    const filepath = join(this.baseDir, filename);

    if (!existsSync(filepath)) return false;

    require('fs').unlinkSync(filepath);
    return true;
  }

  /**
   * 清理旧基线
   */
  private cleanup(suiteName: string): void {
    const baselines = this.list(suiteName);
    
    if (baselines.length <= this.maxBaselines) return;

    // 按时间戳排序
    baselines.sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);

    // 删除超出限制的旧基线
    const toDelete = baselines.slice(this.maxBaselines);
    for (const baseline of toDelete) {
      this.delete(suiteName, baseline.metadata.gitCommit);
    }
  }

  /**
   * 生成文件名
   */
  private generateFilename(suiteName: string, gitCommit: string): string {
    const shortCommit = gitCommit.substring(0, 8);
    return `${suiteName}-${shortCommit}.json`;
  }
}

/**
 * 创建 Baseline Store 实例
 */
export function createBaselineStore(config: BaselineStoreConfig): BaselineStore {
  return new BaselineStore(config);
}

/**
 * 获取当前 git commit hash
 */
export function getGitCommit(): string {
  try {
    const { execSync } = require('child_process');
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * 获取当前 git branch
 */
export function getGitBranch(): string {
  try {
    const { execSync } = require('child_process');
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

