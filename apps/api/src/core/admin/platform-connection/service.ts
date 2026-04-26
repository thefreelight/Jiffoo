import crypto from 'crypto';
import { prisma } from '@/config/database';
import { MarketClient } from '@/core/admin/market/market-client';
import { systemSettingsService } from '@/core/admin/system-settings/service';
import { normalizePlatformVerifyUrl } from './url';
import type {
  PlatformConnectionCompleteRequest,
  PlatformConnectionInstance,
  PlatformConnectionPollRequest,
  PlatformConnectionStartRequest,
  PlatformConnectionStartResponse,
  PlatformConnectionStatus,
  PlatformConnectionTenantBinding,
} from 'shared';

const PLATFORM_CONNECTION_SETTINGS_KEY = 'platform.connection';
const OFFICIAL_EXTENSIONS_BOOTSTRAP_MODE = process.env.OFFICIAL_EXTENSIONS_BOOTSTRAP_MODE;
const DEFAULT_PLATFORM_BOOTSTRAP_ACCOUNT_EMAIL =
  process.env.PLATFORM_BOOTSTRAP_ACCOUNT_EMAIL || 'merchant@jiffoo.com';
const DEFAULT_PLATFORM_BOOTSTRAP_ACCOUNT_NAME =
  process.env.PLATFORM_BOOTSTRAP_ACCOUNT_NAME || 'Merchant Owner';

type StoredPlatformConnectionState = {
  instanceKey?: string;
  pending?: PlatformConnectionStartResponse['pending'] | null;
  instance?: (PlatformConnectionInstance & { instanceToken: string }) | null;
  tenantBinding?: PlatformConnectionTenantBinding | null;
  updatedAt?: string;
};

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizePending(value: unknown): PlatformConnectionStartResponse['pending'] | null {
  if (!isObject(value)) {
    return null;
  }

  if (typeof value.deviceCode !== 'string' || typeof value.userCode !== 'string') {
    return null;
  }

  return {
    deviceCode: value.deviceCode,
    userCode: value.userCode,
    verifyUrl: normalizePlatformVerifyUrl(typeof value.verifyUrl === 'string' ? value.verifyUrl : ''),
    expiresAt: typeof value.expiresAt === 'string' ? value.expiresAt : new Date().toISOString(),
    intervalSeconds: typeof value.intervalSeconds === 'number' ? value.intervalSeconds : 5,
    startedAt: typeof value.startedAt === 'string' ? value.startedAt : new Date().toISOString(),
  };
}

function sanitizeInstance(value: unknown): (PlatformConnectionInstance & { instanceToken: string }) | null {
  if (!isObject(value) || typeof value.instanceToken !== 'string') {
    return null;
  }

  if (
    typeof value.instanceId !== 'string' ||
    typeof value.instanceKey !== 'string' ||
    typeof value.instanceName !== 'string' ||
    typeof value.platformAccountId !== 'string' ||
    typeof value.platformAccountEmail !== 'string' ||
    typeof value.platformAccountName !== 'string'
  ) {
    return null;
  }

  return {
    instanceId: value.instanceId,
    instanceKey: value.instanceKey,
    instanceName: value.instanceName,
    originUrl: typeof value.originUrl === 'string' ? value.originUrl : null,
    platformAccountId: value.platformAccountId,
    platformAccountEmail: value.platformAccountEmail,
    platformAccountName: value.platformAccountName,
    connectedAt: typeof value.connectedAt === 'string' ? value.connectedAt : new Date().toISOString(),
    instanceToken: value.instanceToken,
  };
}

function sanitizeTenantBinding(value: unknown): PlatformConnectionTenantBinding | null {
  if (!isObject(value)) {
    return null;
  }

  if (
    typeof value.tenantBindingId !== 'string' ||
    typeof value.localStoreId !== 'string' ||
    typeof value.localStoreSlug !== 'string' ||
    typeof value.localStoreName !== 'string' ||
    typeof value.platformProfileId !== 'string'
  ) {
    return null;
  }

  return {
    tenantBindingId: value.tenantBindingId,
    localStoreId: value.localStoreId,
    localStoreSlug: value.localStoreSlug,
    localStoreName: value.localStoreName,
    platformProfileId: value.platformProfileId,
    platformProfileType: 'merchant',
    boundAt: typeof value.boundAt === 'string' ? value.boundAt : new Date().toISOString(),
  };
}

function normalizeState(value: unknown): StoredPlatformConnectionState {
  if (!isObject(value)) {
    return {};
  }

  return {
    instanceKey: typeof value.instanceKey === 'string' ? value.instanceKey : undefined,
    pending: sanitizePending(value.pending),
    instance: sanitizeInstance(value.instance),
    tenantBinding: sanitizeTenantBinding(value.tenantBinding),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
  };
}

function toPublicStatus(state: StoredPlatformConnectionState): PlatformConnectionStatus {
  const instanceBound = Boolean(state.instance);
  const tenantBound = Boolean(state.tenantBinding);
  const pending = sanitizePending(state.pending);

  return {
    status: tenantBound
      ? 'tenant_bound'
      : instanceBound
        ? 'instance_bound'
        : pending
          ? 'pending'
          : 'unbound',
    instanceBound,
    tenantBound,
    marketplaceReady: tenantBound,
    requiresPlatformBinding: true,
    instance: state.instance
      ? {
          instanceId: state.instance.instanceId,
          instanceKey: state.instance.instanceKey,
          instanceName: state.instance.instanceName,
          originUrl: state.instance.originUrl ?? null,
          platformAccountId: state.instance.platformAccountId,
          platformAccountEmail: state.instance.platformAccountEmail,
          platformAccountName: state.instance.platformAccountName,
          connectedAt: state.instance.connectedAt,
        }
      : null,
    tenantBinding: state.tenantBinding || null,
    pending,
  };
}

function isLaunchReadyBootstrapEnabled(): boolean {
  return OFFICIAL_EXTENSIONS_BOOTSTRAP_MODE === 'launch-ready';
}

export class PlatformConnectionStateError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export class PlatformConnectionService {
  private bootstrapPromise: Promise<StoredPlatformConnectionState> | null = null;

  private async loadState(): Promise<StoredPlatformConnectionState> {
    return normalizeState(await systemSettingsService.getSetting(PLATFORM_CONNECTION_SETTINGS_KEY));
  }

  private async saveState(state: StoredPlatformConnectionState): Promise<void> {
    const normalizedState = normalizeState(state);
    await systemSettingsService.setSetting(PLATFORM_CONNECTION_SETTINGS_KEY, {
      ...normalizedState,
      updatedAt: new Date().toISOString(),
    });
  }

  private async ensureInstanceKey(state?: StoredPlatformConnectionState): Promise<StoredPlatformConnectionState> {
    const current = state ?? await this.loadState();
    if (current.instanceKey) {
      return current;
    }

    const nextState: StoredPlatformConnectionState = {
      ...current,
      instanceKey: crypto.randomUUID(),
    };
    await this.saveState(nextState);
    return nextState;
  }

  async getStatus(): Promise<PlatformConnectionStatus> {
    return toPublicStatus(await this.ensureLaunchReadyBinding());
  }

  async getMarketplaceBindingContext(): Promise<{
    status: PlatformConnectionStatus;
    context: {
      instanceId: string;
      instanceToken: string;
      platformAccountId: string;
      tenantBindingId: string;
      localStoreId: string;
    } | null;
  }> {
    const state = await this.ensureLaunchReadyBinding();
    if (!state.instance || !state.tenantBinding) {
      return {
        status: toPublicStatus(state),
        context: null,
      };
    }

    return {
      status: toPublicStatus(state),
      context: {
        instanceId: state.instance.instanceId,
        instanceToken: state.instance.instanceToken,
        platformAccountId: state.instance.platformAccountId,
        tenantBindingId: state.tenantBinding.tenantBindingId,
        localStoreId: state.tenantBinding.localStoreId,
      },
    };
  }

  private async ensureLaunchReadyBinding(): Promise<StoredPlatformConnectionState> {
    const state = await this.loadState();
    if (!isLaunchReadyBootstrapEnabled() || state.tenantBinding) {
      return state;
    }

    if (!this.bootstrapPromise) {
      this.bootstrapPromise = this.bootstrapLaunchReadyBinding(state).finally(() => {
        this.bootstrapPromise = null;
      });
    }

    return this.bootstrapPromise;
  }

  private async bootstrapLaunchReadyBinding(initialState?: StoredPlatformConnectionState): Promise<StoredPlatformConnectionState> {
    let state = await this.ensureInstanceKey(initialState);

    if (!state.instance) {
      const siteName = await systemSettingsService.getString('site.name', 'Jiffoo Self-Hosted');
      const originUrl = process.env.NEXT_PUBLIC_ADMIN_URL || process.env.NEXT_PUBLIC_SHOP_URL || null;
      const startStatus = await this.start({
        instanceName: siteName,
        originUrl: originUrl || undefined,
        coreVersion: process.env.npm_package_version || '1.0.0',
      });

      if (!startStatus.pending?.deviceCode) {
        throw new PlatformConnectionStateError(
          'PLATFORM_CONNECTION_BOOTSTRAP_FAILED',
          'Launch-ready bootstrap could not acquire a device code',
        );
      }

      await this.complete({
        deviceCode: startStatus.pending.deviceCode,
        accountEmail: DEFAULT_PLATFORM_BOOTSTRAP_ACCOUNT_EMAIL,
        accountName: DEFAULT_PLATFORM_BOOTSTRAP_ACCOUNT_NAME,
      });
      state = await this.loadState();
    }

    if (state.instance && !state.tenantBinding) {
      await this.bindDefaultStore();
      state = await this.loadState();
    }

    return state;
  }

  async start(input: Omit<PlatformConnectionStartRequest, 'instanceKey'>): Promise<PlatformConnectionStatus> {
    const state = await this.ensureInstanceKey();
    const siteName = await systemSettingsService.getString('site.name', 'Jiffoo Self-Hosted');
    const result = await MarketClient.startPlatformConnection({
      instanceKey: state.instanceKey!,
      instanceName: input.instanceName || siteName,
      originUrl: input.originUrl,
      coreVersion: input.coreVersion || process.env.npm_package_version || '1.0.0',
    });

    const nextState: StoredPlatformConnectionState = {
      ...state,
      pending: result.pending,
      tenantBinding: state.tenantBinding ?? null,
    };

    await this.saveState(nextState);
    return toPublicStatus(nextState);
  }

  async poll(input: PlatformConnectionPollRequest): Promise<PlatformConnectionStatus> {
    const state = await this.ensureInstanceKey();
    const result = await MarketClient.pollPlatformConnection(input);

    const nextState: StoredPlatformConnectionState = {
      ...state,
      pending: result.authorized ? null : result.status.pending || state.pending || null,
      instance: result.authorized && result.status.instance && result.instanceToken
        ? {
            ...result.status.instance,
            instanceToken: result.instanceToken,
          }
        : state.instance ?? null,
      tenantBinding: result.status.tenantBinding || state.tenantBinding || null,
    };

    await this.saveState(nextState);
    return toPublicStatus(nextState);
  }

  async complete(input: PlatformConnectionCompleteRequest): Promise<PlatformConnectionStatus> {
    const state = await this.ensureInstanceKey();
    const result = await MarketClient.completePlatformConnection(input);
    if (!result.authorized || !result.status.instance || !result.instanceToken) {
      throw new PlatformConnectionStateError(
        'PLATFORM_CONNECTION_NOT_AUTHORIZED',
        'Platform account authorization is still pending',
        { status: result.status },
      );
    }

    const nextState: StoredPlatformConnectionState = {
      ...state,
      pending: null,
      instance: {
        ...result.status.instance,
        instanceToken: result.instanceToken,
      },
      tenantBinding: result.status.tenantBinding || null,
    };

    await this.saveState(nextState);
    return toPublicStatus(nextState);
  }

  async bindDefaultStore(): Promise<PlatformConnectionStatus> {
    const state = await this.loadState();
    if (!state.instance) {
      throw new PlatformConnectionStateError(
        'PLATFORM_INSTANCE_NOT_BOUND',
        'Connect this instance to Jiffoo Platform first',
      );
    }

    const store = await prisma.store.findFirst({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
      },
    });

    if (!store) {
      throw new PlatformConnectionStateError(
        'DEFAULT_STORE_NOT_FOUND',
        'Default store not found for tenant binding',
      );
    }

    const result = await MarketClient.bindPlatformTenant({
      instanceId: state.instance.instanceId,
      instanceToken: state.instance.instanceToken,
      localStoreId: store.id,
      localStoreSlug: store.slug,
      localStoreName: store.name,
    });

    const nextState: StoredPlatformConnectionState = {
      ...state,
      instance: state.instance,
      tenantBinding: result.status.tenantBinding || null,
    };
    await this.saveState(nextState);
    return toPublicStatus(nextState);
  }

  async disconnect(): Promise<PlatformConnectionStatus> {
    const state = await this.loadState();
    const nextState: StoredPlatformConnectionState = {
      instanceKey: state.instanceKey,
      pending: null,
      instance: null,
      tenantBinding: null,
    };
    await this.saveState(nextState);
    return toPublicStatus(nextState);
  }
}

export const platformConnectionService = new PlatformConnectionService();
