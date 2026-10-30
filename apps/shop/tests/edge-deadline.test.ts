import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }),
  cookies: async () => new Map<string, string>(),
}));
import { serverCoreResponse, shopApi } from '../lib/core-transport';
import { GET as assetGet } from '../app/api/v1/plugin-assets/[installationId]/[zipHash]/[...path]/route';
import { listenOnUsablePort } from './helpers/mock-server-port';

/**
 * The deadline of the edge.
 *
 * The tests set a small deadline, so a Core that never answers fails fast
 * instead of holding the test for the default of thirty seconds.
 */
const DEADLINE_MS = 100;

/** A Core that never answers a request. */
async function startSilentCore(): Promise<{ server: Server; url: string }> {
  const server = createServer(() => { /* The Core accepts the request and stays silent. */ });
  const port = await listenOnUsablePort(server);
  return { server, url: `http://127.0.0.1:${port}` };
}

/** A Core that answers after the given delay. */
async function startSlowCore(delayMs: number): Promise<{ server: Server; url: string }> {
  const server = createServer((_request, response) => {
    setTimeout(() => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ success: true, data: { id: 'core-product' } }));
    }, delayMs);
  });
  const port = await listenOnUsablePort(server);
  return { server, url: `http://127.0.0.1:${port}` };
}

/** A Core that answers the headers and then stalls the body of the answer. */
async function startStallingCore(): Promise<{ server: Server; url: string }> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.write('{"success":true');
    // The Core never ends the body of the answer.
  });
  const port = await listenOnUsablePort(server);
  return { server, url: `http://127.0.0.1:${port}` };
}

async function closeCore(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('the deadline of the Shop edge towards the Core', () => {
  it('answers 503 with the availability code of the Shop when the Core never answers', async () => {
    const core = await startSilentCore();
    try {
      vi.stubEnv('API_SERVICE_URL', core.url);
      vi.stubEnv('CORE_EDGE_TIMEOUT_MS', String(DEADLINE_MS));
      const started = Date.now();
      const response = await shopApi('/products');
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('SHOP_TEMPORARILY_UNAVAILABLE');
      expect(Date.now() - started).toBeLessThan(5000);
    } finally {
      await closeCore(core.server);
    }
  });

  it('passes an answered Core response through unchanged', async () => {
    const core = await startSlowCore(0);
    try {
      vi.stubEnv('API_SERVICE_URL', core.url);
      vi.stubEnv('CORE_EDGE_TIMEOUT_MS', String(DEADLINE_MS));
      const response = await shopApi('/products');
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, data: { id: 'core-product' } });
    } finally {
      await closeCore(core.server);
    }
  });

  it('honours the deadline of the environment instead of the default', async () => {
    const core = await startSlowCore(600);
    try {
      vi.stubEnv('API_SERVICE_URL', core.url);
      vi.stubEnv('CORE_EDGE_TIMEOUT_MS', String(DEADLINE_MS));
      const started = Date.now();
      const response = await shopApi('/products');
      expect(response.status).toBe(503);
      expect((await response.json()).error.code).toBe('SHOP_TEMPORARILY_UNAVAILABLE');
      expect(Date.now() - started).toBeLessThan(5000);
    } finally {
      await closeCore(core.server);
    }
  });

  it('falls back to the default deadline when the environment carries no positive integer', async () => {
    const core = await startSlowCore(300);
    try {
      vi.stubEnv('API_SERVICE_URL', core.url);
      vi.stubEnv('CORE_EDGE_TIMEOUT_MS', '0');
      const response = await shopApi('/products');
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, data: { id: 'core-product' } });
    } finally {
      await closeCore(core.server);
    }
  });

  it('raises the availability of the Shop when the Core does not answer in time', async () => {
    const core = await startSilentCore();
    try {
      vi.stubEnv('API_SERVICE_URL', core.url);
      vi.stubEnv('CORE_EDGE_TIMEOUT_MS', String(DEADLINE_MS));
      await expect(serverCoreResponse('/products')).rejects.toMatchObject({ status: 503, code: 'SHOP_TEMPORARILY_UNAVAILABLE' });
    } finally {
      await closeCore(core.server);
    }
  });

  it('answers 503 with the availability code of the Shop when the asset Core never answers', async () => {
    const core = await startSilentCore();
    try {
      vi.stubEnv('API_SERVICE_URL', core.url);
      vi.stubEnv('STOREFRONT_URL', 'http://127.0.0.1:3003');
      vi.stubEnv('CORE_EDGE_TIMEOUT_MS', String(DEADLINE_MS));
      const started = Date.now();
      const response = await assetGet(new NextRequest(`http://127.0.0.1:3003/api/v1/plugin-assets/instance/${'a'.repeat(64)}/app.js`));
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('SHOP_TEMPORARILY_UNAVAILABLE');
      expect(Date.now() - started).toBeLessThan(5000);
    } finally {
      await closeCore(core.server);
    }
  });

  it('answers 503 with the availability code of the Shop when the Core stalls the body', async () => {
    const core = await startStallingCore();
    try {
      vi.stubEnv('API_SERVICE_URL', core.url);
      vi.stubEnv('CORE_EDGE_TIMEOUT_MS', String(DEADLINE_MS));
      const started = Date.now();
      const response = await shopApi('/products');
      expect(response.status).toBe(503);
      expect((await response.json()).error.code).toBe('SHOP_TEMPORARILY_UNAVAILABLE');
      expect(Date.now() - started).toBeLessThan(5000);
    } finally {
      await closeCore(core.server);
    }
  });

  it('truncates the asset of a Core that stalls the body instead of hanging', async () => {
    const core = await startStallingCore();
    try {
      vi.stubEnv('API_SERVICE_URL', core.url);
      vi.stubEnv('STOREFRONT_URL', 'http://127.0.0.1:3003');
      vi.stubEnv('CORE_EDGE_TIMEOUT_MS', String(DEADLINE_MS));
      const response = await assetGet(new NextRequest(`http://127.0.0.1:3003/api/v1/plugin-assets/instance/${'a'.repeat(64)}/app.js`));
      expect(response.status).toBe(200);
      const started = Date.now();
      const outcome = await Promise.race([
        response.text().then(() => 'ended', () => 'truncated'),
        new Promise<string>((resolve) => setTimeout(() => resolve('hung'), 3000)),
      ]);
      expect(outcome).not.toBe('hung');
      expect(Date.now() - started).toBeLessThan(3000);
    } finally {
      await closeCore(core.server);
    }
  });
});
