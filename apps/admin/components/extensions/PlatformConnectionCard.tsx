'use client';

import { useMemo } from 'react';
import { AlertCircle, Link2, Loader2, PlugZap, RefreshCcw, ShieldCheck, Store } from 'lucide-react';
import {
  useBindPlatformTenant,
  useDisconnectPlatformConnection,
  usePlatformConnectionStatus,
  usePollPlatformConnection,
  useStartPlatformConnection,
} from '@/lib/hooks/use-api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PlatformConnectionCardProps {
  getText: (key: string, fallback: string) => string;
}

function resolveDefaultOrigin(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.location.origin;
}

function resolveDefaultInstanceName(): string {
  if (typeof window === 'undefined') {
    return 'Self-hosted workspace';
  }
  return window.location.host || 'Self-hosted workspace';
}

function renderStatusCopy(status: NonNullable<ReturnType<typeof usePlatformConnectionStatus>['data']>, getText: PlatformConnectionCardProps['getText']): string {
  switch (status.status) {
    case 'tenant_bound':
      return getText('merchant.extensions.platformReady', 'Marketplace ready. This instance and the default store are bound to Jiffoo Platform.');
    case 'instance_bound':
      return getText('merchant.extensions.platformTenantPending', 'The instance is connected. Bind the default store to unlock official installs.');
    case 'pending':
      return getText('merchant.extensions.platformPending', 'Connection is pending. Finish the sign-in step to continue.');
    default:
      return getText('merchant.extensions.platformUnbound', 'Connect this instance to Jiffoo Platform to install official themes and plugins.');
  }
}

function isPendingCodeExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) {
    return false;
  }

  const expiresAtTime = Date.parse(expiresAt);
  return Number.isFinite(expiresAtTime) && expiresAtTime <= Date.now();
}

function formatExpiryCopy(expiresAt?: string | null): string | null {
  if (!expiresAt) {
    return null;
  }

  const expiresAtTime = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtTime)) {
    return null;
  }

  const minutesRemaining = Math.max(0, Math.ceil((expiresAtTime - Date.now()) / 60_000));
  if (minutesRemaining <= 0) {
    return 'This code has expired. Click Connect again to get a new one.';
  }

  if (minutesRemaining === 1) {
    return 'This code expires in about 1 minute.';
  }

  return `This code expires in about ${minutesRemaining} minutes.`;
}

export function PlatformConnectionCard({ getText }: PlatformConnectionCardProps) {
  const { data: status, isLoading } = usePlatformConnectionStatus();
  const startMutation = useStartPlatformConnection();
  const pollMutation = usePollPlatformConnection();
  const bindTenantMutation = useBindPlatformTenant();
  const disconnectMutation = useDisconnectPlatformConnection();

  const pendingDevice = status?.pending;
  const pendingExpired = isPendingCodeExpired(pendingDevice?.expiresAt);
  const pendingExpiryCopy = formatExpiryCopy(pendingDevice?.expiresAt);
  const isBusy =
    startMutation.isPending ||
    pollMutation.isPending ||
    bindTenantMutation.isPending ||
    disconnectMutation.isPending;

  const canStart = !status || status.status === 'unbound';
  const canRefreshPending = status?.status === 'pending' && pendingDevice?.deviceCode;
  const canRestartPending = status?.status === 'pending';
  const canBindTenant = status?.instanceBound && !status?.tenantBound;

  const tone = useMemo(() => {
    if (status?.tenantBound) {
      return 'border-emerald-200 bg-emerald-50/70';
    }
    if (status?.instanceBound) {
      return 'border-blue-200 bg-blue-50/70';
    }
    if (status?.status === 'pending') {
      return 'border-amber-200 bg-amber-50/70';
    }
    return 'border-slate-200 bg-white';
  }, [status]);

  const statusBadge = status?.tenantBound
    ? { tone: 'border-emerald-200 bg-white text-emerald-700', label: getText('merchant.extensions.platformConnected', 'Connected') }
    : status?.instanceBound
      ? { tone: 'border-blue-200 bg-white text-blue-700', label: getText('merchant.extensions.platformInstanceBound', 'Instance linked') }
      : status?.status === 'pending'
        ? { tone: 'border-amber-200 bg-white text-amber-700', label: getText('merchant.extensions.platformPending', 'Pending') }
        : { tone: 'border-slate-200 bg-slate-50 text-slate-600', label: getText('merchant.extensions.platformUnboundShort', 'Not connected') };

  if (isLoading) {
    return (
      <div className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {getText('merchant.extensions.loadingPlatformConnection', 'Loading platform connection...')}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-[1.5rem] border px-4 py-4 shadow-sm', tone)}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/10">
              <PlugZap className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  {getText('merchant.extensions.platformConnection', 'Platform connection')}
                </p>
                <Badge variant="outline" className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', statusBadge.tone)}>
                  {statusBadge.label}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {status ? renderStatusCopy(status, getText) : getText('merchant.extensions.platformConnectionDescription', 'Use your Jiffoo Platform account to access the official marketplace and settlement features.')}
              </p>
            </div>
          </div>

          {status?.instanceBound ? (
            <div className="flex flex-wrap gap-2 pl-[3.25rem]">
              {status.instance ? (
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/80 bg-white/90 px-3 py-1.5 text-xs text-slate-600 shadow-sm">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-900">
                    {status.instance.platformAccountName || getText('merchant.extensions.platformAccountFallback', 'Platform owner')}
                  </span>
                  <span className="truncate text-slate-500">{status.instance.platformAccountEmail}</span>
                </div>
              ) : null}

              {status.tenantBinding ? (
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/80 bg-white/90 px-3 py-1.5 text-xs text-slate-600 shadow-sm">
                  <Store className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-900">
                    {status.tenantBinding.localStoreName || getText('merchant.extensions.defaultStore', 'Default store')}
                  </span>
                  <span className="truncate text-slate-500">
                    {status.tenantBinding.localStoreId || getText('merchant.extensions.boundStoreFallback', 'Store linked')}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3 lg:justify-end">
          {canStart ? (
            <Button
              onClick={() =>
                startMutation.mutate({
                  instanceName: resolveDefaultInstanceName(),
                  originUrl: resolveDefaultOrigin(),
                })
              }
              disabled={isBusy}
              className="rounded-xl"
            >
              {startMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              {getText('merchant.extensions.connectPlatform', 'Connect')}
            </Button>
          ) : null}

          {canRefreshPending ? (
            <Button
              variant="outline"
              onClick={() => pollMutation.mutate({ deviceCode: pendingDevice!.deviceCode })}
              disabled={isBusy}
              className="rounded-xl"
            >
              {pollMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              {getText('common.actions.refresh', 'Refresh')}
            </Button>
          ) : null}

          {canRestartPending ? (
            <Button
              variant="outline"
              onClick={() =>
                startMutation.mutate({
                  instanceName: resolveDefaultInstanceName(),
                  originUrl: resolveDefaultOrigin(),
                })
              }
              disabled={isBusy}
              className="rounded-xl"
            >
              {startMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              {getText('merchant.extensions.restartPlatformConnection', 'Get new code')}
            </Button>
          ) : null}

          {canBindTenant ? (
            <Button
              variant="outline"
              onClick={() => bindTenantMutation.mutate()}
              disabled={isBusy}
              className="rounded-xl"
            >
              {bindTenantMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Store className="mr-2 h-4 w-4" />}
              {getText('merchant.extensions.bindDefaultStore', 'Bind store')}
            </Button>
          ) : null}

          {status?.instanceBound ? (
            <Button
              variant="ghost"
              onClick={() => disconnectMutation.mutate()}
              disabled={isBusy}
              className="rounded-xl text-slate-600"
            >
              {disconnectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {getText('merchant.extensions.disconnectPlatform', 'Disconnect')}
            </Button>
          ) : null}
        </div>
      </div>

      {status?.status === 'pending' ? (
        <Alert className="mt-4 rounded-2xl border-amber-200 bg-white/90 text-amber-900">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{getText('merchant.extensions.platformDeviceCode', 'Finish the sign-in flow')}</AlertTitle>
          <AlertDescription className="space-y-4">
            <p>
              {getText('merchant.extensions.platformDeviceCodeDescription', 'Open the secure platform page below. The code is already filled in there, so you only need to confirm which platform account should own this instance.')}
            </p>
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 font-mono text-lg tracking-[0.25em] text-amber-900">
              {status.pending?.userCode}
            </div>
            {pendingExpiryCopy ? (
              <p className={cn('text-xs', pendingExpired ? 'font-medium text-amber-800' : 'text-slate-500')}>
                {pendingExpiryCopy}
              </p>
            ) : null}
            {status.pending?.verifyUrl ? (
              <div className="space-y-2">
                <a
                  href={status.pending.verifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 underline-offset-4 hover:underline"
                >
                  <Link2 className="h-4 w-4" />
                  {getText('merchant.extensions.openPlatformConnect', 'Open platform connect page')}
                </a>
                <p className="text-xs text-slate-500 break-all">{status.pending.verifyUrl}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {getText('merchant.extensions.platformVerifyUrlMissing', 'The platform verification page is not available yet. Keep this code and try again later.')}
              </p>
            )}
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {getText('merchant.extensions.platformPendingNextStep', 'After the platform page confirms the account, return here and click Refresh. Jiffoo will detect the finished authorization automatically.')}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {!status || status.status === 'unbound' ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {getText(
            'merchant.extensions.platformConnectionHint',
            'Connect once, keep your official marketplace access in sync, and continue installing themes or plugins without leaving Merchant Admin.'
          )}
        </div>
      ) : null}
    </div>
  );
}
