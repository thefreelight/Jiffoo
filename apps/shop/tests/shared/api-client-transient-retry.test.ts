import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosState = vi.hoisted(() => {
  const state: {
    retryShouldFail: boolean;
    onErrorRef: ((error: any) => Promise<any>) | null;
    retryCounts: Array<number | undefined>;
  } = { retryShouldFail: false, onErrorRef: null, retryCounts: [] };

  const instance: any = Object.assign(
    vi.fn((config: any) => {
      // The retry path mutates the shared config object in place, so snapshot
      // the counter at invocation time.
      state.retryCounts.push(config?._transientRetryCount);
      if (state.retryShouldFail) {
        const timeoutError = {
          code: 'ECONNABORTED',
          message: 'timeout of 10000ms exceeded',
          config,
        };
        // A real axios instance re-runs the interceptor chain on retry;
        // emulate that so retry exhaustion is reachable in tests.
        return state.onErrorRef
          ? state.onErrorRef(timeoutError)
          : Promise.reject(timeoutError);
      }
      return Promise.resolve({ data: 'retried-ok', config });
    }),
    {
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      defaults: { baseURL: 'https://api.test', headers: {} },
    },
  );
  return { state, instance };
});

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => axiosState.instance),
    isAxiosError: vi.fn(() => false),
  },
}));

// Relative import: the shared package root resolves through its build output,
// which this test does not need.
import { ApiClient } from '../../../../packages/shared/api/client';

function transientError(method: 'get' | 'post', overrides: Record<string, unknown> = {}) {
  return {
    code: 'ECONNABORTED',
    message: 'timeout of 10000ms exceeded',
    config: { method, url: '/themes/active', baseURL: 'https://api.test', ...overrides },
  };
}

describe('ApiClient transient network retry (idempotent GET only)', () => {
  let onError: (error: any) => Promise<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    new ApiClient({ baseURL: 'https://api.test', timeout: 1000 });
    const responseUse = axiosState.instance.interceptors.response.use as ReturnType<typeof vi.fn>;
    expect(responseUse.mock.calls.length).toBeGreaterThan(0);
    onError = responseUse.mock.calls[0][1];
    axiosState.state.retryShouldFail = false;
    axiosState.state.onErrorRef = onError;
    axiosState.state.retryCounts = [];
  });

  it('retries a timed-out GET request and resolves with the retried response', async () => {
    const result = await onError(transientError('get'));

    expect(result).toMatchObject({ data: 'retried-ok' });
    expect(axiosState.instance).toHaveBeenCalledTimes(1);
    expect(axiosState.state.retryCounts).toEqual([1]);
    const retryConfig = (axiosState.instance.mock.calls[0][0] as any);
    expect(retryConfig.url).toBe('/themes/active');
  });

  it('retries at most twice and then rejects the original timeout error', async () => {
    axiosState.state.retryShouldFail = true;
    try {
      await expect(onError(transientError('get'))).rejects.toMatchObject({ code: 'ECONNABORTED' });
    } finally {
      axiosState.state.retryShouldFail = false;
    }

    expect(axiosState.instance).toHaveBeenCalledTimes(2);
    expect(axiosState.state.retryCounts).toEqual([1, 2]);
  });

  it('does not retry non-GET requests on timeout', async () => {
    await expect(onError(transientError('post'))).rejects.toMatchObject({ code: 'ECONNABORTED' });

    expect(axiosState.instance).not.toHaveBeenCalled();
  });

  it('does not retry when the server answered with an HTTP error status', async () => {
    const httpError = {
      ...transientError('get'),
      code: 'ERR_BAD_REQUEST',
      response: { status: 500, config: {} },
    };

    await expect(onError(httpError)).rejects.toBe(httpError);
    expect(axiosState.instance).not.toHaveBeenCalled();
  });
});
