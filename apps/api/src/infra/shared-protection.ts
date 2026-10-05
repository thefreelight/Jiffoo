import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { env } from '@/config/env';

export const PROTECTION_DEADLINE_MS = 1000;
export const PROTECTION_RETRY_SECONDS = 5;

export class SharedProtectionUnavailable extends Error {
  readonly code = 'SHARED_PROTECTION_UNAVAILABLE';
  readonly statusCode = 503;
  readonly retryAfter = PROTECTION_RETRY_SECONDS;
  constructor() { super('Shared request protection is temporarily unavailable'); }
}

export const RATE_PERMIT_SQL = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)
local count = redis.call('ZCARD', KEYS[1])
if count >= limit then
  local first = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return {0, 0, math.max(1, tonumber(first[2]) + window - now)}
end
redis.call('ZADD', KEYS[1], now, ARGV[3])
redis.call('PEXPIRE', KEYS[1], window)
return {1, limit - count - 1, window}
`;

const BREAKER_PERMIT_SQL = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local state = redis.call('HGET', KEYS[1], 'state') or 'closed'
local epoch = redis.call('HGET', KEYS[1], 'epoch') or '0'
if state == 'open' or state == 'half-open' then
  local untilAt = tonumber(redis.call('HGET', KEYS[1], 'until') or '0')
  if untilAt > now then return {0, epoch, untilAt - now} end
  redis.call('HSET', KEYS[1], 'state', 'half-open', 'probe', ARGV[1], 'until', now + tonumber(ARGV[2]))
end
redis.call('PEXPIRE', KEYS[1], 120000)
return {1, epoch, 0}
`;

const BREAKER_RESULT_SQL = `
local epoch = redis.call('HGET', KEYS[1], 'epoch') or '0'
if epoch ~= ARGV[2] then return 0 end
local state = redis.call('HGET', KEYS[1], 'state') or 'closed'
if state == 'open' then return 0 end
if state == 'half-open' and redis.call('HGET', KEYS[1], 'probe') ~= ARGV[1] then return 0 end
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
if state == 'half-open' and tonumber(redis.call('HGET', KEYS[1], 'until') or '0') <= now then return 0 end
if not redis.call('SET', KEYS[4], '1', 'PX', 120000, 'NX') then return 0 end
local failed = ARGV[3] == '0'
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now - 60000)
redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', now - 60000)
redis.call('ZADD', KEYS[2], now, ARGV[1])
if failed then redis.call('ZADD', KEYS[3], now, ARGV[1]) end
local total = redis.call('ZCARD', KEYS[2])
local failures = redis.call('ZCARD', KEYS[3])
if (state == 'half-open' and failed) or (state == 'closed' and total >= 10 and failures * 2 >= total) then
  redis.call('HSET', KEYS[1], 'state', 'open', 'epoch', tonumber(epoch) + 1, 'until', now + 30000)
elseif state == 'half-open' then
  redis.call('HSET', KEYS[1], 'state', 'closed', 'epoch', tonumber(epoch) + 1)
  redis.call('DEL', KEYS[2], KEYS[3])
end
redis.call('PEXPIRE', KEYS[1], 120000)
redis.call('PEXPIRE', KEYS[2], 60000)
redis.call('PEXPIRE', KEYS[3], 60000)
return 1
`;

export type BreakerPermit = { scope: string; token: string; epoch: string };

export class SharedProtection {
  private client: Redis;
  private connecting: Promise<unknown> | undefined;
  private closed = false;
  constructor(private readonly url: string) { this.client = this.createClient(); }
  private createClient(): Redis {
    const client = new Redis(this.url, {
      lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 0,
      connectTimeout: PROTECTION_DEADLINE_MS, commandTimeout: PROTECTION_DEADLINE_MS,
      retryStrategy: (attempt) => Math.min(100 * attempt, 1000),
      autoResendUnfulfilledCommands: false,
    });
    client.on('error', () => undefined);
    return client;
  }

  private async evaluate(sql: string, keys: string[], args: Array<string | number>): Promise<unknown> {
    if (this.closed || this.client.status === 'end') { this.closed = false; this.client = this.createClient(); this.connecting = undefined; }
    const client = this.client;
    let deadline: NodeJS.Timeout | undefined;
    const expiresAt = Date.now() + PROTECTION_DEADLINE_MS;
    const operation = async () => {
      if (client.status === 'wait') {
        this.connecting ??= client.connect().finally(() => { this.connecting = undefined; });
      }
      if (this.connecting) await this.connecting;
      if (client.status === 'connecting' || client.status === 'reconnecting' || client.status === 'connect') {
        await new Promise<void>((resolve, reject) => {
          const cleanup = () => { client.off('ready', ready); client.off('error', error); clearTimeout(timer); };
          const ready = () => { cleanup(); resolve(); };
          const error = () => { cleanup(); reject(new SharedProtectionUnavailable()); };
          const timer = setTimeout(error, Math.max(1, expiresAt - Date.now()));
          client.once('ready', ready); client.once('error', error);
        });
      }
      if (Date.now() >= expiresAt) throw new SharedProtectionUnavailable();
      if (client.status !== 'ready') throw new SharedProtectionUnavailable();
      return client.eval(sql, keys.length, ...keys, ...args);
    };
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          deadline = setTimeout(() => reject(new SharedProtectionUnavailable()), PROTECTION_DEADLINE_MS);
        }),
      ]);
    } catch { throw new SharedProtectionUnavailable(); }
    finally { if (deadline) clearTimeout(deadline); }
  }

  async rate(key: string, windowMs: number, limit: number) {
    if (!Number.isSafeInteger(windowMs) || windowMs <= 0 || !Number.isSafeInteger(limit) || limit <= 0) throw new Error('Invalid protection policy');
    const [allowed, remaining, retryMs] = await this.evaluate(RATE_PERMIT_SQL, [key], [windowMs, limit, randomUUID()]) as number[];
    return { allowed: allowed === 1, remaining, retryAfter: Math.max(1, Math.ceil(retryMs / 1000)) };
  }

  async breaker(scope: string): Promise<BreakerPermit | null> {
    const token = randomUUID();
    const [allowed, epoch] = await this.evaluate(BREAKER_PERMIT_SQL, [`${scope}:breaker`], [token, 60000]) as Array<string | number>;
    return Number(allowed) === 1 ? { scope, token, epoch: String(epoch) } : null;
  }

  async result(permit: BreakerPermit, success: boolean): Promise<void> {
    await this.evaluate(BREAKER_RESULT_SQL, [
      `${permit.scope}:breaker`, `${permit.scope}:samples`, `${permit.scope}:failures`, `${permit.scope}:result:${permit.token}`,
    ], [permit.token, permit.epoch, success ? 1 : 0]);
  }

  close(): void { this.closed = true; this.client.disconnect(); }
}

export const sharedProtection = new SharedProtection(env.REDIS_URL);
export function pluginProtectionScope(id: string, generation: bigint): string {
  return `jiffoo:protection:plugin:{${id}:${generation.toString()}}`;
}

export function sendProtectionUnavailable(reply: import('fastify').FastifyReply) {
  return reply.code(503).header('Retry-After', PROTECTION_RETRY_SECONDS).header('Cache-Control', 'no-store')
    .send({ success: false, error: { code: 'SHARED_PROTECTION_UNAVAILABLE', message: 'Shared request protection is temporarily unavailable' } });
}
