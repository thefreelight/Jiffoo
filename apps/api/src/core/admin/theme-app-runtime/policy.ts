/**
 * Theme App runtime policy
 *
 * Encodes the operational boundary for the current local-process runtime.
 */

export interface ThemeAppRuntimePolicy {
  enabled: boolean;
  mode: 'local-process';
  apiReplicaCount: number | null;
  allowUnsafeMultiPod: boolean;
  supported: boolean;
  reasons: string[];
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value === 'true';
}

function parseReplicaCount(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
}

export function getThemeAppRuntimePolicy(): ThemeAppRuntimePolicy {
  const enabled = parseBooleanEnv(process.env.THEME_APP_RUNTIME_ENABLED, true);
  const apiReplicaCount = parseReplicaCount(process.env.API_REPLICA_COUNT);
  const allowUnsafeMultiPod = parseBooleanEnv(
    process.env.THEME_APP_RUNTIME_ALLOW_UNSAFE_MULTI_POD,
    false
  );

  const reasons: string[] = [];

  if (!enabled) {
    reasons.push('Theme App runtime is disabled via THEME_APP_RUNTIME_ENABLED=false.');
  }

  if (apiReplicaCount !== null && apiReplicaCount > 1 && !allowUnsafeMultiPod) {
    reasons.push(
      `Theme App runtime uses pod-local child processes and requires a single API replica. Current API_REPLICA_COUNT=${apiReplicaCount}.`
    );
  }

  return {
    enabled,
    mode: 'local-process',
    apiReplicaCount,
    allowUnsafeMultiPod,
    supported: reasons.length === 0,
    reasons,
  };
}

export function assertThemeAppRuntimeSupported(operation: string): void {
  const policy = getThemeAppRuntimePolicy();
  if (policy.supported) {
    return;
  }

  const guidance: string[] = [];
  if (!policy.enabled) {
    guidance.push('Enable Theme App runtime by setting THEME_APP_RUNTIME_ENABLED=true.');
  }
  if (policy.apiReplicaCount !== null && policy.apiReplicaCount > 1 && !policy.allowUnsafeMultiPod) {
    guidance.push('Set services.api.replicaCount=1 for local-process Theme Apps.');
    guidance.push('If you accept the current multi-pod risk temporarily, set THEME_APP_RUNTIME_ALLOW_UNSAFE_MULTI_POD=true.');
  }

  throw new Error(
    [`Cannot ${operation}.`, ...policy.reasons, ...guidance].join(' ')
  );
}
