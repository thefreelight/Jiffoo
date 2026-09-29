import { apiClient, unwrapApiResponse } from './api';

export type CodeFields = {
  ga4MeasurementId: string | null;
  metaPixelId: string | null;
  baiduSiteKey: string | null;
  headCode: string;
  bodyStartCode: string;
  bodyEndCode: string;
};
export type CodeConfiguration = CodeFields & {
  enabled: boolean; revision: number; updatedById: string | null; updatedAt: string | null;
};
export type CodeRevision = CodeConfiguration & {
  id: string; createdById: string; createdAt: string; restoredFromRevision: number | null;
};
export type CodeHistory = {
  items: CodeRevision[]; page: number; limit: number; total: number; totalPages: number;
};
const path = '/admin/storefront-code';
export const storefrontCodeApi = {
  current: async () => unwrapApiResponse(await apiClient.get<CodeConfiguration>(path)),
  save: async (values: CodeFields, expectedRevision: number) =>
    unwrapApiResponse(await apiClient.put<CodeConfiguration>(path, { ...values, expectedRevision })),
  switch: async (enabled: boolean) =>
    unwrapApiResponse(await apiClient.post<CodeConfiguration>(`${path}/switch`, { enabled })),
  history: async (page: number) =>
    unwrapApiResponse(await apiClient.get<CodeHistory>(`${path}/revisions`, { params: { page, limit: 10 } })),
  revision: async (revision: number) =>
    unwrapApiResponse(await apiClient.get<CodeRevision>(`${path}/revisions/${revision}`)),
  restore: async (revision: number, expectedRevision: number) =>
    unwrapApiResponse(await apiClient.post<CodeConfiguration>(`${path}/restore`, { revision, expectedRevision })),
};
