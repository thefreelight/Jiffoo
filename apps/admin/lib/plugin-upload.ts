'use client';
import { apiClient, unwrapApiResponse } from './api';
import { ApiErrorCodes, isApiErrorCode, type ApiErrorCode } from 'shared';
import type { PluginMigrationDeclaration } from 'shared';

export interface PluginUploadPreview {
  package: { slug: string; name: string; version: string; hash: string; trust: 'signed' | 'unsigned'; declaredCapabilities: string[];
    publisher: { publisherId: string; publisherName: string; signingRoot: 'official' | 'test' } | null };
  current: { version: string | null; hash: string | null; state: 'installed' | 'uninstalled' | 'not-installed' };
  operation: 'install' | 'upgrade' | 'unchanged';
  compatibility: { compatible: boolean; reason?: string };
  requiresUnsignedConfirmation: boolean; expiresAt: string; previewToken: string;
  migrationPlan: { schemaName: string; provisionNamespace: boolean; changesDatabase: boolean; applied: PluginMigrationDeclaration[]; pending: PluginMigrationDeclaration[] };
}
export interface PluginUploadOperation {
  operationId: string; slug: string; version: string; phase: string; terminal: boolean; committedPrefix: number; recoveryState: string;
  result: { slug: string; version: string; warnings: string[] } | null; errorCode: string | null;
}
export async function waitPluginUploadOperation(operationId: string, progress?: (state: PluginUploadOperation) => void) {
  const deadline = Date.now() + 65 * 60_000;
  let cursor = '';
  while (Date.now() < deadline) {
    const state = unwrapApiResponse(await apiClient.get<PluginUploadOperation>(`/extensions/plugin/operations/${encodeURIComponent(operationId)}?wait=true${cursor}`));
    progress?.(state);
    if (state.terminal) {
      if (state.phase === 'SUCCESS' && state.result) return state.result;
      throw { code: state.errorCode ?? 'PLUGIN_MIGRATION_RECOVERY_REQUIRED', operationId, phase: state.phase };
    }
    cursor = `&phase=${encodeURIComponent(state.phase)}&committedPrefix=${state.committedPrefix}`;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw { code: 'PLUGIN_MIGRATION_OUTCOME_UNKNOWN', operationId };
}
export const pluginUploadApi = {
  preview: async (file: File) => {
    const form = new FormData(); form.append('file', file);
    return unwrapApiResponse(await apiClient.post<PluginUploadPreview>('/extensions/plugin/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } }));
  },
  install: async (file: File, preview: PluginUploadPreview, confirmationSlug?: string, progress?: (state: PluginUploadOperation) => void) => {
    const form = new FormData(); form.append('previewToken', preview.previewToken);
    if (confirmationSlug !== undefined) { form.append('confirmUnsigned', 'true'); form.append('confirmationSlug', confirmationSlug); }
    if (preview.migrationPlan.changesDatabase) form.append('confirmMigrations', 'true');
    form.append('file', file);
    const accepted = unwrapApiResponse(await apiClient.post<{ operationId: string }>('/extensions/plugin/install', form, { headers: { 'Content-Type': 'multipart/form-data' } }));
    return waitPluginUploadOperation(accepted.operationId, progress);
  },
  retry: async (operationId: string, progress?: (state: PluginUploadOperation) => void) => {
    const accepted = unwrapApiResponse(await apiClient.post<{ operationId: string }>(`/extensions/plugin/operations/${encodeURIComponent(operationId)}/retry`, { confirmMigrations: true }));
    return waitPluginUploadOperation(accepted.operationId, progress);
  },
};
export function pluginUploadErrorKey(error: unknown) {
  const code = (error as { code?: string })?.code;
  const keys: Partial<Record<ApiErrorCode, string>> = {
    UNKNOWN_MANIFEST_FIELD: 'unknownManifestField',
    PLUGIN_DOWNGRADE_NOT_SUPPORTED: 'downgrade', PLUGIN_VERSION_CONTENT_CHANGED: 'versionContentChanged',
    PUBLISHER_CHANGE_FORBIDDEN: 'publisherChanged', SIGNED_UPGRADE_REQUIRED: 'signatureRequired',
    PLUGIN_PREVIEW_REQUIRED: 'previewRequired', UNSIGNED_CONFIRMATION_REQUIRED: 'confirmationRequired',
    INCOMPATIBLE_API_VERSION: 'incompatible', PAYLOAD_TOO_LARGE: 'tooLarge',
    PLUGIN_OPERATION_IN_PROGRESS: 'busy', PLUGIN_OPERATION_LEASE_LOST: 'busy',
    PLUGIN_MIGRATION_MANIFEST_INVALID: 'migrationInvalid', PLUGIN_MIGRATION_LEGACY_FORMAT: 'migrationLegacy', PLUGIN_MIGRATION_DRIFT: 'migrationDrift',
    PLUGIN_MIGRATION_FAILED: 'migrationFailed', PLUGIN_MIGRATION_OUTCOME_UNKNOWN: 'migrationUnknown', PLUGIN_MIGRATION_RECOVERY_REQUIRED: 'needsRecovery',
    PLUGIN_MIGRATION_CONFIRMATION_REQUIRED: 'migrationConfirmation', PLUGIN_MAINTENANCE: 'migrationMaintenance',
  };
  if (isApiErrorCode(code) && keys[code]) return keys[code];
  if (code?.includes('SIGNATURE') || code?.includes('CERTIFICATE') || code === ApiErrorCodes.PACKAGE_CONTENT_MISMATCH) return 'signatureInvalid';
  return 'failed';
}
