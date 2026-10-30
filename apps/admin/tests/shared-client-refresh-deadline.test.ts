// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { ApiClient } from '../../../packages/shared/api/client';
import { listenOnUsablePort } from './mock-server-port';

/**
 * The deadline of the axios instance of the shared client.
 *
 * The refresh of the token carries the same deadline, so a Core that stops
 * answering during a refresh fails the waiting request instead of holding it.
 */
const INSTANCE_TIMEOUT_MS = 300;

/** The storage of a signed-in session of the shared client. */
const session = {
  getItem: (key: string): string | null => (key === 'auth_token' ? 'ACCESS_TOKEN' : key === 'refresh_token' ? 'REFRESH_TOKEN' : null),
  setItem: (): void => { /* The test keeps the session of the client fixed. */ },
  removeItem: (): void => { /* The test keeps the session of the client fixed. */ },
  clear: (): void => { /* The test keeps the session of the client fixed. */ },
};

async function closeCore(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

describe('the deadline of the token refresh of the shared client', () => {
  it('fails the waiting request with a timeout when the refresh never answers', async () => {
    let refreshCalls = 0;
    const server = createServer((request, response) => {
      if (request.url === '/auth/refresh') {
        refreshCalls += 1;
        return; // The Core accepts the refresh and never answers it.
      }
      response.writeHead(401, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED' } }));
    });
    const port = await listenOnUsablePort(server);
    try {
      const client = new ApiClient({ baseURL: `http://127.0.0.1:${port}`, timeout: INSTANCE_TIMEOUT_MS }, session);
      const started = Date.now();
      const result = await client.get('/orders');
      const elapsed = Date.now() - started;
      expect(refreshCalls).toBe(1);
      expect(result.success).toBe(false);
      // The request waited for the deadline of the refresh and failed with it,
      // instead of hanging on the Core that never answers.
      expect(elapsed).toBeGreaterThanOrEqual(200);
      expect(elapsed).toBeLessThan(5000);
    } finally {
      await closeCore(server);
    }
  });
});
