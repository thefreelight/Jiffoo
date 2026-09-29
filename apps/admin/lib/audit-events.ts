import { apiClient, unwrapApiResponse } from './api';

export type AuditActor = { id: string; email: string; username: string; isActive: boolean };
export type AuditEvent = {
  id: string; createdAt: string; action: string; targetType: string; targetId: string;
  summary: unknown; actor: AuditActor | null;
};
export type AuditFilters = { actions: string[]; targetTypes: string[]; actors: AuditActor[] };
export type AuditQuery = { actorId?: string; action?: string; targetType?: string; from?: string; to?: string };
export type AuditPage = { items: AuditEvent[]; page: number; limit: number; total: number; totalPages: number };

export const auditEventsApi = {
  list: async (page: number, query: AuditQuery) =>
    unwrapApiResponse(await apiClient.get<AuditPage>('/admin/audit-events', { params: { ...query, page, limit: 20 } })),
  filters: async () => unwrapApiResponse(await apiClient.get<AuditFilters>('/admin/audit-events/filters')),
};

export function summaryText(summary: unknown, emptyLabel: string): string {
  if (summary === null || summary === undefined || summary === '' ||
    (typeof summary === 'object' && Object.keys(summary).length === 0)) return emptyLabel;
  return JSON.stringify(summary, null, 2);
}

export const auditActionKeys: Record<string, string> = {
  'theme.install': 'themeInstall', 'theme.uninstall': 'themeUninstall',
  'theme.activate': 'themeActivate', 'theme.restore_previous': 'themeRestorePrevious',
  'theme.config.update': 'themeConfigUpdate', 'theme.config.restore': 'themeConfigRestore',
  'theme.config.migrated': 'themeConfigMigrated',
  'storefront-code.save': 'storefrontCodeSave', 'storefront-code.switch': 'storefrontCodeSwitch',
  'storefront-code.restore': 'storefrontCodeRestore',
};
