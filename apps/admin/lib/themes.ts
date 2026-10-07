import { apiClient, unwrapApiResponse } from './api';

export type Locale = 'en' | 'zh-Hans' | 'zh-Hant';
export type Localized = Record<Locale, string>;
export type ThemeSetting = {
  id: string; type: 'color' | 'text' | 'image' | 'category' | 'product-list' | 'boolean' | 'select' | 'number' | 'link';
  label: Localized; default: unknown;
  constraints: { maxLength?: number; maxItems?: number; options?: string[]; min?: number; max?: number; step?: number };
};
export type ThemeRecord = {
  slug: string; name: string; version: string; target: 'shop' | 'admin';
  packageHash: string;
  source: 'builtin' | 'uploaded'; trustLevel: string;
  manifestJson: { assets: Record<string, string>; settings: ThemeSetting[] };
};
export type HomeSection = { id: string; type: string; settings: Record<string, unknown> };
export type ThemeConfig = { settings: ThemeSetting[]; values: Record<string, unknown>; revision: number; homeSections?: HomeSection[] };
export type ThemeTarget = ThemeRecord['target'];

export const themesApi = {
  list: async () => unwrapApiResponse(await apiClient.get<ThemeRecord[]>('/extensions/theme')),
  active: async (target: ThemeTarget, locale: Locale) =>
    unwrapApiResponse(await apiClient.get<{ slug: string }>('/store/theme', { params: { target, locale } })),
  install: async (file: File, confirmUnsigned: boolean) => {
    const data = new FormData();
    data.append('confirmUnsigned', String(confirmUnsigned));
    data.append('file', file);
    return unwrapApiResponse(await apiClient.post<ThemeRecord>('/extensions/theme/install', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }));
  },
  activate: async (target: ThemeTarget, slug: string) =>
    unwrapApiResponse(await apiClient.post(`/extensions/themes/${target}/activate`, { slug })),
  restore: async (target: ThemeTarget) =>
    unwrapApiResponse(await apiClient.post(`/extensions/themes/${target}/restore-previous`, {})),
  uninstall: async (slug: string) =>
    unwrapApiResponse(await apiClient.delete(`/extensions/theme/${slug}`)),
  config: async (slug: string) =>
    unwrapApiResponse(await apiClient.get<ThemeConfig>(`/extensions/themes/${slug}/config`)),
  save: async (slug: string, values: Record<string, unknown>, expectedRevision: number,
    homeSections?: HomeSection[] | null) =>
    unwrapApiResponse(await apiClient.put<ThemeConfig>(`/extensions/themes/${slug}/config`, {
      values, expectedRevision, ...(homeSections === undefined ? {} : { homeSections }),
    })),
  restoreConfig: async (slug: string) =>
    unwrapApiResponse(await apiClient.post(`/extensions/themes/${slug}/config/restore-previous`, {})),
};
