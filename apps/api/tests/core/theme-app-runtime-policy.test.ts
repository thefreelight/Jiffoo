import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertThemeAppRuntimeSupported,
  getThemeAppRuntimePolicy,
} from '../../src/core/admin/theme-app-runtime/policy';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Theme App runtime policy', () => {
  it('allows local-process runtime when single replica is configured', () => {
    vi.stubEnv('API_REPLICA_COUNT', '1');
    vi.stubEnv('THEME_APP_RUNTIME_ENABLED', 'true');
    vi.stubEnv('THEME_APP_RUNTIME_ALLOW_UNSAFE_MULTI_POD', 'false');

    const policy = getThemeAppRuntimePolicy();

    expect(policy.supported).toBe(true);
    expect(policy.apiReplicaCount).toBe(1);
    expect(() => assertThemeAppRuntimeSupported('start Theme App "yevbi" for shop')).not.toThrow();
  });

  it('blocks Theme Apps on multi-replica API deployments by default', () => {
    vi.stubEnv('API_REPLICA_COUNT', '2');
    vi.stubEnv('THEME_APP_RUNTIME_ENABLED', 'true');
    vi.stubEnv('THEME_APP_RUNTIME_ALLOW_UNSAFE_MULTI_POD', 'false');

    const policy = getThemeAppRuntimePolicy();

    expect(policy.supported).toBe(false);
    expect(policy.reasons[0]).toContain('single API replica');
    expect(() => assertThemeAppRuntimeSupported('restore Theme App "yevbi" for shop')).toThrow(
      /API_REPLICA_COUNT=2/
    );
  });

  it('allows explicit unsafe multi-pod override', () => {
    vi.stubEnv('API_REPLICA_COUNT', '3');
    vi.stubEnv('THEME_APP_RUNTIME_ALLOW_UNSAFE_MULTI_POD', 'true');
    vi.stubEnv('THEME_APP_RUNTIME_ENABLED', 'true');

    const policy = getThemeAppRuntimePolicy();

    expect(policy.supported).toBe(true);
    expect(policy.allowUnsafeMultiPod).toBe(true);
  });

  it('blocks runtime when disabled explicitly', () => {
    vi.stubEnv('THEME_APP_RUNTIME_ENABLED', 'false');
    vi.stubEnv('API_REPLICA_COUNT', '1');

    const policy = getThemeAppRuntimePolicy();

    expect(policy.supported).toBe(false);
    expect(() => assertThemeAppRuntimeSupported('start Theme App "yevbi" for shop')).toThrow(
      /THEME_APP_RUNTIME_ENABLED=false/
    );
  });
});
