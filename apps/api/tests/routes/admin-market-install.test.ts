import archiver from 'archiver';
import { createHash } from 'crypto';
import type { FastifyInstance } from 'fastify';
import { createWriteStream } from 'fs';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { createTestApp } from '../helpers/create-test-app';

async function createZipBuffer(files: Record<string, string>): Promise<Buffer> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'official-market-zip-'));
  const zipPath = path.join(tempDir, 'artifact.zip');

  try {
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      output.on('error', reject);
      archive.on('error', reject);
      archive.pipe(output);

      for (const [name, content] of Object.entries(files)) {
        archive.append(content, { name });
      }

      archive.finalize().catch(reject);
    });

    return await fs.readFile(zipPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function getRequestUrl(input: RequestInfo | URL): string {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) {
    return init.method.toUpperCase();
  }

  if (typeof input === 'object' && !(input instanceof URL) && 'method' in input) {
    return String(input.method || 'GET').toUpperCase();
  }

  return 'GET';
}

function getHeaderValue(headers: HeadersInit | undefined, key: string): string | null {
  if (!headers) return null;
  const target = key.toLowerCase();

  if (headers instanceof Headers) {
    return headers.get(key);
  }

  if (Array.isArray(headers)) {
    const match = headers.find(([name]) => name.toLowerCase() === target);
    return match?.[1] ?? null;
  }

  const record = headers as Record<string, string>;
  const foundKey = Object.keys(record).find((name) => name.toLowerCase() === target);
  return foundKey ? record[foundKey] : null;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

describe('Admin Market Install Flow', () => {
  const prisma = getTestPrisma();
  const pluginSlug = 'odoo';
  const deniedSlug = 'stripe';
  const pluginArtifactUrl = 'https://market.example.com/artifacts/plugins/odoo/1.0.0.jplugin';
  const pluginChecksumUrl = `${pluginArtifactUrl}.sha256`;
  const pluginSignatureUrl = `${pluginArtifactUrl}.sig`;
  const themeFixtures = {
    'esim-mall': {
      name: 'eSIM Mall',
      artifactUrl: 'https://market.example.com/artifacts/themes/esim-mall/esim-mall-1.0.0.jtheme',
      primaryColor: '#0f172a',
      etag: '"esim-mall-1.0.0"',
    },
    yevbi: {
      name: 'Yevbi',
      artifactUrl: 'https://market.example.com/artifacts/themes/yevbi/yevbi-1.0.0.jtheme',
      primaryColor: '#111111',
      etag: '"yevbi-1.0.0"',
    },
  } as const;
  const themeSlugs = Object.keys(themeFixtures) as Array<keyof typeof themeFixtures>;

  let app: FastifyInstance;
  let adminToken = '';
  let extensionsRoot = '';
  let pluginRoot = '';
  let themeRoots: Record<string, string> = {};
  let defaultInstallationId = '';
  let originalFetch: typeof global.fetch | undefined;
  let pluginZip: Buffer;
  let themeZips: Record<string, Buffer> = {};

  beforeAll(async () => {
    extensionsRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'official-market-ext-'));
    pluginRoot = path.join(extensionsRoot, 'plugins', pluginSlug);
    themeRoots = Object.fromEntries(
      themeSlugs.map((slug) => [slug, path.join(extensionsRoot, 'themes', 'shop', slug)]),
    );

    pluginZip = await createZipBuffer({
      'manifest.json': JSON.stringify(
        {
          schemaVersion: 1,
          slug: pluginSlug,
          name: 'Official Odoo',
          version: '1.0.0',
          description: 'Official market handoff test plugin',
          author: 'Jiffoo',
          category: 'integration',
          runtimeType: 'internal-fastify',
          entryModule: 'server/index.js',
          permissions: ['catalog.read'],
          configSchema: {
            apiKey: {
              type: 'string',
              required: true,
            },
          },
          lifecycle: {
            onInstall: true,
            onEnable: true,
          },
        },
        null,
        2,
      ),
      'server/index.js': `
const path = require('path');
const fs = require('fs/promises');

async function writeMarker(fileName, payload) {
  const markerPath = path.join(__dirname, '..', fileName);
  await fs.writeFile(markerPath, JSON.stringify(payload, null, 2), 'utf-8');
}

async function plugin(fastify) {
  fastify.get('/health', async () => ({ ok: true }));
}

plugin.__lifecycle_onInstall = async (ctx) => {
  await writeMarker('install-marker.json', ctx);
};

plugin.__lifecycle_onEnable = async (ctx) => {
  await writeMarker('enable-marker.json', ctx);
};

module.exports = plugin;
      `.trim(),
    });

    themeZips = Object.fromEntries(
      await Promise.all(
        themeSlugs.map(async (slug) => {
          const fixture = themeFixtures[slug];
          const zip = await createZipBuffer({
            'theme.json': JSON.stringify(
              {
                schemaVersion: 1,
                slug,
                name: fixture.name,
                version: '1.0.0',
                target: 'shop',
                description: 'Official market storefront theme package',
                author: 'Jiffoo',
                category: 'storefront',
                entry: {
                  tokensCSS: 'tokens.css',
                  runtimeJS: 'runtime/theme-runtime.js',
                  templatesDir: 'templates',
                },
                defaultConfig: {
                  colors: {
                    primary: fixture.primaryColor,
                  },
                },
                'x-jiffoo-renderer-mode': 'embedded',
                'x-jiffoo-renderer-slug': slug,
              },
              null,
              2,
            ),
            'tokens.css': `:root { --brand-primary: ${fixture.primaryColor}; }`,
            'runtime/theme-runtime.js': `window.__JIFFOO_THEME_RUNTIME__ = { version: '1.0.0', components: {}, defaultConfig: {} };`,
            'templates/home.json': JSON.stringify(
              {
                schemaVersion: 1,
                page: 'home',
                blocks: [],
              },
              null,
              2,
            ),
          });

          return [slug, zip] as const;
        }),
      ),
    );

    app = await createTestApp({
      disableFileSystem: false,
      env: {
        EXTENSIONS_PATH: extensionsRoot,
      },
    });

    const { token } = await createAdminWithToken();
    adminToken = token;

    originalFetch = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      const method = getRequestMethod(input, init);
      const rangeHeader = getHeaderValue(init?.headers, 'Range');

      if (url.endsWith(`/marketplace/official/catalog/${pluginSlug}/authorize-install`) && method === 'POST') {
        return jsonResponse({
          success: true,
          data: {
            allowed: true,
            slug: pluginSlug,
            kind: 'plugin',
            listingDomain: 'app_marketplace',
            listingKind: 'plugin',
            providerType: 'platform',
            deliveryMode: 'package-managed',
            paymentMode: 'platform_collect',
            settlementTargetType: 'platform',
            settlementTargetId: 'platform:jiffoo',
            artifactKind: 'plugin-package',
            version: '1.0.0',
            packageUrl: pluginArtifactUrl,
            checksumUrl: pluginChecksumUrl,
            signatureUrl: pluginSignatureUrl,
            minCoreVersion: '0.2.0',
            pricingModel: 'free',
            price: null,
            currency: 'USD',
            entitlement: {
              required: false,
              status: 'not_required',
              pricingModel: 'free',
            },
          },
        });
      }

      for (const slug of themeSlugs) {
        const fixture = themeFixtures[slug];
        const themeArtifactUrl = fixture.artifactUrl;
        const themeChecksumUrl = `${themeArtifactUrl}.sha256`;
        const themeSignatureUrl = `${themeArtifactUrl}.sig`;
        const themeZip = themeZips[slug];

        if (url.endsWith(`/marketplace/official/catalog/${slug}/authorize-install`) && method === 'POST') {
          return jsonResponse({
            success: true,
            data: {
              allowed: true,
              slug,
              kind: 'theme',
              listingDomain: 'app_marketplace',
              listingKind: 'theme',
              providerType: 'platform',
              deliveryMode: 'package-managed',
              paymentMode: 'platform_collect',
              settlementTargetType: 'platform',
              settlementTargetId: 'platform:jiffoo',
              artifactKind: 'theme-package',
              version: '1.0.0',
              packageUrl: themeArtifactUrl,
              checksumUrl: themeChecksumUrl,
              signatureUrl: themeSignatureUrl,
              minCoreVersion: '0.2.0',
              pricingModel: 'free',
              price: null,
              currency: 'USD',
              entitlement: {
                required: false,
                status: 'not_required',
                pricingModel: 'free',
              },
            },
          });
        }

        if (url.endsWith(`/marketplace/official/catalog/${slug}/record-install`) && method === 'POST') {
          return jsonResponse({ success: true, data: { recorded: true } });
        }

        if (url === themeArtifactUrl && method === 'HEAD') {
          return new Response(null, {
            status: 200,
            headers: {
              'Content-Length': String(themeZip.length),
              'Accept-Ranges': 'bytes',
              ETag: fixture.etag,
            },
          });
        }

        if (url === themeArtifactUrl && method === 'GET') {
          const start = rangeHeader ? Number(rangeHeader.replace('bytes=', '').replace('-', '')) : 0;
          const body = themeZip.subarray(start);
          return new Response(body, {
            status: start > 0 ? 206 : 200,
            headers: {
              'Content-Type': 'application/zip',
              'Content-Length': String(body.length),
              'Accept-Ranges': 'bytes',
              ...(start > 0
                ? {
                    'Content-Range': `bytes ${start}-${themeZip.length - 1}/${themeZip.length}`,
                  }
                : {}),
            },
          });
        }

        if (url === themeChecksumUrl && method === 'GET') {
          return new Response(`${sha256Hex(themeZip)}  ${path.basename(themeArtifactUrl)}\n`, {
            status: 200,
            headers: {
              'Content-Type': 'text/plain',
            },
          });
        }

        if (url === themeSignatureUrl && method === 'GET') {
          return new Response(null, { status: 404 });
        }
      }

      if (url.endsWith(`/marketplace/official/catalog/${deniedSlug}/authorize-install`) && method === 'POST') {
        return jsonResponse({
          success: true,
          data: {
            allowed: false,
            slug: deniedSlug,
            kind: 'plugin',
            listingDomain: 'app_marketplace',
            listingKind: 'plugin',
            providerType: 'platform',
            deliveryMode: 'package-managed',
            paymentMode: 'platform_collect',
            settlementTargetType: 'platform',
            settlementTargetId: 'platform:jiffoo',
            artifactKind: 'plugin-package',
            version: '1.0.0',
            packageUrl: '',
            checksumUrl: null,
            signatureUrl: null,
            minCoreVersion: '0.2.0',
            pricingModel: 'subscription',
            price: 49,
            currency: 'USD',
            entitlement: {
              required: true,
              status: 'denied',
              pricingModel: 'subscription',
              reason: 'Active entitlement required',
            },
            reason: 'Active entitlement required',
          },
        });
      }

      if (url.endsWith(`/marketplace/official/catalog/${pluginSlug}/record-install`) && method === 'POST') {
        return jsonResponse({ success: true, data: { recorded: true } });
      }

      if (url === pluginArtifactUrl && method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: {
            'Content-Length': String(pluginZip.length),
            'Accept-Ranges': 'bytes',
            ETag: '"odoo-1.0.0"',
          },
        });
      }

      if (url === pluginArtifactUrl && method === 'GET') {
        const start = rangeHeader ? Number(rangeHeader.replace('bytes=', '').replace('-', '')) : 0;
        const body = pluginZip.subarray(start);
        return new Response(body, {
          status: start > 0 ? 206 : 200,
          headers: {
            'Content-Type': 'application/zip',
            'Content-Length': String(body.length),
            'Accept-Ranges': 'bytes',
            ...(start > 0
              ? {
                  'Content-Range': `bytes ${start}-${pluginZip.length - 1}/${pluginZip.length}`,
                }
              : {}),
          },
        });
      }

      if (url === pluginChecksumUrl && method === 'GET') {
        return new Response(`${sha256Hex(pluginZip)}  ${path.basename(pluginArtifactUrl)}\n`, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain',
          },
        });
      }

      if (url === pluginSignatureUrl && method === 'GET') {
        return new Response(null, { status: 404 });
      }

      if (url.includes('/marketplace/official/catalog') && method === 'GET') {
        return jsonResponse({
          success: true,
          data: {
            items: [],
            summary: {
              total: 0,
              published: 0,
              installable: 0,
              blocked: 0,
              themes: 0,
              plugins: 0,
              free: 0,
              paid: 0,
              subscription: 0,
              totalInstalls: 0,
              totalEntitlements: 0,
              activeEntitlements: 0,
            },
          },
        });
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }) as typeof fetch;
  });

  afterAll(async () => {
    global.fetch = originalFetch as typeof fetch;
    await app.inject({
      method: 'POST',
      url: '/api/admin/themes/shop/builtin-default/activate',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    }).catch(() => undefined);
    await prisma.pluginInstallation.deleteMany({ where: { pluginSlug } });
    await prisma.pluginInstall.deleteMany({ where: { slug: pluginSlug } });
    await prisma.installedTheme.deleteMany({ where: { slug: { in: themeSlugs as string[] }, target: 'shop' } });
    await fs.rm(extensionsRoot, { recursive: true, force: true });
    await deleteAllTestUsers();
    await app.close();
  });

  it('installs official-market plugins into the real core installer and exposes readiness state', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/market/extensions/${pluginSlug}/install`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        kind: 'plugin',
      },
    });

    if (response.statusCode !== 200) {
      throw new Error(response.body);
    }
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.slug).toBe(pluginSlug);
    expect(body.data.source).toBe('official-market');
    expect(body.data.marketInstall.requestedVersion).toBe('1.0.0');
    expect(body.data.marketInstall.deliveryMode).toBe('package-managed');
    expect(body.data.marketInstall.listingDomain).toBe('app_marketplace');
    expect(body.data.marketInstall.providerType).toBe('platform');
    expect(body.data.marketInstall.paymentMode).toBe('platform_collect');
    expect(body.data.marketInstall.settlementTargetType).toBe('platform');
    expect(body.data.pluginInstallation.installationId).toBeTruthy();
    expect(body.data.pluginInstallation.instanceKey).toBe('default');
    expect(body.data.pluginInstallation.enabled).toBe(false);
    expect(body.data.pluginInstallation.readiness.requiresConfiguration).toBe(true);
    expect(body.data.pluginInstallation.readiness.ready).toBe(false);
    expect(body.data.pluginInstallation.readiness.missingFields).toContain('apiKey');
    expect(body.data.pluginInstallation.lifecycleWarning).toBeNull();
    expect(body.data.marketInstallVerification).toEqual({
      sha256: sha256Hex(pluginZip),
      checksumVerified: true,
      signatureVerified: false,
    });

    defaultInstallationId = body.data.pluginInstallation.installationId;

    const pluginPackage = await prisma.pluginInstall.findUnique({
      where: { slug: pluginSlug },
    });
    expect(pluginPackage?.source).toBe('official-market');

    const defaultInstance = await prisma.pluginInstallation.findUnique({
      where: {
        pluginSlug_instanceKey: {
          pluginSlug,
          instanceKey: 'default',
        },
      },
    });
    expect(defaultInstance?.id).toBe(defaultInstallationId);
    expect(defaultInstance?.enabled).toBe(false);

    const installedMeta = JSON.parse(
      await fs.readFile(path.join(pluginRoot, '.installed.json'), 'utf-8'),
    ) as {
      source?: string;
      officialMarket?: {
        requestedVersion?: string;
        deliveryMode?: string;
        listingDomain?: string;
        providerType?: string;
        paymentMode?: string;
        settlementTargetType?: string;
      };
    };
    expect(installedMeta.source).toBe('official-market');
    expect(installedMeta.officialMarket?.requestedVersion).toBe('1.0.0');
    expect(installedMeta.officialMarket?.deliveryMode).toBe('package-managed');
    expect(installedMeta.officialMarket?.listingDomain).toBe('app_marketplace');
    expect(installedMeta.officialMarket?.providerType).toBe('platform');
    expect(installedMeta.officialMarket?.paymentMode).toBe('platform_collect');
    expect(installedMeta.officialMarket?.settlementTargetType).toBe('platform');

    const installMarker = JSON.parse(
      await fs.readFile(path.join(pluginRoot, 'install-marker.json'), 'utf-8'),
    ) as { installationId?: string; pluginSlug?: string };
    expect(installMarker.installationId).toBe(defaultInstallationId);
    expect(installMarker.pluginSlug).toBe(pluginSlug);
  });

  it('uses the existing core enable flow for official-market plugin instances', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/extensions/plugin/${pluginSlug}/instances/${defaultInstallationId}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        enabled: true,
        config: {
          apiKey: 'secret-token',
        },
      },
    });

    if (response.statusCode !== 200) {
      throw new Error(response.body);
    }
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.installationId).toBe(defaultInstallationId);
    expect(body.data.enabled).toBe(true);
    expect(body.data.config.apiKey).toBe('secret-token');

    const defaultInstance = await prisma.pluginInstallation.findUnique({
      where: { id: defaultInstallationId },
    });
    expect(defaultInstance?.enabled).toBe(true);

    const enableMarker = JSON.parse(
      await fs.readFile(path.join(pluginRoot, 'enable-marker.json'), 'utf-8'),
    ) as { installationId?: string; config?: { apiKey?: string } };
    expect(enableMarker.installationId).toBe(defaultInstallationId);
    expect(enableMarker.config?.apiKey).toBe('secret-token');
  });

  it.each(themeSlugs)('installs and activates official-market theme %s through the real theme-management flow', async (themeSlug) => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/market/extensions/${themeSlug}/install`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        kind: 'theme-shop',
        activate: true,
      },
    });

    if (response.statusCode !== 200) {
      throw new Error(response.body);
    }
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.slug).toBe(themeSlug);
    expect(body.data.source).toBe('official-market');
    expect(body.data.themeActivation.activated).toBe(true);
    expect(body.data.themeActivation.activeTheme.slug).toBe(themeSlug);
    expect(body.data.themeActivation.activeTheme.source).toBe('official-market');
    expect(body.data.marketInstall.requestedVersion).toBe('1.0.0');
    expect(body.data.marketInstallVerification).toEqual({
      sha256: sha256Hex(themeZips[themeSlug]),
      checksumVerified: true,
      signatureVerified: false,
    });

    const installedMeta = JSON.parse(
      await fs.readFile(path.join(themeRoots[themeSlug], '.installed.json'), 'utf-8'),
    ) as { source?: string; officialMarket?: { installedVersion?: string } };
    expect(installedMeta.source).toBe('official-market');
    expect(installedMeta.officialMarket?.installedVersion).toBe('1.0.0');
    await expect(
      fs.stat(path.join(themeRoots[themeSlug], 'runtime', 'theme-runtime.js')),
    ).resolves.toBeDefined();
  });

  it('rejects official installs when entitlement authorization denies access', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/market/extensions/${deniedSlug}/install`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        kind: 'plugin',
      },
    });

    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('OFFICIAL_EXTENSION_NOT_INSTALLABLE');
    expect(body.error.message).toContain('Active entitlement required');
  });
});
