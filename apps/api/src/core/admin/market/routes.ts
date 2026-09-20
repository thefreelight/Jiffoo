import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { adminMiddleware, authMiddleware } from '@/core/auth/middleware';
import type { ExtensionKind } from '@/core/admin/extension-installer';
import { getSignatureVerifyMode, hasOfficialPublicKey } from '@/core/admin/extension-installer/signature-verifier';
import { isOfficialMarketOnly } from '@/core/admin/extension-installer/official-only';
import { sendError, sendSuccess } from '@/utils/response';
import { verifyOfficialArtifact } from './artifact-verification';
import { fetchOfficialArtifactsIndex } from './official-artifacts-client';
import { assertOfficialArtifactReachable } from './official-artifact-health';
import { getOfficialCatalog } from './official-catalog';
import { installOfficialMarketExtension } from './install-handoff';
import { cleanupDownloadedArtifact, downloadArtifactWithResume } from './resumable-downloader';
import { UpdateChecker } from './update-checker';

const MARKET_INSTALL_KINDS: ExtensionKind[] = ['plugin', 'theme-shop'];

function artifactKindForInstallKind(kind: ExtensionKind): 'plugin' | 'theme' {
  return kind === 'plugin' ? 'plugin' : 'theme';
}

export async function marketRoutes(fastify: FastifyInstance) {
  fastify.get('/official-catalog', {
    onRequest: [authMiddleware, adminMiddleware],
    schema: { tags: ['admin-market'], summary: 'Get official artifact catalog', security: [{ bearerAuth: [] }] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      return sendSuccess(reply, await getOfficialCatalog());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load official catalog';
      return sendError(reply, 500, 'OFFICIAL_CATALOG_ERROR', message);
    }
  });

  fastify.get('/health', {
    onRequest: [authMiddleware, adminMiddleware],
    schema: { tags: ['admin-market'], summary: 'Check official artifact index health', security: [{ bearerAuth: [] }] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const [artifacts, officialKeyPresent] = await Promise.all([
      fetchOfficialArtifactsIndex({ fresh: true }).then((items) => ({ ok: true, count: items.length })).catch((error: unknown) => ({
        ok: false,
        count: 0,
        error: error instanceof Error ? error.message : 'Official artifact index unavailable',
      })),
      hasOfficialPublicKey(),
    ]);

    return sendSuccess(reply, {
      officialMarketOnly: isOfficialMarketOnly(),
      signatureMode: getSignatureVerifyMode(),
      officialKeyPresent,
      artifactIndexOnline: artifacts.ok,
      artifactCount: artifacts.count,
      artifactIndexError: artifacts.ok || !('error' in artifacts) ? undefined : artifacts.error,
    });
  });

  fastify.post<{
    Params: { slug: string };
    Body: { version?: string; kind?: ExtensionKind; activate?: boolean; themeConfig?: Record<string, unknown> };
  }>('/extensions/:slug/install', {
    onRequest: [authMiddleware, adminMiddleware],
    schema: { tags: ['admin-market'], summary: 'Install an official artifact', security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    try {
      const { slug } = request.params;
      const { version, kind = 'plugin', activate, themeConfig } = request.body || {};
      if (!MARKET_INSTALL_KINDS.includes(kind)) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Invalid extension kind for official artifact install.');
      }

      const artifactKind = artifactKindForInstallKind(kind);
      const artifacts = await fetchOfficialArtifactsIndex({ fresh: true });
      const artifact = artifacts.find((item) =>
        item.slug === slug && item.kind === artifactKind && (!version || item.version === version),
      );
      if (!artifact) {
        return sendError(reply, 404, 'ARTIFACT_NOT_FOUND', `Official ${artifactKind} "${slug}" was not found`);
      }

      await assertOfficialArtifactReachable(artifact.packageUrl);
      const download = await downloadArtifactWithResume({ slug, version: artifact.version, url: artifact.packageUrl });
      try {
        const verification = await verifyOfficialArtifact({
          filePath: download.filePath,
          packageUrl: artifact.packageUrl,
          checksumUrl: `${artifact.packageUrl}.sha256`,
          signatureUrl: `${artifact.packageUrl}.sig`,
        });
        const result = await installOfficialMarketExtension({
          kind,
          artifactPath: download.filePath,
          activate,
          themeConfig,
          requestedVersion: artifact.version,
          packageUrl: artifact.packageUrl,
        });
        return sendSuccess(reply, { ...result, marketInstallVerification: verification });
      } finally {
        await cleanupDownloadedArtifact(slug, artifact.version).catch(() => undefined);
      }
    } catch (error: unknown) {
      const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : 500;
      const code = typeof (error as { code?: unknown })?.code === 'string'
        ? (error as { code: string }).code
        : 'INSTALL_ERROR';
      const message = error instanceof Error ? error.message : 'Official artifact install failed';
      return sendError(reply, statusCode, code, message);
    }
  });

  fastify.post('/check-updates', {
    onRequest: [authMiddleware, adminMiddleware],
    schema: { tags: ['admin-market'], summary: 'Check installed official artifacts for updates', security: [{ bearerAuth: [] }] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      return sendSuccess(reply, { updates: await UpdateChecker.check() });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to check official artifact updates';
      return sendError(reply, 502, 'ARTIFACT_INDEX_ERROR', message);
    }
  });
}
