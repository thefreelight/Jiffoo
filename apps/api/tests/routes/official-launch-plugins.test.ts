import type { FastifyInstance } from 'fastify';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { createTestApp } from '../helpers/create-test-app';

const execFileAsync = promisify(execFile);

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

async function createZipFromDirectory(sourceDir: string): Promise<Buffer> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'official-plugin-dir-zip-'));
  const zipPath = path.join(tempDir, 'artifact.zip');

  try {
    await execFileAsync('zip', ['-qr', zipPath, '.'], {
      cwd: sourceDir,
    });

    return await fs.readFile(zipPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

describe('Official Launch Plugin Packages', () => {
  const prisma = getTestPrisma();
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  const stripeSlug = 'stripe';
  const i18nSlug = 'i18n';
  const stripeArtifactUrl = 'https://market.example.com/artifacts/plugins/stripe/1.0.0.jplugin';
  const i18nArtifactUrl = 'https://market.example.com/artifacts/plugins/i18n/1.0.0.jplugin';
  const stripeChecksumUrl = `${stripeArtifactUrl}.sha256`;
  const i18nChecksumUrl = `${i18nArtifactUrl}.sha256`;
  const stripeSignatureUrl = `${stripeArtifactUrl}.sig`;
  const i18nSignatureUrl = `${i18nArtifactUrl}.sig`;

  let app: FastifyInstance;
  let adminToken = '';
  let extensionsRoot = '';
  let stripeInstallationId = '';
  let i18nInstallationId = '';
  let originalFetch: typeof global.fetch | undefined;
  let stripeZip: Buffer;
  let i18nZip: Buffer;
  let defaultStoreId = '';

  beforeAll(async () => {
    extensionsRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'official-launch-ext-'));
    await fs.rm(path.join(os.tmpdir(), 'jiffoo-market-downloads', stripeSlug), {
      recursive: true,
      force: true,
    });
    await fs.rm(path.join(os.tmpdir(), 'jiffoo-market-downloads', i18nSlug), {
      recursive: true,
      force: true,
    });

    stripeZip = await createZipFromDirectory(
      path.join(repoRoot, 'extensions', 'plugins', stripeSlug),
    );
    i18nZip = await createZipFromDirectory(
      path.join(repoRoot, 'extensions', 'plugins', i18nSlug),
    );

    app = await createTestApp({
      disableFileSystem: false,
      env: {
        EXTENSIONS_PATH: extensionsRoot,
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_launch_plugin',
      },
    });

    const { token } = await createAdminWithToken();
    adminToken = token;

    const defaultStore = await prisma.store.create({
      data: {
        name: 'Launch Store',
        slug: `launch-store-${Date.now()}`,
        currency: 'USD',
        defaultLocale: 'en',
        supportedLocales: ['en'],
      },
    });
    defaultStoreId = defaultStore.id;

    originalFetch = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      const method = getRequestMethod(input, init);
      const rangeHeader = getHeaderValue(init?.headers, 'Range');

      if (url.endsWith(`/marketplace/official/catalog/${stripeSlug}/authorize-install`) && method === 'POST') {
        return jsonResponse({
          success: true,
          data: {
            allowed: true,
            slug: stripeSlug,
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
            packageUrl: stripeArtifactUrl,
            checksumUrl: stripeChecksumUrl,
            signatureUrl: stripeSignatureUrl,
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

      if (url.endsWith(`/marketplace/official/catalog/${i18nSlug}/authorize-install`) && method === 'POST') {
        return jsonResponse({
          success: true,
          data: {
            allowed: true,
            slug: i18nSlug,
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
            packageUrl: i18nArtifactUrl,
            checksumUrl: i18nChecksumUrl,
            signatureUrl: i18nSignatureUrl,
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

      if (
        (url.endsWith(`/marketplace/official/catalog/${stripeSlug}/record-install`) ||
          url.endsWith(`/marketplace/official/catalog/${i18nSlug}/record-install`)) &&
        method === 'POST'
      ) {
        return jsonResponse({ success: true, data: { recorded: true } });
      }

      if (url === stripeArtifactUrl && method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: {
            'Content-Length': String(stripeZip.length),
            'Accept-Ranges': 'bytes',
            ETag: '"stripe-1.0.0"',
          },
        });
      }

      if (url === i18nArtifactUrl && method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: {
            'Content-Length': String(i18nZip.length),
            'Accept-Ranges': 'bytes',
            ETag: '"i18n-1.0.0"',
          },
        });
      }

      if (url === stripeArtifactUrl && method === 'GET') {
        const start = rangeHeader ? Number(rangeHeader.replace('bytes=', '').replace('-', '')) : 0;
        const body = stripeZip.subarray(start);
        return new Response(body, {
          status: start > 0 ? 206 : 200,
          headers: {
            'Content-Type': 'application/zip',
            'Content-Length': String(body.length),
            'Accept-Ranges': 'bytes',
            ...(start > 0
              ? {
                  'Content-Range': `bytes ${start}-${stripeZip.length - 1}/${stripeZip.length}`,
                }
              : {}),
          },
        });
      }

      if (url === stripeChecksumUrl && method === 'GET') {
        return new Response(`${sha256Hex(stripeZip)}  ${path.basename(stripeArtifactUrl)}\n`, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain',
          },
        });
      }

      if (url === stripeSignatureUrl && method === 'GET') {
        return new Response(null, { status: 404 });
      }

      if (url === i18nArtifactUrl && method === 'GET') {
        const start = rangeHeader ? Number(rangeHeader.replace('bytes=', '').replace('-', '')) : 0;
        const body = i18nZip.subarray(start);
        return new Response(body, {
          status: start > 0 ? 206 : 200,
          headers: {
            'Content-Type': 'application/zip',
            'Content-Length': String(body.length),
            'Accept-Ranges': 'bytes',
            ...(start > 0
              ? {
                  'Content-Range': `bytes ${start}-${i18nZip.length - 1}/${i18nZip.length}`,
                }
              : {}),
          },
        });
      }

      if (url === i18nChecksumUrl && method === 'GET') {
        return new Response(`${sha256Hex(i18nZip)}  ${path.basename(i18nArtifactUrl)}\n`, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain',
          },
        });
      }

      if (url === i18nSignatureUrl && method === 'GET') {
        return new Response(null, { status: 404 });
      }

      if (url.includes('/api/admin/stores/default/localization') && method === 'GET') {
        const store = await prisma.store.findUnique({
          where: { id: defaultStoreId },
        });

        return jsonResponse({
          success: true,
          data: {
            storeId: store?.id,
            storeName: store?.name,
            storeSlug: store?.slug,
            defaultLocale: store?.defaultLocale,
            supportedLocales: store?.supportedLocales || ['en'],
            availableLocales: ['en', 'zh-Hant'],
          },
        });
      }

      if (url.includes('/api/admin/stores/default/localization') && method === 'PUT') {
        const rawBody = init?.body ? String(init.body) : '{}';
        const payload = JSON.parse(rawBody) as {
          defaultLocale?: string;
          supportedLocales?: string[];
        };

        const updated = await prisma.store.update({
          where: { id: defaultStoreId },
          data: {
            defaultLocale: payload.defaultLocale || 'en',
            supportedLocales: payload.supportedLocales || ['en'],
          },
        });

        return jsonResponse({
          success: true,
          data: {
            storeId: updated.id,
            storeName: updated.name,
            storeSlug: updated.slug,
            defaultLocale: updated.defaultLocale,
            supportedLocales: updated.supportedLocales || ['en'],
            availableLocales: ['en', 'zh-Hant'],
          },
        });
      }

      if (originalFetch) {
        return originalFetch(input, init);
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }) as typeof fetch;
  });

  afterAll(async () => {
    global.fetch = originalFetch as typeof fetch;
    await prisma.pluginInstallation.deleteMany({
      where: { pluginSlug: { in: [stripeSlug, i18nSlug] } },
    });
    await prisma.pluginInstall.deleteMany({
      where: { slug: { in: [stripeSlug, i18nSlug] } },
    });
    await prisma.store.deleteMany({
      where: { id: defaultStoreId },
    });
    await fs.rm(extensionsRoot, { recursive: true, force: true });
    await deleteAllTestUsers();
    if (app) {
      await app.close();
    }
  });

  it('installs and enables the official Stripe plugin package', async () => {
    const installResponse = await app.inject({
      method: 'POST',
      url: `/api/admin/market/extensions/${stripeSlug}/install`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        kind: 'plugin',
      },
    });

    if (installResponse.statusCode !== 200) {
      throw new Error(installResponse.body);
    }

    const installBody = installResponse.json();
    stripeInstallationId = installBody.data.pluginInstallation.installationId;
    expect(installBody.data.slug).toBe(stripeSlug);
    expect(installBody.data.pluginInstallation.readiness.ready).toBe(true);
    expect(installBody.data.marketInstallVerification).toEqual({
      sha256: sha256Hex(stripeZip),
      checksumVerified: true,
      signatureVerified: false,
    });
    if (!installBody.data.pluginInstallation.enabled) {
      const enableResponse = await app.inject({
        method: 'PATCH',
        url: `/api/extensions/plugin/${stripeSlug}/instances/${stripeInstallationId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          enabled: true,
        },
      });

      if (enableResponse.statusCode !== 200) {
        throw new Error(enableResponse.body);
      }
    }

    const healthResponse = await app.inject({
      method: 'GET',
      url: `/api/extensions/plugin/${stripeSlug}/health?installationId=${stripeInstallationId}`,
    });

    expect(healthResponse.statusCode).toBe(200);
    const healthBody = healthResponse.json();
    expect(healthBody.plugin).toBe(stripeSlug);
    expect(healthBody.runtime.storefrontReady).toBe(true);

    const adminStatusResponse = await app.inject({
      method: 'GET',
      url: `/api/extensions/plugin/${stripeSlug}/admin-ui/api/status?installationId=${stripeInstallationId}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(adminStatusResponse.statusCode).toBe(200);
    const adminStatusBody = adminStatusResponse.json();
    expect(adminStatusBody.success).toBe(true);
    expect(adminStatusBody.data.plugin).toBe(stripeSlug);
    expect(adminStatusBody.data.endpoints.createIntent).toBe('/api/payments/stripe/create-intent');

    const detailResponse = await app.inject({
      method: 'GET',
      url: `/api/extensions/plugin/${stripeSlug}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(detailResponse.statusCode).toBe(200);
    const detailBody = detailResponse.json();
    expect(detailBody.success).toBe(true);
    expect(detailBody.data.manifestJson.adminUi.entryPath).toBe('/admin');
  });

  it('installs, enables, and updates storefront locales through the official i18n plugin package', async () => {
    const installResponse = await app.inject({
      method: 'POST',
      url: `/api/admin/market/extensions/${i18nSlug}/install`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        kind: 'plugin',
      },
    });

    if (installResponse.statusCode !== 200) {
      throw new Error(installResponse.body);
    }

    const installBody = installResponse.json();
    i18nInstallationId = installBody.data.pluginInstallation.installationId;
    expect(installBody.data.slug).toBe(i18nSlug);
    expect(installBody.data.pluginInstallation.readiness.ready).toBe(true);
    expect(installBody.data.marketInstallVerification).toEqual({
      sha256: sha256Hex(i18nZip),
      checksumVerified: true,
      signatureVerified: false,
    });

    if (!installBody.data.pluginInstallation.enabled) {
      const enableResponse = await app.inject({
        method: 'PATCH',
        url: `/api/extensions/plugin/${i18nSlug}/instances/${i18nInstallationId}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          enabled: true,
        },
      });

      if (enableResponse.statusCode !== 200) {
        throw new Error(enableResponse.body);
      }
    }

    const stateResponse = await app.inject({
      method: 'GET',
      url: `/api/extensions/plugin/${i18nSlug}/admin-ui/api/localization?installationId=${i18nInstallationId}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    if (stateResponse.statusCode !== 200) {
      throw new Error(stateResponse.body);
    }
    const stateBody = stateResponse.json();
    expect(stateBody.success).toBe(true);
    expect(stateBody.data.store.storeId).toBe(defaultStoreId);
    expect(stateBody.data.store.defaultLocale).toBe('en');
    expect(stateBody.data.store.supportedLocales).toEqual(['en']);

    const updateResponse = await app.inject({
      method: 'PUT',
      url: `/api/extensions/plugin/${i18nSlug}/admin-ui/api/localization?installationId=${i18nInstallationId}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      payload: {
        defaultLocale: 'zh-Hant',
        supportedLocales: ['en', 'zh-Hant'],
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    const updateBody = updateResponse.json();
    expect(updateBody.success).toBe(true);
    expect(updateBody.data.defaultLocale).toBe('zh-Hant');
    expect(updateBody.data.supportedLocales).toEqual(['en', 'zh-Hant']);

    const detailResponse = await app.inject({
      method: 'GET',
      url: `/api/extensions/plugin/${i18nSlug}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(detailResponse.statusCode).toBe(200);
    const detailBody = detailResponse.json();
    expect(detailBody.success).toBe(true);
    expect(detailBody.data.manifestJson.adminUi.entryPath).toBe('/admin');

    const store = await prisma.store.findUnique({
      where: { id: defaultStoreId },
    });
    expect(store?.defaultLocale).toBe('zh-Hant');
    expect(store?.supportedLocales).toEqual(['en', 'zh-Hant']);
  });
});
