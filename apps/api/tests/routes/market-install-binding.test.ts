import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

const mocks = vi.hoisted(() => ({
  getOfficialCatalogEntry: vi.fn(),
  getMarketplaceBindingContext: vi.fn(),
  authorizeInstall: vi.fn(),
  getOfficialDetail: vi.fn(),
  assertOfficialArtifactReachable: vi.fn(),
  downloadArtifactWithResume: vi.fn(),
  verifyOfficialArtifact: vi.fn(),
  installOfficialMarketExtension: vi.fn(),
}));

vi.mock('@/core/auth/middleware', () => ({
  authMiddleware: async (request: any) => {
    request.user = {
      id: 'admin_user_1',
      role: 'ADMIN',
      email: 'admin@jiffoo.com',
    };
  },
  adminMiddleware: async () => undefined,
}));

vi.mock('@/core/admin/market/official-catalog', () => ({
  getOfficialCatalog: vi.fn(),
  getOfficialCatalogEntry: mocks.getOfficialCatalogEntry,
}));

vi.mock('@/core/admin/platform-connection/service', () => ({
  platformConnectionService: {
    getMarketplaceBindingContext: mocks.getMarketplaceBindingContext,
  },
}));

vi.mock('@/core/admin/market/market-client', () => ({
  MarketClient: {
    authorizeInstall: mocks.authorizeInstall,
    getOfficialDetail: mocks.getOfficialDetail,
    recordInstall: vi.fn(),
    checkConnectivity: vi.fn(),
    browse: vi.fn(),
    search: vi.fn(),
  },
  getMarketBaseUrl: () => 'http://platform-api:80/api',
}));

vi.mock('@/core/admin/market/resumable-downloader', () => ({
  downloadArtifactWithResume: mocks.downloadArtifactWithResume,
  cleanupDownloadedArtifact: vi.fn(),
}));

vi.mock('@/core/admin/market/artifact-verification', () => ({
  verifyOfficialArtifact: mocks.verifyOfficialArtifact,
  verifyEmbeddedOfficialArtifact: vi.fn(),
}));

vi.mock('@/core/admin/market/install-handoff', () => ({
  installOfficialMarketExtension: mocks.installOfficialMarketExtension,
}));

vi.mock('@/core/admin/market/official-artifact-health', () => ({
  assertOfficialArtifactReachable: mocks.assertOfficialArtifactReachable,
}));

vi.mock('@/core/admin/market/embedded-artifact-store', () => ({
  resolveEmbeddedOfficialArtifactPath: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/core/admin/extension-installer/signature-verifier', () => ({
  getSignatureVerifyMode: () => 'off',
  hasOfficialPublicKey: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/core/admin/extension-installer/official-only', () => ({
  isOfficialMarketOnly: () => false,
}));

import { marketRoutes } from '@/core/admin/market/routes';

describe('market install binding guard', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(marketRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOfficialCatalogEntry.mockReturnValue({
      slug: 'stripe',
      kind: 'plugin',
    });
    mocks.getMarketplaceBindingContext.mockResolvedValue({
      status: {
        status: 'unbound',
        instanceBound: false,
        tenantBound: false,
        marketplaceReady: false,
        requiresPlatformBinding: true,
        instance: null,
        tenantBinding: null,
        pending: null,
      },
      context: null,
    });
    mocks.getOfficialDetail.mockResolvedValue({
      slug: 'stripe',
      kind: 'plugin',
      listingDomain: 'app_marketplace',
      listingKind: 'plugin',
      providerType: 'official',
      deliveryMode: 'package-managed',
      paymentMode: 'platform_collect',
      settlementTargetType: 'platform',
      settlementTargetId: null,
      pricingModel: 'free',
      price: null,
      currency: 'USD',
      sellableVersion: '1.0.0',
      versions: [
        {
          version: '1.0.0',
          packageUrl: 'https://platform.example.com/plugins/stripe/1.0.0.jplugin',
          minCoreVersion: '1.0.0',
        },
      ],
    });
    mocks.assertOfficialArtifactReachable.mockResolvedValue(undefined);
    mocks.downloadArtifactWithResume.mockResolvedValue({
      filePath: '/tmp/stripe-1.0.0.jplugin',
    });
    mocks.verifyOfficialArtifact.mockResolvedValue({ verified: true });
    mocks.installOfficialMarketExtension.mockResolvedValue({
      slug: 'stripe',
      version: '1.0.0',
      source: 'official-market',
    });
  });

  it('blocks official marketplace install when the instance is not platform-bound', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/extensions/stripe/install',
      payload: {
        kind: 'plugin',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      success: false,
      error: {
        code: 'PLATFORM_CONNECTION_REQUIRED',
      },
    });
    expect(mocks.authorizeInstall).not.toHaveBeenCalled();
  });

  it('allows free official installs to continue without a platform binding', async () => {
    mocks.getOfficialCatalogEntry.mockReturnValue({
      slug: 'stripe',
      kind: 'plugin',
      defaultPricingModel: 'free',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/extensions/stripe/install',
      payload: {
        kind: 'plugin',
      },
    });

    expect(response.statusCode).not.toBe(403);
    expect(mocks.authorizeInstall).not.toHaveBeenCalled();
    expect(mocks.getOfficialDetail).toHaveBeenCalledWith('stripe');
  });
});
