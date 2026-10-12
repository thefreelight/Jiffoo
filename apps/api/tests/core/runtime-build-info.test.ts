import { afterEach, expect, it, vi } from 'vitest';
import { getRuntimeBuildInfo } from '@/utils/runtime-build-info';

afterEach(() => vi.unstubAllEnvs());
it('reports development even if a developer shell has release variables', () => {
  vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('APP_VERSION', '1.2.3'); vi.stubEnv('BUILD_SHA', 'a'.repeat(40));
  expect(getRuntimeBuildInfo()).toEqual({ appVersion: 'development', gitSha: 'development' });
});
it('reports the immutable production image identity without package-file inference', () => {
  vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('APP_VERSION', '1.2.3'); vi.stubEnv('BUILD_SHA', 'b'.repeat(40));
  expect(getRuntimeBuildInfo()).toEqual({ appVersion: '1.2.3', gitSha: 'b'.repeat(40) });
});
