/**
 * i18n plugin - Admin UI HTML endpoint tests
 *
 * Tests the GET /admin route that serves the translation management SPA.
 */

import http from 'http';
import express from 'express';
import { describe, it, expect, vi } from 'vitest';

// Mock services/prisma/redis to prevent real connections during route tests
vi.mock('../../src/lib/prisma', () => ({
  prisma: {},
}));
vi.mock('../../src/lib/redis', () => ({
  getRedis: vi.fn(),
  connectRedis: vi.fn(),
  syncContentToRedis: vi.fn(),
  syncUIToRedis: vi.fn(),
  syncLocalesToRedis: vi.fn(),
}));

import { adminRoutes } from '../../src/routes/admin';

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use('/admin', adminRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
}

describe('i18n Admin UI', () => {
  it('should return 200 with Content-Type text/html for GET /admin/', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/admin/`);
      expect(res.status).toBe(200);
      const contentType = res.headers.get('content-type') || '';
      expect(contentType).toContain('text/html');
    });
  });

  it('should contain "Localization" title in the HTML', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/admin/`);
      const html = await res.text();
      expect(html).toContain('Localization');
    });
  });

  it('should contain i18n badge text', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/admin/`);
      const html = await res.text();
      expect(html).toContain('i18n');
    });
  });

  it('should contain "Translation Manager" heading', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/admin/`);
      const html = await res.text();
      expect(html).toContain('Translation Manager');
    });
  });

  it('should contain all expected tabs: Languages, Content, UI Strings', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/admin/`);
      const html = await res.text();

      expect(html).toContain('data-tab="languages"');
      expect(html).toContain('data-tab="content"');
      expect(html).toContain('data-tab="ui"');

      // Also check the visible tab text
      expect(html).toContain('>Languages<');
      expect(html).toContain('>Content<');
      expect(html).toContain('>UI Strings<');
    });
  });

  it('should return valid HTML document structure', async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/admin/`);
      const html = await res.text();

      expect(html).toContain('<!doctype html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
      expect(html).toContain('<script>');
    });
  });
});
