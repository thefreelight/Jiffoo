'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Languages, Loader2, RefreshCw, Upload } from 'lucide-react';
import { apiClient, unwrapApiResponse } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { usePluginSaveContribution } from '@/components/plugins/plugin-save-registry';
import {
  WorkspaceCard,
  WorkspaceField,
  WorkspaceNotice,
  workspaceInputClass,
  workspaceOutlineButtonClass,
  workspaceSelectTriggerClass,
} from '@/components/plugins/plugin-workspace-ui';
import { useWorkspaceText } from '@/components/plugins/use-workspace-text';

type NamespaceSummary = {
  namespace: string;
  total: number;
  locales: Record<string, number>;
};

type LocalizationState = {
  availableLocales: Array<{ code: string; name: string }>;
};

type Entries = Record<string, string>;

const BASE = '/extensions/plugin/i18n/api';
/** Rows shown before "Show more"; a theme namespace carries several hundred strings. */
const PAGE_SIZE = 100;
const DEFAULT_NAMESPACE = 'theme.esim';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * UI text translations kept by the Store Localization plugin. Themes ship
 * built-in copy; the rows edited here override it, keyed by the theme's
 * English source string under a `theme.<slug>` namespace. An emptied value
 * removes the override, so the built-in copy takes over again. Edited rows are
 * persisted by the page-level Save button.
 */
export function I18nTranslationsPanel({ installationId, disabled }: { installationId: string; disabled: boolean }) {
  const tf = useWorkspaceText();
  const [locales, setLocales] = useState<Array<{ code: string; name: string }>>([]);
  const [namespaces, setNamespaces] = useState<NamespaceSummary[]>([]);
  const [locale, setLocale] = useState('');
  const [namespace, setNamespace] = useState(DEFAULT_NAMESPACE);
  const [entries, setEntries] = useState<Entries>({});
  const [drafts, setDrafts] = useState<Entries>({});
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [importText, setImportText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const params = useMemo(() => ({ params: { installationId } }), [installationId]);

  const loadEntries = useCallback(async (targetLocale: string, targetNamespace: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.get(`${BASE}/ui/${encodeURIComponent(targetLocale)}/${encodeURIComponent(targetNamespace)}`, params);
      const next = (unwrapApiResponse<Entries>(response) || {}) as Entries;
      setEntries(next);
      setDrafts(next);
      setVisible(PAGE_SIZE);
      setLoadError(null);
    } catch (error) {
      setEntries({});
      setDrafts({});
      setLoadError(error instanceof Error ? error.message : tf('translations.loadFailed', 'Failed to load translations.'));
    } finally {
      setIsLoading(false);
    }
  }, [params, tf]);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    try {
      const [localizationResponse, namespacesResponse] = await Promise.all([
        apiClient.get(`${BASE}/localization`, params),
        apiClient.get(`${BASE}/ui`, params),
      ]);
      const nextLocales = (unwrapApiResponse<LocalizationState>(localizationResponse)?.availableLocales || []) as Array<{ code: string; name: string }>;
      const nextNamespaces = ((unwrapApiResponse<{ items: NamespaceSummary[] }>(namespacesResponse)?.items) || []) as NamespaceSummary[];
      setLocales(nextLocales);
      setNamespaces(nextNamespaces);
      const nextLocale = nextLocales[0]?.code || 'en';
      const known = nextNamespaces.some((entry) => entry.namespace === DEFAULT_NAMESPACE)
        ? DEFAULT_NAMESPACE
        : nextNamespaces[0]?.namespace || DEFAULT_NAMESPACE;
      setLocale(nextLocale);
      setNamespace(known);
      await loadEntries(nextLocale, known);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : tf('translations.loadOverviewFailed', 'Failed to load the translation overview.'));
      setIsLoading(false);
    }
  }, [loadEntries, params, tf]);

  useEffect(() => {
    if (disabled) {
      setLocales([]);
      setNamespaces([]);
      setEntries({});
      setDrafts({});
      setLoadError(null);
      setIsLoading(false);
      return;
    }
    void loadOverview();
  }, [disabled, loadOverview]);

  const dirtyKeys = useMemo(
    () => Object.keys(drafts).filter((key) => drafts[key] !== (entries[key] ?? '')),
    [drafts, entries],
  );
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return Object.keys(drafts)
      .filter((key) => !query || key.toLowerCase().includes(query) || drafts[key].toLowerCase().includes(query))
      .sort((a, b) => a.localeCompare(b));
  }, [drafts, search]);

  const save = async () => {
    if (dirtyKeys.length === 0) return;
    try {
      const payload = Object.fromEntries(dirtyKeys.map((key) => [key, drafts[key]]));
      const response = await apiClient.put(`${BASE}/ui/${encodeURIComponent(locale)}/${encodeURIComponent(namespace)}`, payload, params);
      const result = unwrapApiResponse<{ saved: number; removed: number }>(response);
      await loadEntries(locale, namespace);
      toast.success(tf('translations.saved', 'Saved {count} translations', { count: result?.saved ?? dirtyKeys.length }));
    } catch (error) {
      const message = error instanceof Error ? error.message : tf('translations.saveFailed', 'Failed to save translations.');
      setLoadError(message);
      toast.error(message);
      // Keep the section dirty so the edits can be retried from the page-level Save.
      throw error;
    }
  };

  usePluginSaveContribution('i18n-translations', !disabled && !isLoading && dirtyKeys.length > 0, save);

  const importJson = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setLoadError(tf('translations.importInvalidJson', 'The import is not valid JSON.'));
      return;
    }
    // Accept a bare `{ key: value }` object for the selected locale + namespace, or an export document.
    const body = isRecord(parsed) && isRecord(parsed.translations)
      ? parsed
      : { locale, namespace, entries: parsed };
    if (!isRecord(body) || !isRecord(body.entries)) {
      setLoadError(tf(
        'translations.importInvalidShape',
        'The import must be a `{ "key": "value" }` object or an exported document.',
      ));
      return;
    }

    setIsImporting(true);
    try {
      const response = await apiClient.post(`${BASE}/import/ui/json`, body, params);
      const result = unwrapApiResponse<{ imported: number; targets: number }>(response);
      setImportText('');
      await loadEntries(locale, namespace);
      toast.success(tf('translations.imported', 'Imported {count} translations', { count: result?.imported ?? 0 }));
    } catch (error) {
      const message = error instanceof Error ? error.message : tf('translations.importFailed', 'Failed to import translations.');
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  };

  const exportJson = async () => {
    try {
      const response = await apiClient.get(`${BASE}/export/ui/json`, { ...params, params: { ...params.params, locale, namespace } });
      const data = unwrapApiResponse<unknown>(response);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `i18n-${locale}-${namespace}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tf('translations.exportFailed', 'Failed to export translations.'));
    }
  };

  const namespaceCount = namespaces.find((entry) => entry.namespace === namespace)?.locales?.[locale];
  const busy = isLoading || isImporting;

  return (
    <WorkspaceCard
      icon={<Languages className="h-6 w-6" />}
      title={tf('translations.title', 'UI translations')}
      badge={
        <>
          <Badge variant="secondary" className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
            {tf('translations.strings', '{count} strings', { count: Object.keys(drafts).length })}
          </Badge>
          {dirtyKeys.length > 0 ? (
            <Badge className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 hover:bg-amber-50">
              {tf('translations.unsaved', '{count} unsaved', { count: dirtyKeys.length })}
            </Badge>
          ) : null}
        </>
      }
      description={tf(
        'translations.description',
        "Override the storefront's built-in copy per language. Keys are the theme's English source strings; clear a value to use the built-in translation again.",
      )}
      actions={
        <>
          <Button variant="outline" className={workspaceOutlineButtonClass} onClick={() => void loadOverview()} disabled={disabled || busy}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {tf('refresh', 'Refresh')}
          </Button>
          <Button variant="outline" className={workspaceOutlineButtonClass} onClick={() => void exportJson()} disabled={disabled || isLoading}>
            <Download className="mr-2 h-4 w-4" />
            {tf('translations.exportJson', 'Export JSON')}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          <WorkspaceField label={tf('translations.language', 'Language')} htmlFor="i18n-ui-locale">
            <Select
              value={locale}
              onValueChange={(next) => { setLocale(next); void loadEntries(next, namespace); }}
              disabled={disabled || isLoading || locales.length === 0}
            >
              <SelectTrigger id="i18n-ui-locale" className={workspaceSelectTriggerClass}>
                <SelectValue placeholder={tf('translations.selectLanguage', 'Select language')} />
              </SelectTrigger>
              <SelectContent>
                {locales.map((entry) => (
                  <SelectItem key={entry.code} value={entry.code}>
                    {entry.name} ({entry.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </WorkspaceField>
          <WorkspaceField label={tf('translations.namespace', 'Namespace')} htmlFor="i18n-ui-namespace">
            <Select
              value={namespace}
              onValueChange={(next) => { setNamespace(next); void loadEntries(locale, next); }}
              disabled={disabled || isLoading || namespaces.length === 0}
            >
              <SelectTrigger id="i18n-ui-namespace" className={workspaceSelectTriggerClass}>
                <SelectValue placeholder={tf('translations.selectNamespace', 'Select namespace')} />
              </SelectTrigger>
              <SelectContent>
                {(namespaces.length ? namespaces.map((entry) => entry.namespace) : [namespace]).map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </WorkspaceField>
          <WorkspaceField label={tf('translations.search', 'Search')} htmlFor="i18n-ui-search">
            <Input
              id="i18n-ui-search"
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setVisible(PAGE_SIZE); }}
              placeholder={tf('translations.searchPlaceholder', 'Filter by key or translation')}
              className={workspaceInputClass}
              disabled={disabled || isLoading}
            />
          </WorkspaceField>
        </div>

        <p className="text-sm leading-6 text-gray-500">
          {typeof namespaceCount === 'number'
            ? tf('translations.storedRows', '{count} rows stored for this language.', { count: namespaceCount })
            : tf('translations.noStoredRows', 'No rows stored for this language yet. Import a catalog or edit below.')}
        </p>

        {loadError ? <WorkspaceNotice tone="error">{loadError}</WorkspaceNotice> : null}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tf('loading', 'Loading...')}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-100">
            <div className="max-h-[32rem] divide-y divide-gray-100 overflow-y-auto">
              {rows.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-gray-500">
                  {search
                    ? tf('translations.noMatch', 'No strings match this search.')
                    : tf('translations.noRows', 'This namespace has no translations for this language yet. Import a catalog or edit below.')}
                </p>
              ) : (
                rows.slice(0, visible).map((key) => {
                  const overridden = key in entries;
                  const edited = drafts[key] !== (entries[key] ?? '');
                  return (
                    <div
                      key={key}
                      className={
                        edited
                          ? 'grid gap-3 bg-amber-50/40 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center'
                          : 'grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center'
                      }
                    >
                      <div className="min-w-0">
                        <p className="break-words font-mono text-xs leading-5 text-gray-600">{key}</p>
                        {!overridden ? <p className="mt-0.5 text-[11px] text-gray-400">{tf('translations.newKey', 'New key')}</p> : null}
                      </div>
                      <Input
                        value={drafts[key]}
                        onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))}
                        className={`${workspaceInputClass} h-10 bg-white`}
                        placeholder={tf('translations.placeholder', 'Leave empty to use the built-in translation')}
                        disabled={disabled || isImporting}
                      />
                      {edited ? (
                        <Badge variant="outline" className="w-fit justify-self-end border-amber-200 bg-amber-50 text-amber-700">
                          {tf('translations.edited', 'edited')}
                        </Badge>
                      ) : (
                        <span className="hidden md:block md:w-14" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
            {rows.length > visible ? (
              <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-lg text-gray-600 hover:text-gray-900"
                  onClick={() => setVisible((count) => count + PAGE_SIZE)}
                >
                  {tf('translations.showMore', 'Show more ({count} remaining)', { count: rows.length - visible })}
                </Button>
              </div>
            ) : null}
          </div>
        )}

        <div className="space-y-6 border-t border-gray-50 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              className={workspaceOutlineButtonClass}
              onClick={() => { setDrafts(entries); setVisible(PAGE_SIZE); }}
              disabled={disabled || busy || dirtyKeys.length === 0}
            >
              {tf('translations.discard', 'Discard edits')}
            </Button>
            {disabled ? (
              <p className="text-sm leading-6 text-gray-500">
                {tf('translations.disabledHint', 'Create or select a plugin instance to manage translations.')}
              </p>
            ) : null}
          </div>

          <WorkspaceField
            label={tf('translations.importLabel', 'Import JSON')}
            htmlFor="i18n-ui-import"
            hint={tf(
              'translations.importHint',
              'A bare object imports into the selected language and namespace; an exported document keeps its own languages.',
            )}
          >
            <Textarea
              id="i18n-ui-import"
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              rows={4}
              placeholder='{ "Sign in": "ログイン", "Password": "パスワード" }'
              className="rounded-xl border-gray-100 bg-white font-mono text-xs"
              disabled={disabled || busy}
            />
            <Button
              variant="outline"
              className={workspaceOutlineButtonClass}
              onClick={() => void importJson()}
              disabled={disabled || busy || importText.trim() === ''}
            >
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {tf(
                'translations.importButton',
                'Import into {locale} / {namespace}',
                { locale, namespace },
              )}
            </Button>
          </WorkspaceField>
        </div>
      </div>
    </WorkspaceCard>
  );
}
