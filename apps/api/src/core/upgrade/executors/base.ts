import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DeploymentMode } from '../types';
import type {
  ExecutorAvailability,
  UpdateExecutionContext,
  UpdateExecutionResult,
  UpdateExecutor,
} from './types';

const execFileAsync = promisify(execFile);

export abstract class BaseUpdateExecutor implements UpdateExecutor {
  abstract readonly mode: DeploymentMode;

  protected resolveUpdaterBinary(): string | null {
    const candidates = [
      process.env.JIFFOO_UPDATER_BIN,
      '/usr/local/bin/jiffoo-updater',
      '/opt/jiffoo/bin/jiffoo-updater',
    ].filter((value): value is string => Boolean(value));

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  protected findFirstExistingPath(candidates: Array<string | undefined | null>): string | null {
    for (const candidate of candidates) {
      if (!candidate) continue;
      const resolved = path.resolve(candidate);
      if (fs.existsSync(resolved)) {
        return resolved;
      }
    }
    return null;
  }

  protected buildUnavailable(guidance: string, reason?: string | null): ExecutorAvailability {
    return {
      available: false,
      reason: reason || null,
      guidance,
      updaterBinary: this.resolveUpdaterBinary(),
    };
  }

  protected buildAvailable(binary: string): ExecutorAvailability {
    return {
      available: true,
      updaterBinary: binary,
      reason: null,
      guidance: null,
    };
  }

  protected async runUpdater(
    binary: string,
    args: string[],
    context: UpdateExecutionContext
  ): Promise<UpdateExecutionResult> {
    context.reportProgress('applying', `Executing ${this.mode} updater`, 45);
    try {
      const { stdout, stderr } = await execFileAsync(binary, args, {
        env: process.env,
        maxBuffer: 1024 * 1024,
      });
      context.reportProgress('migrating', 'Verifying updater completion', 75);
      const output = [stdout, stderr].filter(Boolean).join('\n').trim();
      context.reportProgress('verifying', 'Running post-upgrade health checks', 90);
      return {
        success: true,
        output,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Updater execution failed';
      return {
        success: false,
        error: message,
      };
    }
  }

  abstract probe(): Promise<ExecutorAvailability>;
  abstract execute(context: UpdateExecutionContext): Promise<UpdateExecutionResult>;
  abstract getManualGuidance(reason?: string | null): string;
}
