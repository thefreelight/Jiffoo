import { expect, it } from 'vitest';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { env } from '@/config/env';
import { LogAggregator } from '@/core/logger/log-aggregator';
import { SecretManagerService } from '@/core/secrets/secret-manager';

it('structured logs survive a new aggregator without a retained per-user memory cache', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'jiffoo-log-audit-'));
  try {
    const writer = new LogAggregator(root);
    writer.addLog({ id: 'audit-log', timestamp: new Date().toISOString(), level: 'info', message: 'Order audit',
      appName: 'api', environment: 'test', meta: { userId: 'audit-user', orderId: 'audit-order' } });
    expect(Object.keys(writer)).toEqual(['logsDir']);
    const reader = new LogAggregator(root);
    expect((await reader.queryLogs({ userId: 'audit-user' })).logs).toHaveLength(1);
    expect((await reader.queryLogs({ userId: 'another-user' })).logs).toHaveLength(0);
    expect(await reader.getLogStats()).toMatchObject({ totalLogs: 1, infoLogs: 1 });
  } finally { await rm(root, { recursive: true, force: true }); }
});

it('Vault references are resolved afresh and secret values never enter a process-wide cache', async () => {
  let value = 'first-value', requests = 0;
  const server = createServer((_request, response) => {
    requests++; response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ data: { data: { token: value } } }));
  });
  const previous = { address: env.VAULT_ADDR, token: env.VAULT_TOKEN };
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    env.VAULT_ADDR = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    env.VAULT_TOKEN = 'test-vault-token';
    expect(await SecretManagerService.resolve('vault://kv/audit#token')).toBe('first-value');
    value = 'rotated-value';
    expect(await SecretManagerService.resolve('vault://kv/audit#token')).toBe('rotated-value');
    expect(requests).toBe(2);
    expect(Object.hasOwn(SecretManagerService, 'cache')).toBe(false);
  } finally {
    env.VAULT_ADDR = previous.address; env.VAULT_TOKEN = previous.token;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
