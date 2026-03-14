import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { pollExternalOrderLinksMock, loggerInfoMock, loggerDebugMock, loggerErrorMock } = vi.hoisted(() => ({
  pollExternalOrderLinksMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  loggerDebugMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@/core/external-orders/service', () => ({
  ExternalOrderService: {
    pollExternalOrderLinks: pollExternalOrderLinksMock,
  },
}));

vi.mock('@/core/logger/unified-logger', () => ({
  logger: {
    info: loggerInfoMock,
    debug: loggerDebugMock,
    error: loggerErrorMock,
  },
}));

describe('ExternalOrderPollingWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    const { ExternalOrderPollingWorker } = await import('@/core/external-orders/polling-worker');
    ExternalOrderPollingWorker.stop();
    vi.useRealTimers();
  });

  it('switches to idle interval after consecutive empty polls', async () => {
    pollExternalOrderLinksMock.mockResolvedValue({
      pending: 0,
      processed: 0,
      throttled: 0,
      suggestedDelayMs: 0,
    });
    const { ExternalOrderPollingWorker } = await import('@/core/external-orders/polling-worker');

    ExternalOrderPollingWorker.start({
      activeIntervalMs: 100,
      idleIntervalMs: 1000,
      idleThreshold: 2,
      limit: 5,
    });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(pollExternalOrderLinksMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(100);
    expect(pollExternalOrderLinksMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(900);
    expect(pollExternalOrderLinksMock).toHaveBeenCalledTimes(3);
  });

  it('wakes immediately from idle mode', async () => {
    pollExternalOrderLinksMock.mockResolvedValue({
      pending: 0,
      processed: 0,
      throttled: 0,
      suggestedDelayMs: 0,
    });
    const { ExternalOrderPollingWorker } = await import('@/core/external-orders/polling-worker');

    ExternalOrderPollingWorker.start({
      activeIntervalMs: 100,
      idleIntervalMs: 1000,
      idleThreshold: 2,
      limit: 5,
    });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(pollExternalOrderLinksMock).toHaveBeenCalledTimes(2);

    ExternalOrderPollingWorker.wake('new-order');
    await vi.advanceTimersByTimeAsync(0);

    expect(pollExternalOrderLinksMock).toHaveBeenCalledTimes(3);
    expect(loggerDebugMock).toHaveBeenCalledWith(
      'External order polling worker resumed active mode',
      expect.objectContaining({ reason: 'new-order' })
    );
  });

  it('uses suggested delay when pending links are throttled', async () => {
    pollExternalOrderLinksMock
      .mockResolvedValueOnce({
        pending: 1,
        processed: 0,
        throttled: 1,
        suggestedDelayMs: 1200,
      })
      .mockResolvedValue({
        pending: 0,
        processed: 0,
        throttled: 0,
        suggestedDelayMs: 0,
      });

    const { ExternalOrderPollingWorker } = await import('@/core/external-orders/polling-worker');
    ExternalOrderPollingWorker.start({
      activeIntervalMs: 100,
      idleIntervalMs: 5000,
      idleThreshold: 3,
      limit: 5,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(pollExternalOrderLinksMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1100);
    expect(pollExternalOrderLinksMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100);
    expect(pollExternalOrderLinksMock).toHaveBeenCalledTimes(2);
  });
});
