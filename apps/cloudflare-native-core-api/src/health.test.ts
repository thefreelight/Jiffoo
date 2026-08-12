import { describe, expect, it, vi } from 'vitest';

import { nativeHealth } from './health';

function env(schema: string) {
  return {
    DB: { prepare: vi.fn(() => ({ first: vi.fn(async () => ({ value: schema })) })) },
    RUNTIME_VERSION: '1.0.70-cloudflare.6',
  };
}

describe('native health schema gate', () => {
  it('accepts the Wallet Checkout schema', async () => {
    const response = await nativeHealth(env('0027') as never, (_runtime, headers) => new Headers(headers));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'ok', d1Schema: '0027' });
  });

  it('reports a mismatched schema as degraded', async () => {
    const response = await nativeHealth(env('0026') as never, (_runtime, headers) => new Headers(headers));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ status: 'degraded', d1Schema: '0026' });
  });
});
