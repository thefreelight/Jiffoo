import { describe, expect, it } from 'vitest';
import { redisCache } from '@/core/cache/redis';

describe('The cache client', () => {
  it('bounds the wait for a Redis that stopped answering, so a read misses instead of hanging', () => {
    const options = redisCache.getRawClient().options;

    // The connect attempt and every command have a deadline.
    expect(options.connectTimeout).toBe(5_000);
    expect(options.commandTimeout).toBe(5_000);

    // The offline queue is disabled: a command that is issued while the
    // client is not connected fails at once instead of waiting for a
    // connection that may never come.
    expect(options.enableOfflineQueue).toBe(false);
    expect(options.maxRetriesPerRequest).toBe(0);
    expect(options.autoResendUnfulfilledCommands).toBe(false);
  });
});
