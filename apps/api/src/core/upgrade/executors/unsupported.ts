import type { ExecutorAvailability, UpdateExecutionContext, UpdateExecutionResult } from './types';
import { BaseUpdateExecutor } from './base';

export class UnsupportedUpdateExecutor extends BaseUpdateExecutor {
  readonly mode = 'unsupported' as const;

  async probe(): Promise<ExecutorAvailability> {
    return this.buildUnavailable(this.getManualGuidance());
  }

  getManualGuidance(): string {
    return 'This installation mode is not one of the officially supported self-hosted upgrade paths. Use the operator guide for a manual core upgrade.';
  }

  async execute(_context: UpdateExecutionContext): Promise<UpdateExecutionResult> {
    return {
      success: false,
      error: this.getManualGuidance(),
    };
  }
}
