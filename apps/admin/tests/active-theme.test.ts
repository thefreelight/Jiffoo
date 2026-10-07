import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { adminThemeStyle } from '../lib/theme-font';
import { getAdminTheme } from '../lib/server-theme';
import { themeTokensToCss } from 'shared';

const response = {
  target: 'admin', slug: 'e2e-admin-theme', version: '1.0.0',
  packageHash: 'a'.repeat(64),
  tokens: { primary: '#cc0033', 'font-body': 'brand' },
  fonts: [{
    id: 'brand', family: 'Brand Sans',
    url: '/api/v1/themes/e2e-admin-theme/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/fonts/brand.woff2',
    weight: 400, style: 'normal',
  }],
  logo: '/api/v1/themes/e2e-admin-theme/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/assets/logo.png',
  loginBackground: '/api/v1/themes/e2e-admin-theme/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/assets/login.png',
};

let server: Server | undefined;
const prior = process.env.API_SERVICE_URL;
afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
  if (prior === undefined) delete process.env.API_SERVICE_URL;
  else process.env.API_SERVICE_URL = prior;
});

async function serve(status: number, body: unknown) {
  server = createServer((request, reply) => {
    expect(request.url).toBe('/api/v1/store/theme?target=admin&locale=en');
    reply.writeHead(status, { 'Content-Type': 'application/json' });
    reply.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No local test port');
  process.env.API_SERVICE_URL = `http://127.0.0.1:${address.port}`;
}

describe('Admin active theme', () => {
  it('B4 accepts only assets bound to the resolved package hash', async () => {
    await serve(200, { data: { ...response, logo: response.logo.replace('a'.repeat(64), 'b'.repeat(64)) } });
    expect(await getAdminTheme('en')).toBeNull();
  });
  it('B4 rejects semver asset aliases after the contract break', async () => {
    await serve(200, { data: { ...response, fonts: [{ ...response.fonts[0], url: '/api/v1/themes/e2e-admin-theme/1.0.0/fonts/brand.woff2' }] } });
    expect(await getAdminTheme('en')).toBeNull();
  });
  it('L serializes a real theme response with tokens, resolved font and exact font-face', async () => {
    await serve(200, { data: response });
    const theme = await getAdminTheme('en');
    expect(theme).toEqual(response);
    const css = adminThemeStyle(theme!);
    const expectedTokens = themeTokensToCss('admin', response.tokens,
      (id) => id === 'brand' ? 'Brand Sans' : undefined);
    expect(css).toBe(`@font-face{font-family:"Brand Sans";src:url("/api/v1/themes/e2e-admin-theme/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/fonts/brand.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap;}\n:root{\n${expectedTokens}\n}`);
  });

  it('M falls back to Core defaults for 404, network, missing URL and invalid payload', async () => {
    await serve(404, { error: 'missing' });
    expect(await getAdminTheme('en')).toBeNull();
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
    expect(await getAdminTheme('en')).toBeNull();
    delete process.env.API_SERVICE_URL;
    expect(await getAdminTheme('en')).toBeNull();
    await serve(200, { data: { ...response, tokens: null } });
    expect(await getAdminTheme('en')).toBeNull();
    expect(adminThemeStyle({ tokens: {}, fonts: [] })).toContain(
      '--admin-font-body: system-ui, -apple-system, sans-serif;');
  });
});
