'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck, Workflow } from 'lucide-react';
import { useLocale, useT } from 'shared/src/i18n/react';
import { apiClient, unwrapApiResponse } from '@/lib/api';
import type { PluginInstance } from '@/lib/api';
import type { PluginConfigMeta } from '@/lib/types';
import {
  useCreatePluginInstance,
  useInstalledPlugins,
  useOfficialCatalog,
  usePluginConfig,
  usePluginInstances,
  useUpdatePluginInstance,
} from '@/lib/hooks/use-api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { InstalledPluginsRail } from '@/components/extensions/InstalledPluginsRail';
import { OfficialBadge } from '@/components/extensions/ExtensionVisuals';
import { PluginInstanceManager } from '@/components/plugins/PluginInstanceManager';
import { toast } from 'sonner';

type PluginConfigDescriptor = {
  type?: string;
  label?: string;
  description?: string;
  required?: boolean;
  enum?: string[];
};

type PluginConfigSchema = Record<string, PluginConfigDescriptor>;

type PluginConfigReadiness = {
  configRequired: boolean;
  configReady: boolean;
  missingConfigFields: string[];
};

type OdooConfig = {
  mode?: 'test' | 'production';
  test?: {
    channelId?: string;
    authSecret?: string;
  };
  production?: {
    channelId?: string;
    authSecret?: string;
  };
};

type I18nLocalizationState = {
  availableLocales: Array<{ code: string; name: string }>;
  store: {
    defaultLocale?: string;
    supportedLocales?: string[];
  };
};

type OdooHealthPayload = {
  status?: string;
  plugin?: string;
  version?: string;
  timestamp?: string;
};

type OdooJobPayload = {
  jobId: string;
  status?: string;
  progressDone?: number | null;
  progressTotal?: number | null;
  productType?: string | null;
  lastError?: string | null;
};

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getDescriptorType(descriptor: PluginConfigDescriptor | undefined): string {
  return typeof descriptor?.type === 'string' ? descriptor.type : 'string';
}

function getConfigFieldLabel(field: string, descriptor: PluginConfigDescriptor | undefined): string {
  return descriptor?.label || field;
}

function buildJsonFieldDrafts(
  schema: PluginConfigSchema | undefined,
  config: Record<string, unknown>
): Record<string, string> {
  if (!schema) return {};

  return Object.fromEntries(
    Object.entries(schema)
      .filter(([, descriptor]) => {
        const type = getDescriptorType(descriptor);
        return type === 'object' || type === 'array';
      })
      .map(([key, descriptor]) => {
        const type = getDescriptorType(descriptor);
        const fallback = type === 'array' ? [] : {};
        return [key, JSON.stringify(config[key] ?? fallback, null, 2)];
      })
  );
}

function evaluateConfigReadiness(
  configSchema: PluginConfigSchema | undefined,
  config: Record<string, unknown>,
  configMeta?: PluginConfigMeta
): PluginConfigReadiness {
  if (!configSchema || Object.keys(configSchema).length === 0) {
    return {
      configRequired: false,
      configReady: true,
      missingConfigFields: [],
    };
  }

  const missingConfigFields: string[] = [];
  let configRequired = false;

  for (const [key, descriptor] of Object.entries(configSchema)) {
    if (!descriptor?.required) {
      continue;
    }

    configRequired = true;
    const value = config[key];
    const type = getDescriptorType(descriptor);
    const secretConfigured = Boolean(configMeta?.secretFields?.[key]?.configured);

    if (value === undefined || value === null) {
      if (type === 'secret' && secretConfigured) {
        continue;
      }
      missingConfigFields.push(key);
      continue;
    }

    if (type === 'string' && (typeof value !== 'string' || value.trim().length === 0)) {
      missingConfigFields.push(key);
      continue;
    }

    if (type === 'secret' && ((typeof value !== 'string' || value.trim().length === 0) && !secretConfigured)) {
      missingConfigFields.push(key);
      continue;
    }

    if (type === 'object' && (!isPlainObject(value) || Object.keys(value).length === 0)) {
      missingConfigFields.push(key);
      continue;
    }

    if (type === 'array' && (!Array.isArray(value) || value.length === 0)) {
      missingConfigFields.push(key);
      continue;
    }
  }

  return {
    configRequired,
    configReady: !configRequired || missingConfigFields.length === 0,
    missingConfigFields,
  };
}

function formatDate(value?: string): string {
  if (!value) return 'n/a';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function buildOdooConfig(input: {
  mode: 'test' | 'production';
  testChannelId: string;
  testAuthSecret: string;
  productionChannelId: string;
  productionAuthSecret: string;
}): OdooConfig {
  const test = {
    ...(input.testChannelId.trim() ? { channelId: input.testChannelId.trim() } : {}),
    ...(input.testAuthSecret.trim() ? { authSecret: input.testAuthSecret.trim() } : {}),
  };
  const production = {
    ...(input.productionChannelId.trim() ? { channelId: input.productionChannelId.trim() } : {}),
    ...(input.productionAuthSecret.trim() ? { authSecret: input.productionAuthSecret.trim() } : {}),
  };

  return {
    mode: input.mode,
    test,
    production,
  };
}

function GenericConfigEditor(props: {
  configSchema: PluginConfigSchema;
  configDraft: Record<string, unknown>;
  configMeta?: PluginConfigMeta;
  jsonFieldDrafts: Record<string, string>;
  jsonFieldErrors: Record<string, string>;
  onUpdateField: (field: string, value: unknown) => void;
  onUpdateJsonField: (field: string, rawValue: string, expectedType: 'object' | 'array') => void;
  onSave: () => void;
  saving: boolean;
}) {
  const {
    configSchema,
    configDraft,
    configMeta,
    jsonFieldDrafts,
    jsonFieldErrors,
    onUpdateField,
    onUpdateJsonField,
    onSave,
    saving,
  } = props;

  return (
    <Card className="rounded-[1.75rem] border-gray-100 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl tracking-tight">Configuration</CardTitle>
        <CardDescription>
          Update plugin settings from a native Merchant Admin form. iframe-based plugin pages are no longer used here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {Object.entries(configSchema).map(([field, descriptor]) => {
          const type = getDescriptorType(descriptor);
          const label = getConfigFieldLabel(field, descriptor);
          const description = descriptor?.description;
          const required = Boolean(descriptor?.required);
          const value = configDraft[field];
          const secretConfigured = Boolean(configMeta?.secretFields?.[field]?.configured);

          if (Array.isArray(descriptor?.enum) && descriptor.enum.length > 0) {
            const normalizedValue =
              typeof value === 'string' && descriptor.enum.includes(value)
                ? value
                : descriptor.enum[0];

            return (
              <div key={field} className="space-y-2">
                <Label>
                  {label}
                  {required ? ' *' : ''}
                </Label>
                <Select value={normalizedValue} onValueChange={(nextValue) => onUpdateField(field, nextValue)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={label} />
                  </SelectTrigger>
                  <SelectContent>
                    {descriptor.enum.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
              </div>
            );
          }

          if (type === 'boolean') {
            return (
              <div key={field} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                <div className="space-y-1 pr-4">
                  <Label className="text-sm font-medium">
                    {label}
                    {required ? ' *' : ''}
                  </Label>
                  {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
                </div>
                <Switch checked={Boolean(value)} onCheckedChange={(checked) => onUpdateField(field, checked)} />
              </div>
            );
          }

          if (type === 'object' || type === 'array') {
            const error = jsonFieldErrors[field];

            return (
              <div key={field} className="space-y-2">
                <Label>
                  {label}
                  {required ? ' *' : ''}
                </Label>
                <Textarea
                  value={jsonFieldDrafts[field] ?? JSON.stringify(value ?? (type === 'array' ? [] : {}), null, 2)}
                  onChange={(event) => onUpdateJsonField(field, event.target.value, type)}
                  className="min-h-[180px] rounded-2xl font-mono"
                />
                {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
                {error ? <p className="text-xs text-red-600">{error}</p> : null}
              </div>
            );
          }

          if (type === 'number' || type === 'integer') {
            return (
              <div key={field} className="space-y-2">
                <Label>
                  {label}
                  {required ? ' *' : ''}
                </Label>
                  <Input
                    type="number"
                    value={typeof value === 'number' || value === '' ? value : ''}
                    onChange={(event) =>
                      onUpdateField(field, event.target.value === '' ? '' : Number(event.target.value))
                    }
                    className="rounded-xl"
                  />
                {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
              </div>
            );
          }

          const inputType = type === 'secret' ? 'password' : 'text';

          return (
            <div key={field} className="space-y-2">
              <Label>
                {label}
                {required ? ' *' : ''}
              </Label>
              <Input
                type={inputType}
                value={value == null ? '' : String(value)}
                onChange={(event) => onUpdateField(field, event.target.value)}
                placeholder={
                  type === 'secret' && secretConfigured
                    ? 'Stored securely. Leave blank to keep the current value.'
                    : undefined
                }
                className="rounded-xl"
              />
              {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
              {type === 'secret' && secretConfigured ? (
                <p className="text-xs text-muted-foreground">
                  A secure value is already stored. Enter a new value only if you want to replace it.
                </p>
              ) : null}
            </div>
          );
        })}

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={saving} className="rounded-xl">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function I18nNativeWorkspace(props: {
  installationId: string;
  disabled: boolean;
}) {
  const { installationId, disabled } = props;
  const [state, setState] = useState<I18nLocalizationState | null>(null);
  const [defaultLocale, setDefaultLocale] = useState('');
  const [supportedLocales, setSupportedLocales] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState('Loading storefront localization...');
  const [statusTone, setStatusTone] = useState<'default' | 'error' | 'success'>('default');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadLocalizationState = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage('Loading storefront localization...');
    setStatusTone('default');

    try {
      const response = await apiClient.get('/extensions/plugin/i18n/api/localization', {
        params: { installationId },
      });
      const data = unwrapApiResponse<I18nLocalizationState>(response);
      const nextDefaultLocale = data.store.defaultLocale || data.availableLocales[0]?.code || '';
      const nextSupportedLocales = Array.isArray(data.store.supportedLocales)
        ? data.store.supportedLocales
        : nextDefaultLocale
          ? [nextDefaultLocale]
          : [];

      setState(data);
      setDefaultLocale(nextDefaultLocale);
      setSupportedLocales(nextSupportedLocales);
      setStatusMessage('Localization settings loaded.');
      setStatusTone('success');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to load storefront localization.');
      setStatusTone('error');
    } finally {
      setIsLoading(false);
    }
  }, [installationId]);

  useEffect(() => {
    if (disabled) {
      setState(null);
      setStatusMessage('Create or select a plugin instance to manage storefront localization.');
      setStatusTone('default');
      setIsLoading(false);
      return;
    }

    void loadLocalizationState();
  }, [disabled, loadLocalizationState]);

  const toggleLocale = (code: string, enabled: boolean) => {
    setSupportedLocales((current) => {
      if (enabled) {
        return current.includes(code) ? current : [...current, code];
      }

      if (code === defaultLocale) {
        return current;
      }

      return current.filter((entry) => entry !== code);
    });
  };

  const saveLocalization = async () => {
    if (!defaultLocale) {
      toast.error('Choose a default locale before saving.');
      return;
    }

    setIsSaving(true);
    setStatusMessage('Saving storefront localization...');
    setStatusTone('default');

    try {
      const nextSupportedLocales = supportedLocales.includes(defaultLocale)
        ? supportedLocales
        : [...supportedLocales, defaultLocale];
      const response = await apiClient.put('/extensions/plugin/i18n/api/localization', {
        defaultLocale,
        supportedLocales: nextSupportedLocales,
      }, {
        params: { installationId },
      });
      unwrapApiResponse(response);
      setSupportedLocales(nextSupportedLocales);
      setStatusMessage('Localization updated successfully.');
      setStatusTone('success');
      toast.success('Localization updated successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update storefront localization.';
      setStatusMessage(message);
      setStatusTone('error');
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="rounded-[1.75rem] border-gray-100 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl tracking-tight">Localization workspace</CardTitle>
        <CardDescription>
          Manage storefront default language and shopper-visible locales directly inside Merchant Admin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="i18n-default-locale">Default locale</Label>
          <Select value={defaultLocale} onValueChange={setDefaultLocale} disabled={disabled || isLoading}>
            <SelectTrigger id="i18n-default-locale" className="rounded-xl">
              <SelectValue placeholder="Select default locale" />
            </SelectTrigger>
            <SelectContent>
              {(state?.availableLocales || []).map((locale) => (
                <SelectItem key={locale.code} value={locale.code}>
                  {locale.name} ({locale.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label>Supported locales</Label>
          <div className="grid gap-3 md:grid-cols-2">
            {(state?.availableLocales || []).map((locale) => {
              const checked = supportedLocales.includes(locale.code) || locale.code === defaultLocale;
              return (
                <div
                  key={locale.code}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{locale.name}</p>
                    <p className="text-xs text-slate-500">{locale.code}</p>
                  </div>
                  <Switch
                    checked={checked}
                    disabled={disabled || isLoading || locale.code === defaultLocale}
                    onCheckedChange={(nextValue) => toggleLocale(locale.code, nextValue)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <p className="font-medium text-slate-900">Status</p>
          <p
            className={
              statusTone === 'error'
                ? 'mt-1 text-red-600'
                : statusTone === 'success'
                  ? 'mt-1 text-emerald-700'
                  : 'mt-1 text-slate-600'
            }
          >
            {statusMessage}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void saveLocalization()} disabled={disabled || isSaving || isLoading} className="rounded-xl">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save localization
          </Button>
          <Button variant="outline" onClick={() => void loadLocalizationState()} disabled={isSaving || isLoading} className="rounded-xl">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Reload
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function OdooNativeWorkspace(props: {
  installationId: string;
  selectedInstance: PluginInstance | null;
  onSaveConfig: (config: Record<string, unknown>) => Promise<void>;
}) {
  const { installationId, selectedInstance, onSaveConfig } = props;
  const persistedConfig = useMemo(
    () => (
      isPlainObject(selectedInstance?.config)
        ? (selectedInstance.config as OdooConfig)
        : {}
    ),
    [selectedInstance?.config]
  );
  const [mode, setMode] = useState<'test' | 'production'>('test');
  const [testChannelId, setTestChannelId] = useState('');
  const [testAuthSecret, setTestAuthSecret] = useState('');
  const [productionChannelId, setProductionChannelId] = useState('');
  const [productionAuthSecret, setProductionAuthSecret] = useState('');
  const [configMessage, setConfigMessage] = useState('Save Odoo credentials to enable native sync actions.');
  const [configTone, setConfigTone] = useState<'default' | 'error' | 'success'>('default');
  const [healthMessage, setHealthMessage] = useState('Health has not been checked yet.');
  const [healthTone, setHealthTone] = useState<'default' | 'error' | 'success'>('default');
  const [healthPayload, setHealthPayload] = useState<OdooHealthPayload | null>(null);
  const [productType, setProductType] = useState('all');
  const [jobId, setJobId] = useState('');
  const [syncMessage, setSyncMessage] = useState('Ready to submit a product sync job.');
  const [syncTone, setSyncTone] = useState<'default' | 'error' | 'success'>('default');
  const [jobPayload, setJobPayload] = useState<OdooJobPayload | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingJob, setIsLoadingJob] = useState(false);

  useEffect(() => {
    setMode(persistedConfig.mode === 'production' ? 'production' : 'test');
    setTestChannelId(typeof persistedConfig.test?.channelId === 'string' ? persistedConfig.test.channelId : '');
    setTestAuthSecret(typeof persistedConfig.test?.authSecret === 'string' ? persistedConfig.test.authSecret : '');
    setProductionChannelId(
      typeof persistedConfig.production?.channelId === 'string' ? persistedConfig.production.channelId : ''
    );
    setProductionAuthSecret(
      typeof persistedConfig.production?.authSecret === 'string' ? persistedConfig.production.authSecret : ''
    );
    setConfigMessage('Save Odoo credentials to enable native sync actions.');
    setConfigTone('default');
  }, [selectedInstance?.installationId, persistedConfig]);

  const saveConfiguration = async () => {
    const nextConfig = buildOdooConfig({
      mode,
      testChannelId,
      testAuthSecret,
      productionChannelId,
      productionAuthSecret,
    });
    const activeConfig = nextConfig.mode === 'production' ? nextConfig.production : nextConfig.test;

    if (!activeConfig?.channelId || !activeConfig?.authSecret) {
      const message = 'Channel ID and Auth Secret are required for the selected environment.';
      setConfigMessage(message);
      setConfigTone('error');
      toast.error(message);
      return;
    }

    setIsSavingConfig(true);
    setConfigMessage('Saving Odoo configuration...');
    setConfigTone('default');

    try {
      await onSaveConfig(nextConfig as Record<string, unknown>);
      setConfigMessage('Odoo configuration saved successfully.');
      setConfigTone('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save Odoo configuration.';
      setConfigMessage(message);
      setConfigTone('error');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const checkHealth = async () => {
    setIsLoadingHealth(true);
    setHealthMessage('Checking Odoo plugin health...');
    setHealthTone('default');

    try {
      const response = await apiClient.get('/extensions/plugin/odoo/health', {
        params: { installationId },
      });
      const data = unwrapApiResponse<OdooHealthPayload>(response);
      setHealthPayload(data);
      setHealthMessage(`Health check passed${data.status ? `: ${data.status}` : '.'}`);
      setHealthTone('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load Odoo health.';
      setHealthMessage(message);
      setHealthTone('error');
    } finally {
      setIsLoadingHealth(false);
    }
  };

  const startSync = async () => {
    if (!selectedInstance?.enabled) {
      const message = 'Enable the selected Odoo instance before starting a sync.';
      setSyncMessage(message);
      setSyncTone('error');
      toast.error(message);
      return;
    }

    setIsSyncing(true);
    setSyncMessage('Submitting sync job...');
    setSyncTone('default');

    try {
      const response = await apiClient.post('/extensions/plugin/odoo/api/sync/products', {
        productType,
      }, {
        params: { installationId },
      });
      const data = unwrapApiResponse<{ jobId?: string }>(response);
      if (data.jobId) {
        setJobId(data.jobId);
      }
      setSyncMessage(data.jobId ? `Sync accepted. Job: ${data.jobId}` : 'Sync accepted.');
      setSyncTone('success');
      toast.success('Odoo sync job started');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit Odoo sync job.';
      setSyncMessage(message);
      setSyncTone('error');
      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadJob = async () => {
    if (!jobId.trim()) {
      const message = 'Enter a sync job id first.';
      setSyncMessage(message);
      setSyncTone('error');
      toast.error(message);
      return;
    }

    setIsLoadingJob(true);
    setSyncMessage('Loading sync job status...');
    setSyncTone('default');

    try {
      const response = await apiClient.get(`/extensions/plugin/odoo/api/sync/jobs/${encodeURIComponent(jobId.trim())}`, {
        params: { installationId },
      });
      const data = unwrapApiResponse<OdooJobPayload>(response);
      const progress =
        typeof data.progressDone === 'number' && typeof data.progressTotal === 'number'
          ? ` (${data.progressDone}/${data.progressTotal})`
          : '';
      setJobPayload(data);
      setSyncMessage(`Job ${data.jobId} is ${String(data.status || 'unknown').toLowerCase()}${progress}.`);
      setSyncTone(String(data.status || '').toUpperCase() === 'FAILED' ? 'error' : 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load sync job status.';
      setSyncMessage(message);
      setSyncTone('error');
      toast.error(message);
    } finally {
      setIsLoadingJob(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-[1.75rem] border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl tracking-tight">Odoo configuration</CardTitle>
          <CardDescription>
            Manage Odoo credentials and mode from a native Merchant Admin form instead of a plugin iframe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="odoo-mode">Environment mode</Label>
            <Select value={mode} onValueChange={(value) => setMode(value === 'production' ? 'production' : 'test')}>
              <SelectTrigger id="odoo-mode" className="rounded-xl">
                <SelectValue placeholder="Select environment mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="test">test</SelectItem>
                <SelectItem value="production">production</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Test credentials</p>
              <div className="space-y-2">
                <Label htmlFor="odoo-test-channel-id">Channel ID</Label>
                <Input
                  id="odoo-test-channel-id"
                  value={testChannelId}
                  onChange={(event) => setTestChannelId(event.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="odoo-test-auth-secret">Auth Secret</Label>
                <Input
                  id="odoo-test-auth-secret"
                  type="password"
                  value={testAuthSecret}
                  onChange={(event) => setTestAuthSecret(event.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Production credentials</p>
              <div className="space-y-2">
                <Label htmlFor="odoo-production-channel-id">Channel ID</Label>
                <Input
                  id="odoo-production-channel-id"
                  value={productionChannelId}
                  onChange={(event) => setProductionChannelId(event.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="odoo-production-auth-secret">Auth Secret</Label>
                <Input
                  id="odoo-production-auth-secret"
                  type="password"
                  value={productionAuthSecret}
                  onChange={(event) => setProductionAuthSecret(event.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p className="font-medium text-slate-900">Configuration</p>
            <p
              className={
                configTone === 'error'
                  ? 'mt-1 text-red-600'
                  : configTone === 'success'
                    ? 'mt-1 text-emerald-700'
                    : 'mt-1 text-slate-600'
              }
            >
              {configMessage}
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void saveConfiguration()} disabled={isSavingConfig} className="rounded-xl">
              {isSavingConfig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Odoo configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[1.75rem] border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg tracking-tight">Health</CardTitle>
            <CardDescription>Check whether the Odoo plugin runtime is reachable through the extension gateway.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="font-medium text-slate-900">Status</p>
              <p
                className={
                  healthTone === 'error'
                    ? 'mt-1 text-red-600'
                    : healthTone === 'success'
                      ? 'mt-1 text-emerald-700'
                      : 'mt-1 text-slate-600'
                }
              >
                {healthMessage}
              </p>
            </div>

            {healthPayload ? (
              <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Plugin</span>
                  <span className="font-medium text-slate-900">{healthPayload.plugin || 'odoo'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Version</span>
                  <span className="font-medium text-slate-900">{healthPayload.version || 'n/a'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Reported at</span>
                  <span className="font-medium text-slate-900">{formatDate(healthPayload.timestamp)}</span>
                </div>
              </div>
            ) : null}

            <Button variant="outline" onClick={() => void checkHealth()} disabled={isLoadingHealth} className="rounded-xl">
              {isLoadingHealth ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              Check health
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg tracking-tight">Product sync</CardTitle>
            <CardDescription>Trigger sync jobs and inspect their runtime status from Merchant Admin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="odoo-product-type">Product type</Label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger id="odoo-product-type" className="rounded-xl">
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent>
                  {['all', 'esim', 'data', 'esim-card', 'ota-card', 'effective_date', 'external_data', 'sign_data'].map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void startSync()} disabled={isSyncing} className="rounded-xl">
                {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Workflow className="mr-2 h-4 w-4" />}
                Start sync
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="odoo-job-id">Job ID</Label>
              <Input
                id="odoo-job-id"
                value={jobId}
                onChange={(event) => setJobId(event.target.value)}
                placeholder="Paste a sync job id"
                className="rounded-xl"
              />
            </div>

            <Button variant="outline" onClick={() => void loadJob()} disabled={isLoadingJob} className="rounded-xl">
              {isLoadingJob ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Load job status
            </Button>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="font-medium text-slate-900">Sync status</p>
              <p
                className={
                  syncTone === 'error'
                    ? 'mt-1 text-red-600'
                    : syncTone === 'success'
                      ? 'mt-1 text-emerald-700'
                      : 'mt-1 text-slate-600'
                }
              >
                {syncMessage}
              </p>
            </div>

            {jobPayload ? (
              <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Job</span>
                  <span className="font-medium text-slate-900">{jobPayload.jobId}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Status</span>
                  <span className="font-medium text-slate-900">{jobPayload.status || 'unknown'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Product type</span>
                  <span className="font-medium text-slate-900">{jobPayload.productType || 'n/a'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Progress</span>
                  <span className="font-medium text-slate-900">
                    {typeof jobPayload.progressDone === 'number' && typeof jobPayload.progressTotal === 'number'
                      ? `${jobPayload.progressDone}/${jobPayload.progressTotal}`
                      : 'n/a'}
                  </span>
                </div>
                {jobPayload.lastError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                    {jobPayload.lastError}
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function PluginWorkspace({ slug }: { slug: string }) {
  const locale = useLocale();
  const t = useT();
  const { data, isLoading, error } = usePluginConfig(slug);
  const { data: instancesData, isLoading: isInstancesLoading } = usePluginInstances(slug);
  const { data: installedPluginsData } = useInstalledPlugins();
  const { data: officialCatalogData } = useOfficialCatalog();
  const { mutateAsync: createInstance, isPending: isCreatingInstance } = useCreatePluginInstance();
  const { mutateAsync: updateInstance, isPending: isUpdatingInstance } = useUpdatePluginInstance();
  const [selectedInstallationId, setSelectedInstallationId] = useState('default');
  const [configDraft, setConfigDraft] = useState<Record<string, unknown>>({});
  const [jsonFieldDrafts, setJsonFieldDrafts] = useState<Record<string, string>>({});
  const [jsonFieldErrors, setJsonFieldErrors] = useState<Record<string, string>>({});

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const instances = useMemo(() => instancesData?.items || [], [instancesData?.items]);
  const installedPlugins = installedPluginsData?.items || [];
  const officialPluginSlugs = useMemo(
    () =>
      new Set(
        (officialCatalogData?.items || [])
          .filter((item) => item.kind === 'plugin')
          .map((item) => item.slug)
      ),
    [officialCatalogData?.items]
  );
  const configSchema = isPlainObject(data?.configSchema) ? (data?.configSchema as PluginConfigSchema) : undefined;

  useEffect(() => {
    if (instances.length === 0) {
      setSelectedInstallationId('default');
      return;
    }

    const defaultInstance = instances.find((instance) => instance.instanceKey === 'default') || instances[0];
    setSelectedInstallationId((current) => {
      const exists = instances.some((instance) => instance.installationId === current);
      return exists ? current : defaultInstance.installationId;
    });
  }, [instances]);

  const selectedInstance = instances.find((instance) => instance.installationId === selectedInstallationId)
    || instances.find((instance) => instance.instanceKey === 'default')
    || instances[0]
    || null;

  const selectedConfig = useMemo(
    () => (
      isPlainObject(selectedInstance?.config)
        ? (selectedInstance.config as Record<string, unknown>)
        : {}
    ),
    [selectedInstance?.config]
  );
  const selectedConfigMeta = selectedInstance?.configMeta || data?.configMeta;
  const selectedReadiness = evaluateConfigReadiness(configSchema, selectedConfig, selectedConfigMeta);
  const hasNativeWorkspace = slug === 'odoo' || slug === 'i18n' || Boolean(configSchema);

  useEffect(() => {
    setConfigDraft(selectedConfig);
    setJsonFieldDrafts(buildJsonFieldDrafts(configSchema, selectedConfig));
    setJsonFieldErrors({});
  }, [selectedInstance?.installationId, selectedInstance?.updatedAt, configSchema, selectedConfig]);

  const updateConfigField = (field: string, value: unknown) => {
    setConfigDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateJsonConfigField = (field: string, rawValue: string, expectedType: 'object' | 'array') => {
    setJsonFieldDrafts((current) => ({
      ...current,
      [field]: rawValue,
    }));

    const trimmed = rawValue.trim();
    if (!trimmed) {
      updateConfigField(field, expectedType === 'array' ? [] : {});
      setJsonFieldErrors((current) => ({
        ...current,
        [field]: '',
      }));
      return;
    }

    try {
      const parsed = JSON.parse(rawValue);
      const valid = expectedType === 'array' ? Array.isArray(parsed) : isPlainObject(parsed);
      if (!valid) {
        throw new Error(`Value must be a JSON ${expectedType}`);
      }
      updateConfigField(field, parsed);
      setJsonFieldErrors((current) => ({
        ...current,
        [field]: '',
      }));
    } catch (error) {
      setJsonFieldErrors((current) => ({
        ...current,
        [field]: error instanceof Error ? error.message : 'Invalid JSON',
      }));
    }
  };

  const persistSelectedConfig = async (nextConfig: Record<string, unknown>) => {
    if (Object.values(jsonFieldErrors).some(Boolean)) {
      const message = getText('common.validation.invalidFormat', 'Invalid format');
      toast.error(message);
      throw new Error(message);
    }

    if (selectedInstance) {
      await updateInstance({
        slug,
        installationId: selectedInstance.installationId,
        enabled: selectedInstance.enabled,
        config: nextConfig,
      });
      return;
    }

    const created = await createInstance({
      slug,
      instanceKey: 'default',
      enabled: false,
      config: nextConfig,
    });
    setSelectedInstallationId(created.installationId);
  };

  const handleSaveGenericConfig = async () => {
    try {
      await persistSelectedConfig(configDraft);
    } catch {
      // Toast is surfaced through the mutation hooks.
    }
  };

  const handleCreateDefaultInstance = async () => {
    try {
      const created = await createInstance({
        slug,
        instanceKey: 'default',
        enabled: false,
        config: {},
      });
      setSelectedInstallationId(created.installationId);
    } catch {
      // Toast is surfaced through the mutation hook.
    }
  };

  const handleToggleSelectedInstance = async () => {
    try {
      const nextEnabled = !selectedInstance?.enabled;
      const readiness = evaluateConfigReadiness(configSchema, selectedConfig, selectedConfigMeta);

      if (nextEnabled && readiness.configRequired && !readiness.configReady) {
        const detail = readiness.missingConfigFields.length > 0
          ? `: ${readiness.missingConfigFields.join(', ')}`
          : '';
        toast.error(`This plugin requires configuration before enabling${detail}`);
        return;
      }

      if (selectedInstance) {
        await updateInstance({
          slug,
          installationId: selectedInstance.installationId,
          enabled: nextEnabled,
          config: selectedConfig,
        });
        return;
      }

      const created = await createInstance({
        slug,
        instanceKey: 'default',
        enabled: true,
        config: selectedConfig,
      });
      setSelectedInstallationId(created.installationId);
    } catch {
      // Toast is surfaced through the mutation hook.
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading plugin workspace...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Plugin unavailable</h1>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            The plugin details could not be loaded.
          </p>
          <div className="mt-6">
            <Link href={`/${locale}/plugins`}>
              <Button variant="outline">Back to plugins</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfdfe] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto grid max-w-[1600px] gap-6 lg:grid-cols-[280px,minmax(0,1fr)]">
        <InstalledPluginsRail
          locale={locale}
          plugins={installedPlugins}
          selectedSlug={slug}
          officialSlugs={officialPluginSlugs}
          getText={getText}
        />

        <div className="space-y-6">
          <div className="rounded-[1.75rem] border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">
                    {getText('merchant.plugins.pluginWorkspace', 'Plugin workspace')}
                  </p>
                  {officialPluginSlugs.has(slug) ? <OfficialBadge compact /> : null}
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {data.name || slug}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  {getText(
                    'merchant.plugins.workspaceDescription',
                    'Manage plugin-specific configuration, instance targeting, and native Admin controls from a dedicated workspace.'
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 xl:justify-end">
                <div className="min-w-[240px]">
                  <Select
                    value={selectedInstance?.installationId || selectedInstallationId}
                    onValueChange={setSelectedInstallationId}
                    disabled={isInstancesLoading || instances.length === 0}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-white">
                      <SelectValue placeholder={isInstancesLoading ? 'Loading instances...' : 'Select instance'} />
                    </SelectTrigger>
                    <SelectContent>
                      {instances.length === 0 ? (
                        <SelectItem value="default">default</SelectItem>
                      ) : (
                        instances.map((instance) => (
                          <SelectItem key={instance.installationId} value={instance.installationId}>
                            {instance.instanceKey}
                            {instance.enabled ? '' : ' (disabled)'}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href={`/${locale}/plugins`}>
                    {getText('merchant.plugins.backToMarketplace', 'Back to plugins')}
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <Alert className="border-blue-200 bg-blue-50 text-blue-950">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Native workspace</AlertTitle>
            <AlertDescription>
              Merchant Admin now renders plugin controls as native UI. iframe-based plugin consoles are not embedded in this workspace.
            </AlertDescription>
          </Alert>

          <div className="rounded-2xl border bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span>
                <strong className="text-slate-900">Plugin:</strong> {data.name || slug}
              </span>
              <span>
                <strong className="text-slate-900">Version:</strong> {data.version || 'n/a'}
              </span>
              <span>
                <strong className="text-slate-900">Source:</strong> {data.source || 'installed'}
              </span>
              <span>
                <strong className="text-slate-900">Instance:</strong> {selectedInstance?.instanceKey || 'default'}
              </span>
              <span>
                <strong className="text-slate-900">Installation ID:</strong> {selectedInstance?.installationId || 'default'}
              </span>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),360px]">
            <div className="space-y-6">
              {slug === 'i18n' ? (
                <I18nNativeWorkspace
                  installationId={selectedInstance?.installationId || 'default'}
                  disabled={!selectedInstance}
                />
              ) : null}

              {slug === 'odoo' ? (
                <OdooNativeWorkspace
                  installationId={selectedInstance?.installationId || 'default'}
                  selectedInstance={selectedInstance}
                  onSaveConfig={persistSelectedConfig}
                />
              ) : null}

              {slug !== 'i18n' && slug !== 'odoo' && configSchema ? (
                <GenericConfigEditor
                  configSchema={configSchema}
                  configDraft={configDraft}
                  configMeta={selectedConfigMeta}
                  jsonFieldDrafts={jsonFieldDrafts}
                  jsonFieldErrors={jsonFieldErrors}
                  onUpdateField={updateConfigField}
                  onUpdateJsonField={updateJsonConfigField}
                  onSave={() => void handleSaveGenericConfig()}
                  saving={isCreatingInstance || isUpdatingInstance}
                />
              ) : null}

              {!hasNativeWorkspace ? (
                <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No native controls yet</AlertTitle>
                  <AlertDescription>
                    This plugin does not declare a config schema or a native Admin adapter yet. Merchant Admin will not embed its legacy HTML surface in an iframe.
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>

            <div className="space-y-6">
              <Card className="rounded-[1.75rem] border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg tracking-tight">Instance status</CardTitle>
                  <CardDescription>
                    Native Admin controls operate on the selected plugin instance.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-3 rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Enabled</span>
                      <Badge variant={selectedInstance?.enabled ? 'default' : 'outline'}>
                        {selectedInstance?.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Config readiness</span>
                      <Badge variant={selectedReadiness.configReady ? 'default' : 'outline'}>
                        {selectedReadiness.configReady ? 'Ready' : 'Needs config'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Runtime</span>
                      <span className="font-medium text-slate-900">{data.runtimeType || 'n/a'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">Admin surface</span>
                      <span className="font-medium text-slate-900">Native</span>
                    </div>
                  </div>

                  {selectedReadiness.missingConfigFields.length > 0 ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                      Missing required fields: {selectedReadiness.missingConfigFields.join(', ')}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => void handleToggleSelectedInstance()}
                      disabled={isCreatingInstance || isUpdatingInstance}
                      className="rounded-xl"
                    >
                      {isCreatingInstance || isUpdatingInstance ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {selectedInstance?.enabled ? 'Disable instance' : 'Enable instance'}
                    </Button>

                    {!selectedInstance ? (
                      <Button
                        variant="outline"
                        onClick={() => void handleCreateDefaultInstance()}
                        disabled={isCreatingInstance}
                        className="rounded-xl"
                      >
                        Create default instance
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <PluginInstanceManager
                pluginSlug={slug}
                pluginName={data.name || slug}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
