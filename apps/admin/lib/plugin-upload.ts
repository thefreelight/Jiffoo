'use client';
import { apiClient, unwrapApiResponse } from './api';
import { ApiErrorCodes, isApiErrorCode, type ApiErrorCode } from 'shared';

export interface PluginUploadPreview {
  package: { slug: string; name: string; version: string; hash: string; trust: 'signed' | 'unsigned'; declaredCapabilities: string[];
    publisher: { publisherId: string; publisherName: string; signingRoot: 'official' | 'test' } | null };
  current: { version: string | null; hash: string | null; state: 'installed' | 'uninstalled' | 'not-installed' };
  operation: 'install' | 'upgrade' | 'unchanged';
  compatibility: { compatible: boolean; reason?: string };
  requiresUnsignedConfirmation: boolean; expiresAt: string; previewToken: string;
}
export const pluginUploadApi = {
  preview: async (file: File) => {
    const form = new FormData(); form.append('file', file);
    return unwrapApiResponse(await apiClient.post<PluginUploadPreview>('/extensions/plugin/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } }));
  },
  install: async (file: File, preview: PluginUploadPreview, confirmationSlug?: string) => {
    const form = new FormData(); form.append('previewToken', preview.previewToken);
    if (confirmationSlug !== undefined) { form.append('confirmUnsigned', 'true'); form.append('confirmationSlug', confirmationSlug); }
    form.append('file', file);
    return unwrapApiResponse(await apiClient.post<{ slug: string; version: string; warnings: string[] }>('/extensions/plugin/install', form, { headers: { 'Content-Type': 'multipart/form-data' } }));
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
  };
  if (isApiErrorCode(code) && keys[code]) return keys[code];
  if (code?.includes('SIGNATURE') || code?.includes('CERTIFICATE') || code === ApiErrorCodes.PACKAGE_CONTENT_MISMATCH) return 'signatureInvalid';
  return 'failed';
}
