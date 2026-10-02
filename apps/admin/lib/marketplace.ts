'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, unwrapApiResponse, type ApiResponse } from '@/lib/api';

export interface MarketplaceStatus { configured: boolean; testSigningMode: boolean }
export interface MarketplaceVersion {
  version: string; minApiVersion: string; compatible: boolean;
}
export interface MarketplaceEntry {
  id: string; slug: string; name: string; description: string; publisherId: string;
  declaredCapabilities?: string[]; versions: MarketplaceVersion[];
  installedVersion: string | null; updateAvailable: boolean;
}

export const marketplaceApi = {
  status: async () => unwrapApiResponse(await apiClient.get<MarketplaceStatus>('/extensions/marketplace/status')),
  catalog: async () => unwrapApiResponse(await apiClient.get<{ items: MarketplaceEntry[] }>('/extensions/marketplace/catalog')),
  install: async (pluginId: string, version: string) => {
    const response = await apiClient.post<{ slug: string; version: string }>(
      '/extensions/marketplace/install', { pluginId, version }, {
        transformResponse: [(data: string, _headers: unknown, status?: number) => ({ ...JSON.parse(data), httpStatus: status })],
      },
    ) as ApiResponse<{ slug: string; version: string }> & { httpStatus?: number };
    try { return unwrapApiResponse(response); }
    catch (error) { throw Object.assign(error as Error, { status: response.httpStatus }); }
  },
};

export function useMarketplaceStatus() {
  return useQuery({ queryKey: ['extensions', 'marketplace', 'status'], queryFn: marketplaceApi.status, staleTime: 60_000, retry: false });
}
export function useMarketplaceCatalog(configured: boolean) {
  return useQuery({ queryKey: ['extensions', 'marketplace', 'catalog'], queryFn: marketplaceApi.catalog, enabled: configured, retry: false });
}
export function useMarketplaceInstall() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ pluginId, version }: { pluginId: string; version: string }) => marketplaceApi.install(pluginId, version),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['extensions', 'marketplace', 'catalog'] }),
        client.invalidateQueries({ queryKey: ['plugins', 'installed'] }),
        client.invalidateQueries({ queryKey: ['plugins', 'config'] }),
      ]);
    },
  });
}

export function marketplaceErrorKey(error: unknown): string {
  const value = error as { code?: string; status?: number; statusCode?: number; response?: { status?: number; data?: { error?: { code?: string } } } } | null;
  const code = value?.response?.data?.error?.code ?? value?.code ?? '';
  const status = value?.response?.status ?? value?.status ?? value?.statusCode;
  if (code === 'PLUGIN_TEST_SIGNING_DISABLED') return 'testSigningDisabled';
  if (code === 'PLUGIN_REINSTALL_REQUIRED') return 'reinstallRequired';
  if (code === 'MARKETPLACE_PLUGIN_NOT_FOUND' || status === 404) return 'notFound';
  if (code.includes('CONFLICT') || code.includes('LEASE') || ['PLUGIN_OPERATION_IN_PROGRESS', 'PUBLISHER_CHANGE_FORBIDDEN', 'SIGNED_UPGRADE_REQUIRED'].includes(code) || status === 409) return 'conflict';
  if (code === 'PAYLOAD_TOO_LARGE' || code.includes('TOO_LARGE') || status === 413) return 'tooLarge';
  if (code === 'MARKETPLACE_NOT_CONFIGURED' || status === 503) return 'notConfigured';
  if (code.includes('TIMEOUT') || status === 504) return 'timeout';
  if (code.includes('UNAVAILABLE') || status === 502) return 'unavailable';
  if (code.includes('SIGNATURE') || code.includes('CERTIFICATE') || code.includes('DIGEST') || code.includes('IDENTITY') || code.includes('INCOMPATIBLE') || code.includes('ORIGIN_FORBIDDEN') || status === 422) return 'invalidPackage';
  return 'genericError';
}
