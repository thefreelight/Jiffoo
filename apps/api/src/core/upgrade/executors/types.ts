import type {
  BackupInfo,
  CoreUpdateManifest,
  DeploymentMode,
  UpgradeStatusState,
} from '../types';

export interface ExecutorAvailability {
  available: boolean;
  reason?: string | null;
  guidance?: string | null;
  updaterBinary?: string | null;
}

export interface UpdateExecutionContext {
  targetVersion: string;
  manifest: CoreUpdateManifest | null;
  backup: BackupInfo;
  reportProgress: (status: UpgradeStatusState, step: string, progress: number) => void;
}

export interface UpdateExecutionResult {
  success: boolean;
  error?: string;
  output?: string | null;
}

export interface UpdateExecutor {
  readonly mode: DeploymentMode;
  probe(): Promise<ExecutorAvailability>;
  execute(context: UpdateExecutionContext): Promise<UpdateExecutionResult>;
  getManualGuidance(reason?: string | null): string;
}
