import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { PassThrough } from 'node:stream';
import archiver from 'archiver';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { clearTestPluginCache } from '../helpers/plugin-cache';

const prisma = getTestPrisma();
const previous = {
  flag: process.env.JIFFOO_TEST_MARKETPLACE_OVERRIDE,
  url: process.env.JIFFOO_TEST_MARKETPLACE_URL,
};
let app: FastifyInstance;
let server: Server;
let origin: string;
let token: string;
let userToken: string;
let requests = 0;
let appBase: string;
let responder: (_request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => void;

function catalog(versions = [{ version: '2.0.0', minApiVersion: 'v1', sha256: 'a'.repeat(64), size: 100, downloadUrl: '/package.zip' }]) {
  return { schemaVersion: 1, plugins: [{
    id: 'marketplace-test', slug: 'marketplace-test', name: 'Marketplace Test',
    description: 'A test plugin', publisherId: 'publisher-x', versions,
  }] };
}
function serve(value: unknown) {
  responder = (_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(value));
  };
}
function configure() {
  process.env.JIFFOO_TEST_MARKETPLACE_URL = `${origin}/${randomUUID()}`;
}
function get(path: string, authorization = token) {
  return app.inject({ method: 'GET', url: `/api/v1/extensions/marketplace/${path}`, headers: authorization ? { authorization: `Bearer ${authorization}` } : {} });
}
async function upload(slug: string) {
  const archive = archiver('zip');
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  const collected = new Promise<Buffer>((resolve, reject) => {
    output.on('data', (chunk: Buffer) => chunks.push(chunk));
    output.on('end', () => resolve(Buffer.concat(chunks)));
    output.on('error', reject);
    archive.on('error', reject);
  });
  archive.pipe(output);
  archive.append(JSON.stringify({
    schemaVersion: 1, slug, name: 'Marketplace Test', version: '1.0.0', description: 'Test',
    author: 'Test', category: 'integration', runtimeType: 'internal-fastify',
    hostProtocol: 'internal-fastify-v1', entryModule: 'dist/index.js', permissions: [], contracts: [],
  }), { name: 'manifest.json' });
  archive.append('module.exports = { register() {} };', { name: 'dist/index.js' });
  void archive.finalize();
  const form = new FormData();
  form.set('confirmUnsigned', 'true');
  form.set('file', new Blob([await collected], { type: 'application/zip' }), 'plugin.zip');
  return fetch(`${appBase}/api/v1/extensions/plugin/install`, {
    method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form,
  });
}

beforeAll(async () => {
  process.env.JIFFOO_TEST_MARKETPLACE_OVERRIDE = 'true';
  app = await createTestApp();
  appBase = await app.listen({ port: 0, host: '127.0.0.1' });
  token = (await createAdminWithToken()).token;
  userToken = (await createUserWithToken()).token;
  server = createServer((request, response) => { requests++; responder(request, response); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
  serve(catalog());
});
afterAll(async () => {
  await app?.close();
  server?.closeAllConnections();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  await deleteAllTestUsers();
  if (previous.flag === undefined) delete process.env.JIFFOO_TEST_MARKETPLACE_OVERRIDE;
  else process.env.JIFFOO_TEST_MARKETPLACE_OVERRIDE = previous.flag;
  if (previous.url === undefined) delete process.env.JIFFOO_TEST_MARKETPLACE_URL;
  else process.env.JIFFOO_TEST_MARKETPLACE_URL = previous.url;
});

describe('Marketplace catalog API', () => {
  it('A reports not configured and preserves plugin uploads', async () => {
    delete process.env.JIFFOO_TEST_MARKETPLACE_URL;
    expect((await get('status')).json().data).toEqual({ configured: false });
    const result = await get('catalog');
    expect(result.statusCode).toBe(503);
    expect(result.json().error.code).toBe('MARKETPLACE_NOT_CONFIGURED');
    const slug = `upload-${randomUUID().slice(0, 12)}`;
    try {
      expect((await upload(slug)).status).toBe(200);
    } finally {
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
      await prisma.pluginInstall.deleteMany({ where: { slug } });
      await clearTestPluginCache(slug);
    }
  });

  it('B returns the catalog with installed version and qualifying updates only', async () => {
    configure();
    serve(catalog());
    const slug = 'marketplace-test';
    try {
      expect((await upload(slug)).status).toBe(200);
      await prisma.pluginInstall.update({ where: { slug }, data: { publisherId: 'publisher-x', trustLevel: 'signed' } });
      const result = await get('catalog');
      expect(result.statusCode).toBe(200);
      expect(result.json().data.items[0]).toMatchObject({
        installedVersion: '1.0.0', installedPublisherId: 'publisher-x', updateAvailable: true,
        versions: [{ compatible: true }],
      });
      for (const [version, minApiVersion, publisherId] of [
        ['1.0.0', 'v1', 'publisher-x'], ['0.9.0', 'v1', 'publisher-x'],
        ['2.0.0', 'v99', 'publisher-x'], ['2.0.0', 'v1', 'publisher-y'],
      ]) {
        configure();
        serve({ ...catalog([{ version, minApiVersion, sha256: 'a'.repeat(64), size: 100, downloadUrl: '/package.zip' }]),
          plugins: [{ ...catalog().plugins[0], publisherId, versions: [{ version, minApiVersion, sha256: 'a'.repeat(64), size: 100, downloadUrl: '/package.zip' }] }] });
        const response = await get('catalog');
        expect(response.statusCode).toBe(200);
        expect(response.json().data.items[0].updateAvailable).toBe(false);
      }
    } finally {
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
      await prisma.pluginInstall.deleteMany({ where: { slug } });
      await clearTestPluginCache(slug);
    }
  });

  it.each([
    ['malformed JSON', 'not json'],
    ['unknown schemaVersion', { ...catalog(), schemaVersion: 2 }],
    ['duplicate id', { ...catalog(), plugins: [catalog().plugins[0], { ...catalog().plugins[0], slug: 'another-slug' }] }],
    ['duplicate slug', { ...catalog(), plugins: [catalog().plugins[0], { ...catalog().plugins[0], id: 'another-id' }] }],
    ['duplicate version', { ...catalog(), plugins: [{ ...catalog().plugins[0], versions: [catalog().plugins[0].versions[0], catalog().plugins[0].versions[0]] }] }],
    ['missing field', { ...catalog(), plugins: [{ id: 'marketplace-test' }] }],
    ['bad sha256', catalog([{ ...catalog().plugins[0].versions[0], sha256: 'bad' }])],
    ['oversized declared package', catalog([{ ...catalog().plugins[0].versions[0], size: 10 * 1024 * 1024 + 1 }])],
    ['off-origin URL', catalog([{ ...catalog().plugins[0].versions[0], downloadUrl: 'https://example.com/package.zip' }])],
    ['same-scheme different port', catalog([{ ...catalog().plugins[0].versions[0], downloadUrl: 'http://127.0.0.1:1/package.zip' }])],
    ['javascript URL', catalog([{ ...catalog().plugins[0].versions[0], downloadUrl: 'javascript:alert(1)' }])],
    ['credentialed URL', catalog([{ ...catalog().plugins[0].versions[0], downloadUrl: 'http://user:pass@127.0.0.1/package.zip' }])],
  ])('C rejects %s as MARKETPLACE_CATALOG_INVALID', async (_case, payload) => {
    configure();
    responder = (_request, response) => response.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
    const result = await get('catalog');
    expect(result.statusCode).toBe(502);
    expect(result.json().error.code).toBe('MARKETPLACE_CATALOG_INVALID');
  });

  it('D aborts an oversized catalog before reading the entire stream', async () => {
    configure();
    let complete = false;
    responder = (_request, response) => {
      response.write('x'.repeat(1024 * 1024 + 1));
      setTimeout(() => { complete = !response.destroyed; response.end('tail'); }, 100);
    };
    const result = await get('catalog');
    expect(result.statusCode).toBe(502);
    expect(result.json().error.code).toBe('MARKETPLACE_CATALOG_INVALID');
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
    expect(complete).toBe(false);
  });

  it.each(['headers', 'body'])('E times out when the %s stalls', async (phase) => {
    configure();
    responder = (_request, response) => {
      if (phase === 'body') response.write('{"schemaVersion":1,');
    };
    const started = Date.now();
    const result = await get('catalog');
    expect(result.statusCode).toBe(504);
    expect(result.json().error.code).toBe('MARKETPLACE_CATALOG_TIMEOUT');
    expect(Date.now() - started).toBeLessThan(7000);
  }, 8000);

  it('F rejects redirects without contacting their target', async () => {
    configure();
    let targetRequests = 0;
    responder = (request, response) => {
      if (request.url === '/target') { targetRequests++; response.end(JSON.stringify(catalog())); return; }
      response.writeHead(302, { location: `${origin}/target` }).end();
    };
    const result = await get('catalog');
    expect(result.statusCode).toBe(502);
    expect(result.json().error.code).toBe('MARKETPLACE_CATALOG_UNAVAILABLE');
    expect(targetRequests).toBe(0);
  });

  it('G reports upstream 500 and connection refused', async () => {
    configure();
    responder = (_request, response) => response.writeHead(500).end();
    expect((await get('catalog')).json().error.code).toBe('MARKETPLACE_CATALOG_UNAVAILABLE');
    process.env.JIFFOO_TEST_MARKETPLACE_URL = 'http://127.0.0.1:1/catalog';
    const result = await get('catalog');
    expect(result.statusCode).toBe(502);
    expect(result.json().error.code).toBe('MARKETPLACE_CATALOG_UNAVAILABLE');
  });

  it('H caches two reads within sixty seconds', async () => {
    configure();
    serve(catalog());
    const before = requests;
    expect((await get('catalog')).statusCode).toBe(200);
    expect((await get('catalog')).statusCode).toBe(200);
    expect(requests - before).toBe(1);
  });

  it('J requires admin authentication for both endpoints', async () => {
    for (const path of ['status', 'catalog']) {
      expect((await get(path, '')).statusCode).toBe(401);
      expect((await get(path, userToken)).statusCode).toBe(403);
    }
  });
});
