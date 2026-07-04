import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/index';
import type { Express } from 'express';
import type { Server } from 'http';

let app: Express;
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe('GET /admin', () => {
  it('returns 200 with text/html content type', async () => {
    const res = await fetch(`${baseUrl}/admin`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('returns valid HTML document structure', async () => {
    const res = await fetch(`${baseUrl}/admin`);
    const html = await res.text();

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('</html>');
  });

  it('contains Stripe Console heading', async () => {
    const res = await fetch(`${baseUrl}/admin`);
    const html = await res.text();

    expect(html).toContain('<title>Stripe Console</title>');
    expect(html).toContain('Stripe Console');
  });

  it('contains Official Payment Plugin eyebrow', async () => {
    const res = await fetch(`${baseUrl}/admin`);
    const html = await res.text();

    expect(html).toContain('Official Payment Plugin');
  });

  it('contains status metrics section', async () => {
    const res = await fetch(`${baseUrl}/admin`);
    const html = await res.text();

    expect(html).toContain('id="metrics"');
  });

  it('contains endpoints and warnings sections', async () => {
    const res = await fetch(`${baseUrl}/admin`);
    const html = await res.text();

    expect(html).toContain('id="endpoints"');
    expect(html).toContain('id="warnings"');
    expect(html).toContain('Integration Endpoints');
    expect(html).toContain('Warnings');
  });
});
