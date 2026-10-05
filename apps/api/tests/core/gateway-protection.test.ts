import { afterAll, afterEach, describe, expect, it } from 'vitest';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { env } from '@/config/env';
import { SharedProtection } from '@/infra/shared-protection';
import { getPluginTimeoutMs, isResponseTooLarge, MAX_RESPONSE_SIZE_BYTES, DEFAULT_GATEWAY_TIMEOUT_MS, CIRCUIT_BREAKER_CONFIG, RATE_LIMIT_CONFIG } from '@/core/admin/extension-installer/gateway-protection';

describe('Redis gateway protection', () => {
  const prefix = `test:breaker:${randomUUID()}`;
  const protection = new SharedProtection(env.REDIS_URL);
  const redis = new Redis(env.REDIS_URL);
  afterEach(async () => { const keys = await redis.keys(`${prefix}:*`); if (keys.length) await redis.del(...keys); });
  afterAll(() => { protection.close(); redis.disconnect(); });
  it('returns default timeout when no config', () => { expect(getPluginTimeoutMs()).toBe(DEFAULT_GATEWAY_TIMEOUT_MS); expect(DEFAULT_GATEWAY_TIMEOUT_MS).toBe(10000); });
  it('returns configured timeout when valid', () => { for (const timeoutMs of [5000, 30000]) expect(getPluginTimeoutMs({ timeoutMs })).toBe(timeoutMs); });
  it('falls back to default for invalid values', () => { for (const timeoutMs of [-1, 0, 60001, 120000, 'abc', '5']) expect(getPluginTimeoutMs({ timeoutMs })).toBe(10000); });
  it('returns false for missing content-length', () => { for (const value of [null, undefined, '']) expect(isResponseTooLarge(value)).toBe(false); });
  it('returns false for responses under limit', () => { for (const value of ['0', '1024', String(MAX_RESPONSE_SIZE_BYTES)]) expect(isResponseTooLarge(value)).toBe(false); });
  it('returns true for responses over limit', () => { for (const value of [String(MAX_RESPONSE_SIZE_BYTES + 1), String(10 * 1024 * 1024)]) expect(isResponseTooLarge(value)).toBe(true); });
  it('returns false for invalid content-length', () => { for (const value of ['abc', 'NaN']) expect(isResponseTooLarge(value)).toBe(false); });
  it('MAX_RESPONSE_SIZE_BYTES is 5MB', () => expect(MAX_RESPONSE_SIZE_BYTES).toBe(5 * 1024 * 1024));
  it('circuit breaker has correct defaults', () => expect(CIRCUIT_BREAKER_CONFIG).toEqual({ windowMs: 60000, minSamples: 10, failureRateThreshold: 0.5, openDurationMs: 30000 }));
  it('rate limit has correct defaults', () => expect(RATE_LIMIT_CONFIG).toEqual({ defaultLimitPerMinute: 60, windowMs: 60000 }));
  it('J: distributed failures open the breaker and only one tokened half-open probe is allowed', async () => {
    const scope = `${prefix}:scope`;
    for (let i = 0; i < 10; i++) { const permit = await protection.breaker(scope); expect(permit).not.toBeNull(); await protection.result(permit!, false); }
    expect(await protection.breaker(scope)).toBeNull();
    await redis.hset(`${scope}:breaker`, 'until', '0');
    const permits = await Promise.all(Array.from({ length: 10 }, () => protection.breaker(scope)));
    expect(permits.filter(Boolean)).toHaveLength(1);
    await protection.result(permits.find(Boolean)!, true);
    expect(await protection.breaker(scope)).not.toBeNull();
  });
  it('K: a late result from the old generation cannot contaminate the new generation', async () => {
    const old = `${prefix}:generation:0`; const current = `${prefix}:generation:1`;
    const delayed = await protection.breaker(old);
    for (let i = 0; i < 10; i++) { const permit = await protection.breaker(old); await protection.result(permit!, false); }
    await protection.result(delayed!, false);
    expect(await protection.breaker(old)).toBeNull(); expect(await protection.breaker(current)).not.toBeNull();
  });
  it('M: quota rejection does not create breaker failure samples', async () => {
    const scope = `${prefix}:scope`;
    expect((await protection.rate(`${scope}:http`, 60000, 1)).allowed).toBe(true);
    expect((await protection.rate(`${scope}:http`, 60000, 1)).allowed).toBe(false);
    expect(await redis.zcard(`${scope}:failures`)).toBe(0);
  });
  it('J: successful samples below the failure threshold keep the breaker closed', async () => {
    const scope = `${prefix}:mixed`;
    for (let i = 0; i < 20; i++) {
      const permit = await protection.breaker(scope);
      expect(permit).not.toBeNull();
      await protection.result(permit!, i < 15);
    }
    expect(await protection.breaker(scope)).not.toBeNull();
  });
  it('J: expired probe results cannot close a later half-open probe', async () => {
    const scope = `${prefix}:expired`;
    for (let i = 0; i < 10; i++) await protection.result((await protection.breaker(scope))!, false);
    await redis.hset(`${scope}:breaker`, 'until', '0');
    const expired = await protection.breaker(scope);
    await redis.hset(`${scope}:breaker`, 'until', '0');
    await protection.result(expired!, true);
    expect(await redis.hget(`${scope}:breaker`, 'state')).toBe('half-open');
    const current = await protection.breaker(scope);
    expect(current!.token).not.toBe(expired!.token);
    await protection.result(expired!, true);
    expect(await protection.breaker(scope)).toBeNull();
    await protection.result(current!, true);
    expect(await protection.breaker(scope)).not.toBeNull();
  });
});
