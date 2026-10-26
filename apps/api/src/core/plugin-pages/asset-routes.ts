import type { FastifyInstance } from 'fastify';
import type { IncomingHttpHeaders } from 'node:http';
import { createHash } from 'node:crypto';
import { pluginPackageBlobStore } from '@/core/storage/plugin-package-blob-store';
import { readPluginZipEntries, buildPluginUiAssetIndex } from 'shared/plugin-signing';
import { isPluginManifest, isPluginAssetPath } from '@jiffoo/shared';
import { pluginSigningError } from '@/core/extensions/runtime/plugin-signing-policy';
import { assertPluginNotPaused } from '@/core/extensions/runtime/plugin-migration-gate';
import { ApiError, sendMappedError } from '@/utils/api-errors';
import { errorResponseSchema } from '@/utils/schema-helpers';
import { getInstallationById } from '@/core/extensions/registry';

export function exactPluginOrigin(value: string): URL {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash
    || url.hostname.includes('*') || /[;'"\s]/.test(url.host)
    || (url.pathname !== '/' && url.pathname !== '')
    || (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('Plugin page origins require HTTPS except loopback and no credentials, query or fragment');
  }
  return url;
}

export function pluginPublicOrigins(config: { STOREFRONT_URL?: string; ADMIN_URL?: string }): readonly URL[] | null {
  try {
    if (!config.STOREFRONT_URL || !config.ADMIN_URL) return null;
    return [exactPluginOrigin(config.STOREFRONT_URL), exactPluginOrigin(config.ADMIN_URL)];
  } catch { return null; }
}

/**
 * The public host of a request. The Host header wins; a proxy that cannot send Host
 * (fetch() drops it) states the public host in x-forwarded-host instead. Either value is
 * only trusted when it matches a configured origin exactly.
 */
export function pluginPublicOriginFor(request: { headers: IncomingHttpHeaders }, origins: readonly URL[] | null): URL | null {
  if (!origins) return null;
  const hostOrigin = origins.find(origin => origin.host === request.headers.host);
  if (hostOrigin) return hostOrigin;
  const forwarded = request.headers['x-forwarded-host'];
  if (typeof forwarded !== 'string' || forwarded.includes(',')) return null;
  return origins.find(origin => origin.host === forwarded) ?? null;
}

export function pluginFrameHelmet(origins: readonly URL[] | null) {
  const asset = (request: { headers: IncomingHttpHeaders }) => pluginPublicOriginFor(request, origins)?.origin ?? "'none'";
  return {
    xFrameOptions: false as const,
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"], scriptSrc: [asset], styleSrc: [asset, "'unsafe-inline'"],
        fontSrc: [asset], imgSrc: [asset, 'data:', 'blob:'], connectSrc: [asset],
        objectSrc: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"],
        frameSrc: ["'none'"], workerSrc: ["'none'"],
        frameAncestors: origins?.map(origin => origin.origin) ?? ["'none'"],
        sandbox: ['allow-scripts', 'allow-forms'],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' as const },
    crossOriginEmbedderPolicy: false as const,
    xContentTypeOptions: true,
  };
}

export async function pluginAssetRoutes(app: FastifyInstance) {
  // Snapshot only operator configuration at startup; never infer public origins from transport URLs.
  const origins = pluginPublicOrigins({ STOREFRONT_URL: process.env.STOREFRONT_URL, ADMIN_URL: process.env.ADMIN_URL });
  app.get<{ Params: { installationId: string; zipHash: string; '*': string } }>('/plugin-assets/:installationId/:zipHash/*', {
    helmet: pluginFrameHelmet(origins),
    schema: {
      tags: ['plugin-pages'], summary: 'Read an indexed plugin page asset without identity credentials',
      params: {
        type: 'object', required: ['installationId', 'zipHash', '*'], additionalProperties: false,
        properties: { installationId: { type: 'string', minLength: 1, maxLength: 128 },
          zipHash: { type: 'string' }, '*': { type: 'string' } },
      },
      response: { 200: { type: 'string', format: 'binary' }, 304: { type: 'null' },
        403: errorResponseSchema, 404: errorResponseSchema, 500: errorResponseSchema, 503: errorResponseSchema },
    },
  }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const missing = () => sendMappedError(reply, new ApiError('NOT_FOUND'));
    try {
      const { installationId, zipHash, '*': path } = request.params;
      if (!/^[a-f0-9]{64}$/.test(zipHash) || !isPluginAssetPath(path)) return missing();
      const current = () => getInstallationById(installationId, zipHash);
      const installation = await current();
      if (!installation || pluginSigningError(installation.package)) return missing();
      await assertPluginNotPaused(installation.pluginSlug);
      const blob = await pluginPackageBlobStore.get(installation.pluginSlug, zipHash);
      if (!blob) return missing();
      const bytes = Buffer.from(blob.bytes);
      if (blob.sizeBytes !== bytes.length || createHash('sha256').update(bytes).digest('hex') !== zipHash) {
        throw new ApiError('PLUGIN_PACKAGE_CORRUPT');
      }
      const entries = readPluginZipEntries(bytes, true);
      const entry = entries.find(file => file.path === 'manifest.json')
        ?? entries.find(file => /^[^/]+\/manifest\.json$/.test(file.path));
      if (!entry) throw new ApiError('PLUGIN_PACKAGE_CORRUPT');
      const manifest: unknown = JSON.parse(entry.content.toString('utf8'));
      if (!isPluginManifest(manifest) || manifest.slug !== installation.pluginSlug
        || manifest.version !== installation.package.version || !manifest.ui) return missing();
      // G4 supplies authoritative dependency admission; an unknown graph is not operational.
      if (manifest.serviceDependencies?.length) return missing();
      const root = entry.path.slice(0, -'manifest.json'.length);
      const files = entries.filter(file => !file.path.endsWith('/')).map(file => ({
        ...file, path: root && file.path.startsWith(root) ? file.path.slice(root.length) : file.path,
      }));
      const asset = buildPluginUiAssetIndex(manifest, files).find(file => file.path === path);
      if (!asset || (asset.mime === 'text/html' && ![...manifest.ui.storefrontPages, ...manifest.ui.adminPages]
        .some(page => page.entry === path))) return missing();
      if (asset.mime === 'text/html' && !pluginPublicOriginFor(request, origins)) return missing();
      const file = files.find(file => file.path === `${manifest.ui!.assetDirectory}/${path}`);
      if (!file) return missing();
      // Recheck shared state after package work, including before a conditional response.
      const latest = await current();
      if (!latest || latest.protectionGeneration !== installation.protectionGeneration) return missing();
      await assertPluginNotPaused(installation.pluginSlug);
      const etag = `"${asset.sha256}"`;
      reply.type(asset.mime).headers({
        'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public,max-age=31536000,immutable',
        ETag: etag,
      });
      reply.removeHeader('Access-Control-Allow-Credentials');
      reply.removeHeader('Set-Cookie');
      if (request.headers['if-none-match']?.split(',').some(value => ['*', etag, `W/${etag}`].includes(value.trim()))) {
        return reply.code(304).send();
      }
      return reply.header('Content-Length', asset.size).send(file.content);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PLUGIN_MAINTENANCE') return missing();
      return sendMappedError(reply, error);
    }
  });
}
