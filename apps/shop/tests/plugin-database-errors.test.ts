import { expect, it } from 'vitest';
import { safeCoreFailure } from '../lib/core-errors';

it.each([
  ['PLUGIN_DATABASE_BUSY', 503, 'Plugin database is busy. Try again shortly.'],
  ['PLUGIN_DATABASE_OUTCOME_UNKNOWN', 502, 'Plugin database commit outcome is unknown. Do not retry automatically.'],
] as const)('J Shop preserves database code %s and its specific safe message', async (code, status, message) => {
  const result = await safeCoreFailure(Response.json({ success: false, error: { code, message: 'PRIVATE_DATABASE_DETAIL' } }, { status }));
  expect(result.status).toBe(status);
  expect(result.headers.get('cache-control')).toBe('no-store');
  expect(await result.json()).toEqual({ success: false, error: { code, message } });
});
it('J Shop retains maintenance, timeout, unavailable and plugin-fault classifications', async () => {
  for (const [code, status] of [['PLUGIN_MAINTENANCE', 503], ['PLUGIN_TIMEOUT', 504], ['DATABASE_UNAVAILABLE', 503], ['PLUGIN_ERROR', 502]] as const) {
    const result = await safeCoreFailure(Response.json({ error: { code, message: 'PRIVATE_DATABASE_DETAIL' } }, { status }));
    expect(result.status).toBe(status); expect((await result.json()).error.code).toBe(code);
  }
});
