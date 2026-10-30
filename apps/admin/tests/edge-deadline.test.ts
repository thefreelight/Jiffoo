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

/** A Core that sends the headers at once and the body after the given delay. */
async function startSlowBodyCore(delayMs: number): Promise<{ server: Server; url: string }> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.write('{"success":true');
    setTimeout(() => response.end('}'), delayMs);
  });
  const port = await listenOnUsablePort(server);
  return { server, url: `http://127.0.0.1:${port}` };
}

/** A Core that records the requests it receives and answers with a body of the given size. */
async function startRecordingCore(bodyBytes: number): Promise<{ server: Server; url: string; calls: string[] }> {
  const calls: string[] = [];
  const server = createServer((request, response) => {
    calls.push(request.url ?? '');
    response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': String(bodyBytes) });
    response.end('x'.repeat(bodyBytes));
  });
  const port = await listenOnUsablePort(server);
  return { server, url: `http://127.0.0.1:${port}`, calls };
}

/** The structured records that the edge wrote while it degraded. */
function degradationRecords(spy: { mock: { calls: unknown[][] } }): Array<Record<string, unknown>> {
  return spy.mock.calls
    .map((call) => call.map((value) => String(value)).join(' '))
    .map((line) => { try { return JSON.parse(line) as Record<string, unknown>; } catch { return null; } })
    .filter((record): record is Record<string, unknown> => Boolean(record) && record!.event === 'edge_core_degraded');
}

async function closeCore(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

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
    const spy = vi.spyOn(console, 'error').mockImplementation(() => { /* The record is the assertion. */ });
    try {
      vi.stubEnv('API_SERVICE_URL', core.url);
      vi.stubEnv('CORE_EDGE_TIMEOUT_MS', String(DEADLINE_MS));
      vi.stubEnv('CORE_EDGE_BODY_TIMEOUT_MS', String(DEADLINE_MS));
      const response = await routes.GET(new NextRequest('http://127.0.0.1:3002/api/v1/orders'));
      expect(response.status).toBe(200);
      const started = Date.now();
      const outcome = await Promise.race([
        response.text().then(() => 'ended', () => 'truncated'),
        new Promise<string>((resolve) => setTimeout(() => resolve('hung'), 3000)),
      ]);
      expect(outcome).not.toBe('hung');
      expect(Date.now() - started).toBeLessThan(3000);
      const records = degradationRecords(spy);
      expect(records.length).toBeGreaterThanOrEqual(1);
      expect(records[0].surface).toBe('admin_proxy');
      expect(records[0].reason).toBe('body_timeout');
      expect(records[0].upstreamStatus).toBe(200);
    } finally {
      await closeCore(core.server);
    }
  });

  it('renders the default theme when the Core stalls the body of the answer', async () => {
    const core = await startStallingCore();
    try {
      vi.stubEnv('API_SERVICE_URL', core.url);
      vi.stubEnv('CORE_EDGE_TIMEOUT_MS', String(DEADLINE_MS));
      vi.stubEnv('CORE_EDGE_BODY_TIMEOUT_MS', String(DEADLINE_MS));
      const started = Date.now();
      expect(await getAdminTheme('en')).toBeNull();
      expect(await getStoreTimezone()).toBe('UTC');
      expect(Date.now() - started).toBeLessThan(5000);
    } finally {
      await closeCore(core.server);
    }
  });

  it('records a structured degradation when the Core does not answer in time', async () => {
    const core = await startSilentCore();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => { /* The record is the assertion. */ });
    try {
      vi.stubEnv('API_SERVICE_URL', core.url);
      vi.stubEnv('CORE_EDGE_TIMEOUT_MS', String(DEADLINE_MS));
      await routes.GET(new NextRequest('http://127.0.0.1:3002/api/v1/orders'));
      const records = degradationRecords(spy);
      expect(records.length).toBeGreaterThanOrEqual(1);
      const record = records[0];
      expect(record.event).toBe('edge_core_degraded');
      expect(record.surface).toBe('admin_proxy');
      expect(record.reason).toBe('header_timeout');
      expect(record.path).toBe('/api/v1/orders');
      expect(record.headerDeadlineMs).toBe(DEADLINE_MS);
      expect(record.bodyDeadlineMs).toBe(300000);
      expect(record.upstreamStatus).toBeNull();
      expect(typeof record.elapsedMs).toBe('number');
    } finally {
      await closeCore(core.server);
    }
  });

  it('records a structured degradation when the theme of the Core is not available', async () => {
    const core = await startSilentCore();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => { /* The record is the assertion. */ });
    try {
      vi.stubEnv('API_SERVICE_URL', core.url);
      vi.stubEnv('CORE_EDGE_TIMEOUT_MS', String(DEADLINE_MS));
      await getAdminTheme('en');
      const records = degradationRecords(spy);
      expect(records.length).toBeGreaterThanOrEqual(1);
      expect(records[0].surface).toBe('admin_theme');
      expect(records[0].reason).toBe('header_timeout');
      expect(records[0].path).toBe('/api/v1/store/theme');
    } finally {
      await closeCore(core.server);
    }
  });

  it('refuses an oversized request body with 413 before it reaches the Core', async () => {
    const core = await startRecordingCore(16);
    try {
      vi.stubEnv('API_SERVICE_URL', core.url);
      vi.stubEnv('CORE_EDGE_MAX_REQUEST_BYTES', '1024');
      const declared = await routes.POST(new NextRequest('http://127.0.0.1:3002/api/v1/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'content-length': '4096' }, body: 'small',
      }));
      expect(declared.status).toBe(413);
      expect((await declared.json()).error.code).toBe('PAYLOAD_TOO_LARGE');
      const measured = await routes.POST(new NextRequest('http://127.0.0.1:3002/api/v1/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(4096),
      }));
      expect(measured.status).toBe(413);
      expect((await measured.json()).error.code).toBe('PAYLOAD_TOO_LARGE');
      expect(core.calls).toEqual([]);
    } finally {
      await closeCore(core.server);
    }
  });

  it('keeps a slow body alive with the deadline of the body', async () => {
    const core = await startSlowBodyCore(400);
    try {
      vi.stubEnv('API_SERVICE_URL', core.url);
      vi.stubEnv('CORE_EDGE_TIMEOUT_MS', String(DEADLINE_MS));
      vi.stubEnv('CORE_EDGE_BODY_TIMEOUT_MS', '5000');
      const response = await routes.GET(new NextRequest('http://127.0.0.1:3002/api/v1/orders'));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
    } finally {
      await closeCore(core.server);
    }
  });
});
