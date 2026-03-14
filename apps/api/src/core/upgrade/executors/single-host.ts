import type { UpdateExecutionContext, UpdateExecutionResult, ExecutorAvailability } from './types';
import { BaseUpdateExecutor } from './base';

export class SingleHostUpdateExecutor extends BaseUpdateExecutor {
  readonly mode = 'single-host' as const;

  async probe(): Promise<ExecutorAvailability> {
    const binary = this.resolveUpdaterBinary();
    if (!binary) {
      return this.buildUnavailable(this.getManualGuidance('Local updater binary is not installed.'));
    }

    return this.buildAvailable(binary);
  }

  getManualGuidance(reason?: string | null): string {
    const prefix = reason ? `${reason} ` : '';
    return `${prefix}Install the local Jiffoo updater on this host, then retry. Until then, use the operator guide to apply the new release package and restart the core services manually.`;
  }

  async execute(context: UpdateExecutionContext): Promise<UpdateExecutionResult> {
    const availability = await this.probe();
    if (!availability.available || !availability.updaterBinary) {
      return {
        success: false,
        error: availability.guidance || this.getManualGuidance(availability.reason),
      };
    }

    context.reportProgress('downloading', 'Preparing single-host release bundle', 25);
    return this.runUpdater(
      availability.updaterBinary,
      ['upgrade', '--mode', this.mode, '--target-version', context.targetVersion],
      context
    );
  }
}
