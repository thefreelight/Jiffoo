import type { ThemeAppInstance, ThemeAppManifest, ThemeAppStartOptions, ThemeAppStopOptions, HealthCheckResult } from '../types';

export type ThemeAppRuntimeMode = 'local-process';

export interface ThemeAppRuntimeHandle {
  kind: ThemeAppRuntimeMode;
  pid?: number;
}

export interface ThemeAppRuntimeStartResult {
  instance: ThemeAppInstance;
  handle: ThemeAppRuntimeHandle;
}

export interface ThemeAppRuntimeStartParams {
  instanceKey: string;
  slug: string;
  target: 'shop' | 'admin';
  themeDir: string;
  manifest: ThemeAppManifest;
  options: ThemeAppStartOptions;
  onProcessError: (error: Error, instance: ThemeAppInstance) => void;
  onProcessExit: (code: number | null, signal: NodeJS.Signals | null, instance: ThemeAppInstance) => void;
}

export interface ThemeAppRuntimeStopParams {
  instanceKey: string;
  instance: ThemeAppInstance;
  handle: ThemeAppRuntimeHandle;
  options: ThemeAppStopOptions;
}

export interface ThemeAppRuntimeHealthCheckParams {
  instance: ThemeAppInstance;
}

export interface ThemeAppRuntimeAdapter {
  readonly mode: ThemeAppRuntimeMode;
  start(params: ThemeAppRuntimeStartParams): Promise<ThemeAppRuntimeStartResult>;
  stop(params: ThemeAppRuntimeStopParams): Promise<void>;
  checkHealth(params: ThemeAppRuntimeHealthCheckParams): Promise<HealthCheckResult | null>;
}
