// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { NextRequest } from 'next/server';
import * as routes from '../app/api/[[...path]]/route';
import { getAdminTheme, getStoreTimezone } from '../lib/server-theme';
import { listenOnUsablePort } from './mock-server-port';

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
      response.end(JSON.stringify({ success: true, data: { id: 'core-order' } }));
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

describe('the deadline of the Admin edge towards the Core', () => {
  it('answers 503 with the code of an unreachable Core when the Core never answers', async () => {
    const core = await startSilentCore();
    try {
      vi.stubEnv('API_SERVICE_URL', core.url);
      vi.stubEnv('CORE_EDGE_TIMEOUT_MS', String(DEADLINE_MS));
      const started = Date.now();
      const response = await routes.GET(new NextRequest('http://127.0.0.1:3002/api/v1/orders'));
      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('API_SERVICE_UNAVAILABLE');
      expect(typeof body.error.message).toBe('string');
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
      const response = await routes.GET(new NextRequest('http://127.0.0.1:3002/api/v1/orders'));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, data: { id: 'core-order' } });
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
      const response = await routes.GET(new NextRequest('http://127.0.0.1:3002/api/v1/orders'));
      expect(response.status).toBe(503);
      expect((await response.json()).error.code).toBe('API_SERVICE_UNAVAILABLE');
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
      const response = await routes.GET(new NextRequest('http://127.0.0.1:3002/api/v1/orders'));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, data: { id: 'core-order' } });
    } finally {
      await closeCore(core.server);
    }
  });

  it('renders the default theme when the Core does not answer in time', async () => {
    const core = await startSilentCore();
    try {
      vi.stubEnv('API_SERVICE_URL', core.url);
      vi.stubEnv('CORE_EDGE_TIMEOUT_MS', String(DEADLINE_MS));
      const started = Date.now();
      expect(await getAdminTheme('en')).toBeNull();
      expect(await getStoreTimezone()).toBe('UTC');
      expect(Date.now() - started).toBeLessThan(5000);
    } finally {
      await closeCore(core.server);
    }
  });

  it('truncates the answer of a Core that stalls the body instead of hanging', async () => {
    const core = await startStallingCore();
    try {
      vi.stubEnv('API_SERVICE_URL', core.url);
      vi.stubEnv('CORE_EDGE_TIMEOUT_MS', String(DEADLINE_MS));
      const response = await routes.GET(new NextRequest('http://127.0.0.1:3002/api/v1/orders'));
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

  it('renders the default theme when the Core stalls the body of the answer', async () => {
    const core = await startStallingCore();
    try {
      vi.stubEnv('API_SERVICE_URL', core.url);
      vi.stubEnv('CORE_EDGE_TIMEOUT_MS', String(DEADLINE_MS));
      const started = Date.now();
      expect(await getAdminTheme('en')).toBeNull();
      expect(await getStoreTimezone()).toBe('UTC');
      expect(Date.now() - started).toBeLessThan(5000);
    } finally {
      await closeCore(core.server);
    }
  });
});
