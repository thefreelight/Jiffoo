export type PlatformConnectionState =
  | 'unbound'
  | 'pending'
  | 'instance_bound'
  | 'tenant_bound';

export interface PlatformConnectionPendingDevice {
  deviceCode: string;
  userCode: string;
  verifyUrl: string;
  expiresAt: string;
  intervalSeconds: number;
  startedAt: string;
}

export interface PlatformConnectionInstance {
  instanceId: string;
  instanceKey: string;
  instanceName: string;
  originUrl?: string | null;
  platformAccountId: string;
  platformAccountEmail: string;
  platformAccountName: string;
  connectedAt: string;
}

export interface PlatformConnectionTenantBinding {
  tenantBindingId: string;
  localStoreId: string;
  localStoreSlug: string;
  localStoreName: string;
  platformProfileId: string;
  platformProfileType: 'merchant';
  boundAt: string;
}

export interface PlatformConnectionStatus {
  status: PlatformConnectionState;
  instanceBound: boolean;
  tenantBound: boolean;
  marketplaceReady: boolean;
  requiresPlatformBinding: boolean;
  instance?: PlatformConnectionInstance | null;
  tenantBinding?: PlatformConnectionTenantBinding | null;
  pending?: PlatformConnectionPendingDevice | null;
}

export interface PlatformConnectionStartRequest {
  instanceKey: string;
  instanceName?: string;
  originUrl?: string;
  coreVersion?: string;
}

export interface PlatformConnectionStartResponse {
  pending: PlatformConnectionPendingDevice;
}

export interface PlatformConnectionPollRequest {
  deviceCode: string;
}

export interface PlatformConnectionPollResponse {
  authorized: boolean;
  status: PlatformConnectionStatus;
  instanceToken?: string | null;
}

export interface PlatformConnectionCompleteRequest {
  deviceCode: string;
  accountEmail: string;
  accountName?: string;
}

export interface PlatformConnectionBindTenantRequest {
  localStoreId: string;
  localStoreSlug: string;
  localStoreName: string;
}

export interface PlatformConnectionDisconnectResponse {
  disconnected: boolean;
}
