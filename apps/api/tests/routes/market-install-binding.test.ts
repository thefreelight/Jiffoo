import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

const mocks = vi.hoisted(() => ({
  getOfficialCatalogEntry: vi.fn(),
  getMarketplaceBindingContext: vi.fn(),
  authorizeInstall: vi.fn(),
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
  resolveOfficialCatalogEntry: (slug: string) => mocks.getOfficialCatalogEntry(slug),
}));

vi.mock('@/core/admin/platform-connection/service', () => ({
  platformConnectionService: {
    getMarketplaceBindingContext: mocks.getMarketplaceBindingContext,
  },
}));

vi.mock('@/core/admin/market/market-client', () => ({
  MarketClient: {
    authorizeInstall: mocks.authorizeInstall,
    recordInstall: vi.fn(),
    checkConnectivity: vi.fn(),
    browse: vi.fn(),
    search: vi.fn(),
    getOfficialDetail: vi.fn().mockResolvedValue({
      slug: 'stripe',
      kind: 'plugin',
      sellableVersion: '1.0.0',
      currentVersion: '1.0.0',
      versions: [{ version: '1.0.0', packageUrl: 'https://example.com/stripe-1.0.0.jplugin' }],
      pricingModel: 'free',
      deliveryMode: 'package-managed',
      paymentMode: 'platform_collect',
      settlementTargetType: 'platform',
    }),
  },
  getMarketBaseUrl: () => 'http://platform-api:80/api',
}));

vi.mock('@/core/admin/market/resumable-downloader', () => ({
  downloadArtifactWithResume: vi.fn(),
  cleanupDownloadedArtifact: vi.fn(),
}));

vi.mock('@/core/admin/market/official-artifacts-client', () => ({
  fetchOfficialArtifactsIndex: vi.fn().mockResolvedValue([]),
  buildOfficialArtifactMap: vi.fn().mockReturnValue(new Map()),
}));

vi.mock('@/core/admin/market/artifact-verification', () => ({
  verifyOfficialArtifact: vi.fn(),
}));

vi.mock('@/core/admin/market/install-handoff', () => ({
  installOfficialMarketExtension: mocks.installOfficialMarketExtension,
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
  });

  const denial = {
    allowed: false,
    slug: 'stripe',
    kind: 'plugin',
    deliveryMode: 'package-managed',
    packageUrl: null,
    checksumUrl: null,
    entitlement: { required: true, status: 'denied', pricingModel: 'member', reason: 'Platform connection or a membership license key is required' },
    reason: 'Platform connection or a membership license key is required',
  };
  const boundContext = {
    status: { status: 'tenant_bound', instanceBound: true, tenantBound: true, marketplaceReady: true, requiresPlatformBinding: true },
    context: {
      instanceId: 'inst-1', instanceToken: 'tok-1', platformAccountId: 'acct-1', tenantBindingId: 'bind-1', localStoreId: 'store-1',
    },
  };

  it('asks the platform to authorize an official install and tells an unbound instance to connect', async () => {
    mocks.authorizeInstall.mockResolvedValue(denial);
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
    expect(mocks.authorizeInstall).toHaveBeenCalledWith('stripe', { userId: 'admin_user_1', version: undefined });
    expect(mocks.installOfficialMarketExtension).not.toHaveBeenCalled();
  });

  it('does not trust a static catalog entry that marks a paid item as free', async () => {
    // 26 paid items were labelled free in the static catalog; the platform's answer wins.
    mocks.getOfficialCatalogEntry.mockReturnValue({ slug: 'stripe', kind: 'plugin', defaultPricingModel: 'free' });
    mocks.getMarketplaceBindingContext.mockResolvedValue(boundContext);
    mocks.authorizeInstall.mockResolvedValue(denial);
    const response = await app.inject({ method: 'POST', url: '/extensions/stripe/install', payload: { kind: 'plugin' } });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      success: false,
      error: { code: 'OFFICIAL_EXTENSION_NOT_INSTALLABLE', details: { entitlement: { required: true, status: 'denied' } } },
    });
    expect(mocks.authorizeInstall).toHaveBeenCalledWith('stripe', expect.objectContaining({ instanceId: 'inst-1', instanceToken: 'tok-1', tenantBindingId: 'bind-1', localStoreId: 'store-1' }));
    expect(mocks.installOfficialMarketExtension).not.toHaveBeenCalled();
  });

  it('fails closed when the platform cannot be reached', async () => {
    mocks.getOfficialCatalogEntry.mockReturnValue({ slug: 'stripe', kind: 'plugin', defaultPricingModel: 'free' });
    mocks.authorizeInstall.mockRejectedValue(new Error('Official install authorization error: 502'));
    const response = await app.inject({ method: 'POST', url: '/extensions/stripe/install', payload: { kind: 'plugin' } });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ success: false, error: { code: 'MARKET_UNAVAILABLE' } });
    expect(mocks.installOfficialMarketExtension).not.toHaveBeenCalled();
  });

  it('allows free official installs to continue without a platform binding', async () => {
    mocks.getOfficialCatalogEntry.mockReturnValue({
      slug: 'stripe',
      kind: 'plugin',
      defaultPricingModel: 'free',
    });
    mocks.authorizeInstall.mockResolvedValue({
      allowed: true,
      slug: 'stripe',
      kind: 'plugin',
      deliveryMode: 'package-managed',
      paymentMode: 'platform_collect',
      settlementTargetType: 'platform',
      artifactKind: 'plugin-package',
      version: '1.0.0',
      packageUrl: 'https://platform.example.com/plugins/stripe/1.0.0.jplugin',
      checksumUrl: 'https://platform.example.com/plugins/stripe/1.0.0.jplugin.sha256',
      signatureUrl: 'https://platform.example.com/plugins/stripe/1.0.0.jplugin.sig',
      pricingModel: 'free',
      price: null,
      currency: 'USD',
      entitlement: {
        required: false,
        status: 'not_required',
        pricingModel: 'free',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/extensions/stripe/install',
      payload: {
        kind: 'plugin',
      },
    });

    expect(response.statusCode).not.toBe(403);
    // The platform authorizes the install and answers "free" without any
    // binding, so the request is not blocked with PLATFORM_CONNECTION_REQUIRED.
    // The install itself may fail for other reasons (e.g. missing artifacts),
    // which is acceptable for this binding guard test.
    expect(mocks.authorizeInstall).toHaveBeenCalledWith('stripe', { userId: 'admin_user_1', version: undefined });
    if (response.statusCode === 403) {
      const body = response.json();
      expect(body.error?.code).not.toBe('PLATFORM_CONNECTION_REQUIRED');
    }
  });

  it('installs a membership item the platform marks as free-base on an unbound instance', async () => {
    // The platform hands such an item to everyone: no membership and no platform
    // connection are asked for, and the answer is not a 402-style denial.
    mocks.getOfficialCatalogEntry.mockReturnValue({ slug: 'traffic-analytics', kind: 'plugin', defaultPricingModel: 'free' });
    const grantUrl = 'https://get.jiffoo.com/api/marketplace/official/package/plugin/traffic-analytics/0.0.1?grant=' + 'b'.repeat(64);
    mocks.authorizeInstall.mockResolvedValue({
      allowed: true,
      slug: 'traffic-analytics',
      kind: 'plugin',
      deliveryMode: 'package-managed',
      paymentMode: 'platform_collect',
      settlementTargetType: 'platform',
      artifactKind: 'plugin-package',
      version: '0.0.1',
      packageUrl: grantUrl,
      checksumUrl: `${grantUrl.replace('?grant=', '/sha256?grant=')}`,
      signatureUrl: null,
      pricingModel: 'member',
      price: 99,
      currency: 'USD',
      entitlement: { required: false, status: 'free_base', pricingModel: 'member' },
    });

    const response = await app.inject({ method: 'POST', url: '/extensions/traffic-analytics/install', payload: { kind: 'plugin' } });

    expect(response.statusCode).not.toBe(403);
    expect(mocks.authorizeInstall).toHaveBeenCalledWith('traffic-analytics', { userId: 'admin_user_1', version: undefined });
  });
});
