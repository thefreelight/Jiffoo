import { expect, it } from 'vitest';
import { createServer } from 'node:http';
import { env } from '@/config/env';
import { SecretManagerService } from '@/core/secrets/secret-manager';
import { listenOnUsablePort } from '../helpers/mock-server-port';

it('Vault references are resolved afresh and secret values never enter a process-wide cache', async () => {
  let value = 'first-value', requests = 0;
  const server = createServer((_request, response) => {
    requests++; response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ data: { data: { token: value } } }));
  });
  const previous = { address: env.VAULT_ADDR, token: env.VAULT_TOKEN };
  try {
    const vaultPort = await listenOnUsablePort(server);
    env.VAULT_ADDR = `http://127.0.0.1:${vaultPort}`;
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
