/**
 * Market Routes (§4.9)
 *
 * Admin API routes for official Jiffoo Market integration.
 * Provides browse, search, detail, install, and update-check endpoints.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, adminMiddleware } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';
import { MarketClient } from './market-client';
import type { ExtensionKind } from '@/core/admin/extension-installer';
import { getSignatureVerifyMode, hasOfficialPublicKey } from '@/core/admin/extension-installer/signature-verifier';
import { isOfficialMarketOnly } from '@/core/admin/extension-installer/official-only';
import { getOfficialCatalog, getOfficialCatalogEntry } from './official-catalog';
import { installOfficialMarketExtension } from './install-handoff';
import { cleanupDownloadedArtifact, downloadArtifactWithResume } from './resumable-downloader';
import { verifyOfficialArtifact } from './artifact-verification';
import { getMarketBaseUrl } from './market-client';
import { platformConnectionService } from '@/core/admin/platform-connection/service';
import { managedPackageService } from '@/core/admin/managed-package/service';

const MARKET_INSTALL_KINDS: ExtensionKind[] = [
  'plugin',
  'theme-shop',
  'theme-admin',
  'theme-app-shop',
  'theme-app-admin',
];

export async function marketRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/official-catalog',
    {
      onRequest: [authMiddleware, adminMiddleware],
      schema: {
        tags: ['admin-market'],
        summary: 'Get official launch catalog',
        security: [{ bearerAuth: [] }],
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await getOfficialCatalog();
        return sendSuccess(reply, result);
      } catch (error: any) {
        return sendError(reply, 500, 'OFFICIAL_CATALOG_ERROR', error?.message || 'Failed to load official catalog');
      }
    },
  );

  fastify.get(
    '/health',
    {
      onRequest: [authMiddleware, adminMiddleware],
      schema: {
        tags: ['admin-market'],
        summary: 'Check market integration health',
        security: [{ bearerAuth: [] }],
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const [connectivity, officialKeyPresent] = await Promise.all([
        MarketClient.checkConnectivity(),
        hasOfficialPublicKey(),
      ]);

      return sendSuccess(reply, {
        officialMarketOnly: isOfficialMarketOnly(),
        signatureMode: getSignatureVerifyMode(),
        officialKeyPresent,
        marketApiUrl: getMarketBaseUrl(),
        marketOnline: connectivity.ok,
        marketLatencyMs: connectivity.latencyMs,
        marketStatus: connectivity.status,
        marketError: connectivity.error,
      });
    }
  );

  // GET /api/admin/market/extensions
  // Browse extensions (proxied with cache)
  fastify.get(
    '/extensions',
    {
      onRequest: [authMiddleware, adminMiddleware],
      schema: {
        tags: ['admin-market'],
        summary: 'Browse market extensions',
        security: [{ bearerAuth: [] }],
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: { page?: number; limit?: number; category?: string; sort?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { page, limit, category, sort } = request.query as any;
        const result = await MarketClient.browse({ page, limit, category, sort });
        return sendSuccess(reply, result);
      } catch (error: any) {
        return sendError(reply, 502, 'MARKET_ERROR', error.message);
      }
    }
  );

  // GET /api/admin/market/extensions/search
  fastify.get(
    '/extensions/search',
    {
      onRequest: [authMiddleware, adminMiddleware],
      schema: {
        tags: ['admin-market'],
        summary: 'Search market extensions',
        security: [{ bearerAuth: [] }],
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: { q: string; page?: number; limit?: number };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { q, page, limit } = request.query as any;
        if (!q) {
          return sendError(reply, 400, 'BAD_REQUEST', 'Search query (q) is required');
        }
        const result = await MarketClient.search(q, { page, limit });
        return sendSuccess(reply, result);
      } catch (error: any) {
        return sendError(reply, 502, 'MARKET_ERROR', error.message);
      }
    }
  );

  // GET /api/admin/market/extensions/:slug
  fastify.get<{ Params: { slug: string } }>(
    '/extensions/:slug',
    {
      onRequest: [authMiddleware, adminMiddleware],
      schema: {
        tags: ['admin-market'],
        summary: 'Get market extension details',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const { slug } = request.params;
        if (!getOfficialCatalogEntry(slug)) {
          return sendError(reply, 404, 'NOT_FOUND', `Official extension "${slug}" not found`);
        }
        const result = await MarketClient.getOfficialDetail(slug);
        return sendSuccess(reply, result);
      } catch (error: any) {
        return sendError(reply, 502, 'MARKET_ERROR', error.message);
      }
    }
  );

  // POST /api/admin/market/extensions/:slug/install
  // Download from market and install
  fastify.post<{
    Params: { slug: string };
    Body: {
      version?: string;
      kind?: ExtensionKind;
      activate?: boolean;
      themeConfig?: Record<string, unknown>;
    };
  }>(
    '/extensions/:slug/install',
    {
      onRequest: [authMiddleware, adminMiddleware],
      schema: {
        tags: ['admin-market'],
        summary: 'Install extension from market',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        const { slug } = request.params;
        const { version, kind = 'plugin', activate, themeConfig } = request.body || {};
        const officialEntry = getOfficialCatalogEntry(slug);

        if (!officialEntry) {
          return sendError(reply, 404, 'NOT_FOUND', `Official extension "${slug}" not found`);
        }

        if (!MARKET_INSTALL_KINDS.includes(kind)) {
          return sendError(
            reply,
            400,
            'BAD_REQUEST',
            'Invalid extension kind for market install.'
          );
        }

        if (officialEntry.kind === 'plugin' && kind !== 'plugin') {
          return sendError(reply, 400, 'BAD_REQUEST', `Official plugin "${slug}" must be installed with kind "plugin"`);
        }

        if (officialEntry.kind === 'theme' && kind !== 'theme-shop') {
          return sendError(reply, 400, 'BAD_REQUEST', `Official theme "${slug}" must be installed with kind "theme-shop"`);
        }

        const managedStatus = await managedPackageService.getStatus();
        const managedPackage = managedStatus.package;
        const isManagedAsset = Boolean(
          managedPackage &&
            (officialEntry.kind === 'theme'
              ? managedPackage.includedThemes.includes(slug)
              : managedPackage.includedPlugins.includes(slug)),
        );

        if (managedPackage?.status === 'SUSPENDED' && isManagedAsset) {
          return sendError(
            reply,
            403,
            'MANAGED_PACKAGE_SUSPENDED',
            'This managed package is suspended. New installs are frozen until billing is restored.',
          );
        }

        const binding = isManagedAsset
          ? { status: null, context: null }
          : await platformConnectionService.getMarketplaceBindingContext();

        if (!isManagedAsset && !binding.context) {
          return sendError(
            reply,
            403,
            'PLATFORM_CONNECTION_REQUIRED',
            'Connect this instance to Jiffoo Platform and bind the default store before installing official marketplace extensions.',
            {
              platformConnection: binding.status,
            },
          );
        }

        const authorization = isManagedAsset
          ? await (async () => {
              const detail = await MarketClient.getOfficialDetail(slug);
              const requestedVersion = version ?? detail.sellableVersion;
              if (requestedVersion !== detail.sellableVersion) {
                throw Object.assign(new Error('Requested version is not currently sellable'), {
                  statusCode: 400,
                  code: 'UNSUPPORTED_VERSION',
                });
              }
              const versionSummary = detail.versions.find((item) => item.version === requestedVersion);
              if (!versionSummary) {
                throw Object.assign(new Error('Official artifact not found for requested version'), {
                  statusCode: 404,
                  code: 'ARTIFACT_NOT_FOUND',
                });
              }
              return {
                allowed: true,
                slug: detail.slug,
                kind: detail.kind,
                listingDomain: detail.listingDomain,
                listingKind: detail.listingKind,
                providerType: detail.providerType,
                deliveryMode: detail.deliveryMode,
                paymentMode: detail.paymentMode,
                settlementTargetType: detail.settlementTargetType,
                settlementTargetId: detail.settlementTargetId ?? null,
                artifactKind: detail.kind === 'theme' ? 'theme-package' : 'plugin-package',
                version: requestedVersion,
                packageUrl: versionSummary.packageUrl,
                checksumUrl: versionSummary.packageUrl ? `${versionSummary.packageUrl}.sha256` : null,
                signatureUrl: versionSummary.packageUrl ? `${versionSummary.packageUrl}.sig` : null,
                minCoreVersion: versionSummary.minCoreVersion ?? null,
                pricingModel: detail.pricingModel,
                price: detail.price,
                currency: detail.currency,
                entitlement: {
                  required: false,
                  status: 'not_required' as const,
                  pricingModel: detail.pricingModel,
                },
                reason: undefined,
              };
            })()
          : await MarketClient.authorizeInstall(slug, {
              userId: request.user.id,
              version,
              instanceId: binding.context.instanceId,
              instanceToken: binding.context.instanceToken,
              platformAccountId: binding.context.platformAccountId,
              tenantBindingId: binding.context.tenantBindingId,
              localStoreId: binding.context.localStoreId,
            });

        if (!authorization.allowed) {
          return sendError(
            reply,
            403,
            'OFFICIAL_EXTENSION_NOT_INSTALLABLE',
            authorization.reason || `Official extension "${slug}" is not installable for this merchant`,
            {
              entitlement: authorization.entitlement,
            },
          );
        }

        if (authorization.deliveryMode !== 'package-managed') {
          return sendError(
            reply,
            400,
            'UNSUPPORTED_DELIVERY_MODE',
            `Delivery mode "${authorization.deliveryMode}" is not supported by the Admin installer`,
          );
        }

        const downloadResult = await downloadArtifactWithResume({
          slug,
          version: authorization.version,
          url: authorization.packageUrl,
        });

        const verification = await verifyOfficialArtifact({
          filePath: downloadResult.filePath,
          packageUrl: authorization.packageUrl,
          checksumUrl: authorization.checksumUrl,
          signatureUrl: authorization.signatureUrl,
        });

        const result = await installOfficialMarketExtension({
          kind,
          artifactPath: downloadResult.filePath,
          activate,
          themeConfig,
          requestedVersion: authorization.version,
          packageUrl: authorization.packageUrl,
          listingDomain: authorization.listingDomain,
          listingKind: authorization.listingKind,
          providerType: authorization.providerType,
          deliveryMode: authorization.deliveryMode,
          paymentMode: authorization.paymentMode,
          settlementTargetType: authorization.settlementTargetType,
          settlementTargetId: authorization.settlementTargetId ?? null,
          entitlement: authorization.entitlement,
        });

        if (binding.context) {
          await MarketClient.recordInstall(slug, {
            userId: request.user.id,
            version: authorization.version,
            instanceId: binding.context.instanceId,
            instanceToken: binding.context.instanceToken,
            tenantBindingId: binding.context.tenantBindingId,
            localStoreId: binding.context.localStoreId,
          }).catch(() => undefined);
        }

        await cleanupDownloadedArtifact(slug, authorization.version).catch(() => undefined);

        return sendSuccess(
          reply,
          {
            ...result,
            marketInstallVerification: verification,
          },
          result.themeActivation?.activated
            ? `Extension "${slug}" installed from market and activated`
            : `Extension "${slug}" installed from market`
        );
      } catch (error: any) {
        const statusCode =
          typeof error?.statusCode === 'number' && Number.isFinite(error.statusCode)
            ? error.statusCode
            : error?.message?.includes('not found')
              ? 404
              : 500;
        const code = typeof error?.code === 'string' ? error.code : 'INSTALL_ERROR';
        return sendError(reply, statusCode, code, error.message, error?.details);
      }
    }
  );

  // POST /api/admin/market/check-updates
  fastify.post(
    '/check-updates',
    {
      onRequest: [authMiddleware, adminMiddleware],
      schema: {
        tags: ['admin-market'],
        summary: 'Check for extension updates',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { prisma } = await import('@/config/database');
        // Get all installed official-market extensions
        const installed = await prisma.pluginInstall.findMany({
          where: { source: 'official-market', deletedAt: null },
          select: { slug: true, version: true },
        });

        if (installed.length === 0) {
          return sendSuccess(reply, { updates: [] });
        }

        const updates = await MarketClient.checkUpdates(installed);
        return sendSuccess(reply, { updates });
      } catch (error: any) {
        return sendError(reply, 502, 'MARKET_ERROR', error.message);
      }
    }
  );
}
