'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, RefreshCw, Save, Upload } from 'lucide-react';
import { apiClient, unwrapApiResponse } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

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
 * removes the override, so the built-in copy takes over again.
 */
export function I18nTranslationsPanel({ installationId, disabled }: { installationId: string; disabled: boolean }) {
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
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ tone: 'default' | 'error' | 'success'; text: string }>({
    tone: 'default',
    text: 'Loading translations...',
  });

  const params = useMemo(() => ({ params: { installationId } }), [installationId]);

  const loadEntries = useCallback(async (targetLocale: string, targetNamespace: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.get(`${BASE}/ui/${encodeURIComponent(targetLocale)}/${encodeURIComponent(targetNamespace)}`, params);
      const next = (unwrapApiResponse<Entries>(response) || {}) as Entries;
      setEntries(next);
      setDrafts(next);
      setVisible(PAGE_SIZE);
      setStatus({ tone: 'success', text: `${Object.keys(next).length} strings loaded for ${targetLocale} / ${targetNamespace}.` });
    } catch (error) {
      setEntries({});
      setDrafts({});
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : 'Failed to load translations.' });
    } finally {
      setIsLoading(false);
    }
  }, [params]);

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
      setStatus({ tone: 'error', text: error instanceof Error ? error.message : 'Failed to load the translation overview.' });
      setIsLoading(false);
    }
  }, [params, loadEntries]);

  useEffect(() => {
    if (disabled) {
      setLocales([]);
      setNamespaces([]);
      setEntries({});
      setDrafts({});
      setStatus({ tone: 'default', text: 'Create or select a plugin instance to manage translations.' });
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
    setIsSaving(true);
    try {
      const payload = Object.fromEntries(dirtyKeys.map((key) => [key, drafts[key]]));
      const response = await apiClient.put(`${BASE}/ui/${encodeURIComponent(locale)}/${encodeURIComponent(namespace)}`, payload, params);
      const result = unwrapApiResponse<{ saved: number; removed: number }>(response);
      await loadEntries(locale, namespace);
      toast.success(`Saved ${result?.saved ?? dirtyKeys.length} translations`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save translations.';
      setStatus({ tone: 'error', text: message });
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const importJson = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setStatus({ tone: 'error', text: 'The import is not valid JSON.' });
      return;
    }
    // Accept a bare `{ key: value }` object for the selected locale + namespace, or an export document.
    const body = isRecord(parsed) && isRecord(parsed.translations)
      ? parsed
      : { locale, namespace, entries: parsed };
    if (!isRecord(body) || !isRecord(body.entries)) {
      setStatus({ tone: 'error', text: 'The import must be a `{ "key": "value" }` object or an exported document.' });
      return;
    }
    setIsSaving(true);
    try {
      const response = await apiClient.post(`${BASE}/import/ui/json`, body, params);
      const result = unwrapApiResponse<{ imported: number; targets: number }>(response);
      setImportText('');
      await loadEntries(locale, namespace);
      toast.success(`Imported ${result?.imported ?? 0} translations`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import translations.';
      setStatus({ tone: 'error', text: message });
      toast.error(message);
    } finally {
      setIsSaving(false);
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
      toast.error(error instanceof Error ? error.message : 'Failed to export translations.');
    }
  };

  const namespaceCount = namespaces.find((entry) => entry.namespace === namespace)?.locales?.[locale];

  return (
    <Card className="rounded-lg border-gray-100 shadow-sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-xl tracking-tight">
          Translations
          <Badge variant="secondary" className="font-normal">
            {Object.keys(drafts).length} strings
          </Badge>
          {dirtyKeys.length > 0 ? <Badge variant="default">{dirtyKeys.length} unsaved</Badge> : null}
        </CardTitle>
        <CardDescription>
          Override the storefront&apos;s built-in copy per language. Keys are the theme&apos;s English source strings; empty a value to fall back
          to the built-in translation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_2fr]">
          <div className="space-y-2">
            <Label htmlFor="i18n-ui-locale">Language</Label>
            <Select
              value={locale}
              onValueChange={(next) => { setLocale(next); void loadEntries(next, namespace); }}
              disabled={disabled || isLoading || locales.length === 0}
            >
              <SelectTrigger id="i18n-ui-locale" className="rounded-lg">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {locales.map((entry) => (
                  <SelectItem key={entry.code} value={entry.code}>
                    {entry.name} ({entry.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="i18n-ui-namespace">Namespace</Label>
            <Select
              value={namespace}
              onValueChange={(next) => { setNamespace(next); void loadEntries(locale, next); }}
              disabled={disabled || isLoading || namespaces.length === 0}
            >
              <SelectTrigger id="i18n-ui-namespace" className="rounded-lg">
                <SelectValue placeholder="Select namespace" />
              </SelectTrigger>
              <SelectContent>
                {(namespaces.length ? namespaces.map((entry) => entry.namespace) : [namespace]).map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="i18n-ui-search">Search</Label>
            <Input
              id="i18n-ui-search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setVisible(PAGE_SIZE); }}
              placeholder="Filter by key or translation"
              className="rounded-lg"
              disabled={disabled || isLoading}
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <p className="font-medium text-slate-900">Status</p>
          <p className={status.tone === 'error' ? 'mt-1 text-red-600' : status.tone === 'success' ? 'mt-1 text-emerald-700' : 'mt-1 text-slate-600'}>
            {status.text}
            {typeof namespaceCount === 'number' ? ` ${namespaceCount} rows stored for this language.` : ' No rows stored for this language yet — import the theme catalog or edit below.'}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto">
              {rows.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">
                  {search ? 'No strings match this search.' : 'This namespace has no translations for this language yet. Import a catalog to start.'}
                </p>
              ) : (
                rows.slice(0, visible).map((key) => {
                  const overridden = key in entries;
                  const dirty = drafts[key] !== (entries[key] ?? '');
                  return (
                    <div key={key} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                      <div className="min-w-0">
                        <p className="break-words font-mono text-xs text-slate-600">{key}</p>
                        {!overridden ? <p className="mt-0.5 text-[11px] text-slate-400">New key</p> : null}
                      </div>
                      <Input
                        value={drafts[key]}
                        onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))}
                        className="rounded-lg"
                        placeholder="Leave empty to use the built-in translation"
                        disabled={disabled || isSaving}
                      />
                      {dirty ? <Badge variant="outline">edited</Badge> : <span className="hidden md:block w-14" />}
                    </div>
                  );
                })
              )}
            </div>
            {rows.length > visible ? (
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-2">
                <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
                  Show more ({rows.length - visible} remaining)
                </Button>
              </div>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void save()} disabled={disabled || isSaving || isLoading || dirtyKeys.length === 0} className="rounded-lg">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save changes
          </Button>
          <Button
            variant="outline"
            onClick={() => { setDrafts(entries); setVisible(PAGE_SIZE); }}
            disabled={disabled || isSaving || isLoading || dirtyKeys.length === 0}
            className="rounded-lg"
          >
            Discard edits
          </Button>
          <Button variant="outline" onClick={() => void loadOverview()} disabled={disabled || isSaving || isLoading} className="rounded-lg">
            <RefreshCw className="mr-2 h-4 w-4" />
            Reload
          </Button>
          <Button variant="outline" onClick={() => void exportJson()} disabled={disabled || isLoading} className="rounded-lg">
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="i18n-ui-import">Import JSON</Label>
          <Textarea
            id="i18n-ui-import"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            rows={4}
            placeholder={`{ "Sign in": "ログイン", "Password": "パスワード" }`}
            className="rounded-lg font-mono text-xs"
            disabled={disabled || isSaving || isLoading}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => void importJson()} disabled={disabled || isSaving || isLoading || importText.trim() === ''} className="rounded-lg">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Import into {locale} / {namespace}
            </Button>
            <p className="text-xs text-slate-500">A bare object imports into the selected language and namespace; an exported document keeps its own languages.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
