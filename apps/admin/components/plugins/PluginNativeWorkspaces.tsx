'use client';

/**
 * Plugin-specific native panels that are not schema-driven settings forms.
 * Like every other section they carry no save button: a panel that edits a
 * persisted resource registers it with the page-level Save instead.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cable, Globe2, Loader2, RefreshCw, Send, ShieldCheck, Truck, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, unwrapApiResponse } from '@/lib/api';
import type { PluginInstance } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { isPlainObject, isSameConfigValue } from '@/components/plugins/plugin-config-utils';
import { usePluginSaveContribution, usePluginSaveRegistry } from '@/components/plugins/plugin-save-registry';
import {
  WorkspaceCard,
  WorkspaceField,
  WorkspaceNotice,
  workspaceFieldLabelClass,
  workspaceInputClass,
  workspaceOutlineButtonClass,
  workspacePrimaryButtonClass,
  workspaceSelectTriggerClass,
} from '@/components/plugins/plugin-workspace-ui';
import { useWorkspaceText } from '@/components/plugins/use-workspace-text';

type I18nLocalizationState = {
  availableLocales: Array<{ code: string; name: string }>;
  store: {
    defaultLocale?: string;
    supportedLocales?: string[];
  };
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

type ShippingProvider = 'kuaidi100' | 'fourpx';

type ShippingProviderAction = {
  value: string;
  /** the English name, and the dictionary key that names the operation in the store's language */
  label: string;
  labelKey: string;
  endpoint: string;
  needsMerchantReference?: boolean;
};

const shippingProviderActions: Record<ShippingProvider, ShippingProviderAction[]> = {
  kuaidi100: [
    { value: 'label-order', label: 'Create label order', labelKey: 'shipping.action.createLabelOrder', endpoint: 'kuaidi100/label-orders', needsMerchantReference: true },
    { value: 'pickup-order', label: 'Create pickup order', labelKey: 'shipping.action.createPickupOrder', endpoint: 'kuaidi100/pickup-orders', needsMerchantReference: true },
    { value: 'tracking-query', label: 'Query tracking', labelKey: 'shipping.action.queryTracking', endpoint: 'kuaidi100/tracking/query' },
    { value: 'tracking-subscribe', label: 'Subscribe to tracking', labelKey: 'shipping.action.subscribeTracking', endpoint: 'kuaidi100/tracking/subscribe' },
  ],
  fourpx: [
    { value: 'create-order', label: 'Create shipment order', labelKey: 'shipping.action.createShipmentOrder', endpoint: 'fourpx/orders', needsMerchantReference: true },
    { value: 'get-order', label: 'Get shipment order', labelKey: 'shipping.action.getShipmentOrder', endpoint: 'fourpx/orders/get' },
    { value: 'cancel-order', label: 'Cancel shipment order', labelKey: 'shipping.action.cancelShipmentOrder', endpoint: 'fourpx/orders/cancel' },
    { value: 'get-label', label: 'Get shipping label', labelKey: 'shipping.action.getShippingLabel', endpoint: 'fourpx/labels' },
    { value: 'get-tracking', label: 'Query tracking', labelKey: 'shipping.action.queryTracking', endpoint: 'fourpx/tracking' },
  ],
};

function formatDate(value?: string): string {
  if (!value) return 'n/a';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

/** Omits empty credential fields, matching the shape the Odoo adapter reads. */
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

function readOdooConfig(config: OdooConfig): Parameters<typeof buildOdooConfig>[0] {
  return {
    mode: config.mode === 'production' ? 'production' : 'test',
    testChannelId: typeof config.test?.channelId === 'string' ? config.test.channelId : '',
    testAuthSecret: typeof config.test?.authSecret === 'string' ? config.test.authSecret : '',
    productionChannelId: typeof config.production?.channelId === 'string' ? config.production.channelId : '',
    productionAuthSecret: typeof config.production?.authSecret === 'string' ? config.production.authSecret : '',
  };
}

type StatusTone = 'default' | 'error' | 'success';

const STATUS_NOTICE: Record<StatusTone, string> = {
  default: 'border-gray-100 bg-gray-50/60 text-gray-700',
  error: 'border-red-200 bg-red-50 text-red-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

function StatusLine({ tone, children }: { tone: StatusTone; children: string }) {
  return <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${STATUS_NOTICE[tone]}`}>{children}</div>;
}

export function NativeConnectionTest(props: {
  slug: string;
  /** True while the selected instance is disabled; the test needs a live plugin. */
  disabled: boolean;
  /** Enables the selected instance (saving pending edits first). Resolves false when it could not. */
  onEnable: () => Promise<boolean>;
}) {
  const { slug, disabled, onEnable } = props;
  const tf = useWorkspaceText();
  const { hasDirty } = usePluginSaveRegistry();
  const [recipient, setRecipient] = useState('');
  const [testing, setTesting] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const enablePlugin = async () => {
    setEnabling(true);
    try {
      if (await onEnable()) setResult(null);
    } finally {
      setEnabling(false);
    }
  };

  const testConnection = async () => {
    const email = recipient.trim();
    if (slug === 'smtp-email' && !email) {
      setResult({ tone: 'error', text: tf('testSmtpRecipientRequired', 'Enter a recipient for the SMTP delivery test.') });
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      const response = await apiClient.post(`/extensions/plugin/${slug}/api/admin/test`, slug === 'smtp-email' ? { to: email } : {});
      const data = unwrapApiResponse<Record<string, unknown>>(response);
      const text =
        slug === 'stripe' && typeof data.accountId === 'string'
          ? tf('testSuccessStripe', 'Connection successful. Stripe account {id}.', { id: data.accountId })
          : slug === 'odoo' && typeof data.database === 'string'
            ? tf('testSuccessOdoo', 'Connection successful. Odoo database {name}.', { name: data.database })
            : slug === 'smtp-email'
              ? tf('testSuccessSmtp', 'Connection successful. Test email accepted for {email}.', { email })
              : tf('testSuccess', 'Connection successful.');
      setResult({ tone: 'success', text });
    } catch (error) {
      setResult({
        tone: 'error',
        text: error instanceof Error ? error.message : tf('testFailed', 'Connection test failed.'),
      });
    } finally {
      setTesting(false);
    }
  };

  // The test runs against the saved configuration, so it would report on stale settings while edits are pending.
  const hint = disabled
    ? tf('testEnableFirst', 'Enable the plugin before running the connection test.')
    : hasDirty
      ? tf('testSaveFirst', 'Save your changes before running the connection test.')
      : null;

  return (
    <WorkspaceCard
      icon={<Cable className="h-6 w-6" />}
      title={tf('connectionTitle', 'Connection test')}
      description={tf('connectionDescription', 'Validate the saved configuration without exposing stored credentials.')}
    >
      <div className="space-y-5">
        {slug === 'smtp-email' ? (
          <WorkspaceField label={tf('testRecipient', 'Test recipient')} htmlFor="smtp-test-recipient">
            <Input
              id="smtp-test-recipient"
              type="email"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="you@example.com"
              disabled={disabled || testing || enabling}
              className={workspaceInputClass}
            />
          </WorkspaceField>
        ) : null}

        {result ? <WorkspaceNotice tone={result.tone}>{result.text}</WorkspaceNotice> : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 text-sm leading-6 text-gray-500">{hint}</p>
          {disabled ? (
            <Button type="button" onClick={() => void enablePlugin()} disabled={enabling} className={workspacePrimaryButtonClass}>
              {enabling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {tf('enablePlugin', 'Enable plugin')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => void testConnection()}
              disabled={testing || hasDirty}
              className={workspaceOutlineButtonClass}
            >
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Cable className="mr-2 h-4 w-4" />}
              {tf('testConnection', 'Test connection')}
            </Button>
          )}
        </div>
      </div>
    </WorkspaceCard>
  );
}

export function I18nNativeWorkspace(props: {
  installationId: string;
  disabled: boolean;
}) {
  const { installationId, disabled } = props;
  const tf = useWorkspaceText();
  const [state, setState] = useState<I18nLocalizationState | null>(null);
  const [defaultLocale, setDefaultLocale] = useState('');
  const [supportedLocales, setSupportedLocales] = useState<string[]>([]);
  // The last state the server confirmed; the draft is unsaved when it differs.
  const [savedDraft, setSavedDraft] = useState<{ defaultLocale: string; supportedLocales: string[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadLocalizationState = useCallback(async () => {
    setIsLoading(true);

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
      setSavedDraft({ defaultLocale: nextDefaultLocale, supportedLocales: nextSupportedLocales });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tf('localization.loadFailed', 'Failed to load storefront languages.'));
    } finally {
      setIsLoading(false);
    }
  }, [installationId, tf]);

  useEffect(() => {
    if (disabled) {
      setState(null);
      setSavedDraft(null);
      setIsLoading(false);
      return;
    }

    void loadLocalizationState();
  }, [disabled, loadLocalizationState]);

  const isDirty = Boolean(savedDraft) && !isLoading && (
    defaultLocale !== savedDraft?.defaultLocale
    || !isSameConfigValue(supportedLocales, savedDraft?.supportedLocales)
  );

  const saveLocalization = async () => {
    if (!defaultLocale) {
      const message = tf('localization.chooseDefault', 'Choose a default language before saving.');
      toast.error(message);
      throw new Error(message);
    }

    const nextSupportedLocales = supportedLocales.includes(defaultLocale)
      ? supportedLocales
      : [...supportedLocales, defaultLocale];

    try {
      const response = await apiClient.put('/extensions/plugin/i18n/api/localization', {
        defaultLocale,
        supportedLocales: nextSupportedLocales,
      }, {
        params: { installationId },
      });
      unwrapApiResponse(response);
      setSupportedLocales(nextSupportedLocales);
      setSavedDraft({ defaultLocale, supportedLocales: nextSupportedLocales });
      toast.success(tf('saved', 'Changes saved'));
    } catch (error) {
      const message = error instanceof Error ? error.message : tf('localization.saveFailed', 'Failed to update storefront languages.');
      toast.error(message);
      throw error;
    }
  };

  usePluginSaveContribution('i18n-localization', isDirty, saveLocalization);

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

  return (
    <WorkspaceCard
      icon={<Globe2 className="h-6 w-6" />}
      title={tf('localization.title', 'Storefront languages')}
      description={tf('localization.description', 'Set the storefront default language and which languages shoppers can switch to.')}
      actions={
        <Button
          variant="outline"
          className={workspaceOutlineButtonClass}
          onClick={() => void loadLocalizationState()}
          disabled={isLoading || disabled}
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {tf('refresh', 'Refresh')}
        </Button>
      }
    >
      <div className="space-y-6">
        <WorkspaceField
          label={tf('localization.defaultLocale', 'Default language')}
          htmlFor="i18n-default-locale"
          className="max-w-md"
        >
          <Select value={defaultLocale} onValueChange={setDefaultLocale} disabled={disabled || isLoading}>
            <SelectTrigger id="i18n-default-locale" className={workspaceSelectTriggerClass}>
              <SelectValue placeholder={tf('localization.selectDefault', 'Select default language')} />
            </SelectTrigger>
            <SelectContent>
              {(state?.availableLocales || []).map((locale) => (
                <SelectItem key={locale.code} value={locale.code}>
                  {locale.name} ({locale.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </WorkspaceField>

        <div className="space-y-2">
          <p className={workspaceFieldLabelClass}>
            {tf('localization.supportedLocales', 'Languages available to shoppers')}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {(state?.availableLocales || []).map((locale) => {
              const checked = supportedLocales.includes(locale.code) || locale.code === defaultLocale;
              return (
                <div
                  key={locale.code}
                  className="flex items-center justify-between gap-6 rounded-2xl border border-gray-100 bg-gray-50/40 py-3.5 pl-5 pr-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{locale.name}</p>
                    <p className="text-xs text-gray-500">{locale.code}</p>
                  </div>
                  <Switch
                    checked={checked}
                    disabled={disabled || isLoading || locale.code === defaultLocale}
                    onCheckedChange={(nextValue) => toggleLocale(locale.code, nextValue)}
                    aria-label={locale.name}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </WorkspaceCard>
  );
}

export function OdooNativeWorkspace(props: {
  installationId: string;
  selectedInstance: PluginInstance | null;
  onSaveConfig: (config: Record<string, unknown>) => Promise<void>;
}) {
  const { installationId, selectedInstance, onSaveConfig } = props;
  const tf = useWorkspaceText();
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
  const [healthMessage, setHealthMessage] = useState(() => tf('odoo.health.notChecked', 'Health has not been checked yet.'));
  const [healthTone, setHealthTone] = useState<StatusTone>('default');
  const [healthPayload, setHealthPayload] = useState<OdooHealthPayload | null>(null);
  const [productType, setProductType] = useState('all');
  const [jobId, setJobId] = useState('');
  const [syncMessage, setSyncMessage] = useState(() => tf('odoo.sync.ready', 'Ready to submit a product sync job.'));
  const [syncTone, setSyncTone] = useState<StatusTone>('default');
  const [jobPayload, setJobPayload] = useState<OdooJobPayload | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingJob, setIsLoadingJob] = useState(false);

  useEffect(() => {
    const persisted = readOdooConfig(persistedConfig);
    setMode(persisted.mode);
    setTestChannelId(persisted.testChannelId);
    setTestAuthSecret(persisted.testAuthSecret);
    setProductionChannelId(persisted.productionChannelId);
    setProductionAuthSecret(persisted.productionAuthSecret);
  }, [selectedInstance?.installationId, persistedConfig]);

  const currentConfig = buildOdooConfig({
    mode,
    testChannelId,
    testAuthSecret,
    productionChannelId,
    productionAuthSecret,
  });
  const isDirty = !isSameConfigValue(currentConfig, buildOdooConfig(readOdooConfig(persistedConfig)));

  const saveConfiguration = async () => {
    const activeConfig = currentConfig.mode === 'production' ? currentConfig.production : currentConfig.test;

    if (!activeConfig?.channelId || !activeConfig?.authSecret) {
      const message = tf('odoo.error.credentialsRequired', 'Channel ID and Auth Secret are required for the selected environment.');
      toast.error(message);
      throw new Error(message);
    }

    // Errors propagate to the save registry so the section stays dirty; the
    // mutation hook has already surfaced the failure.
    await onSaveConfig(currentConfig as Record<string, unknown>);
  };

  usePluginSaveContribution('odoo-config', isDirty, saveConfiguration);

  const checkHealth = async () => {
    setIsLoadingHealth(true);
    setHealthMessage(tf('odoo.health.checking', 'Checking Odoo plugin health...'));
    setHealthTone('default');

    try {
      const response = await apiClient.get('/extensions/plugin/odoo/health', {
        params: { installationId },
      });
      const data = unwrapApiResponse<OdooHealthPayload>(response);
      setHealthPayload(data);
      setHealthMessage(tf('odoo.health.passed', 'Health check passed{detail}', { detail: data.status ? `: ${data.status}` : '.' }));
      setHealthTone('success');
    } catch (error) {
      setHealthMessage(error instanceof Error ? error.message : tf('odoo.health.failed', 'Failed to load Odoo health.'));
      setHealthTone('error');
    } finally {
      setIsLoadingHealth(false);
    }
  };

  const startSync = async () => {
    if (!selectedInstance?.enabled) {
      setSyncMessage(tf('odoo.sync.enableFirst', 'Enable the selected Odoo instance before starting a sync.'));
      setSyncTone('error');
      return;
    }

    setIsSyncing(true);
    setSyncMessage(tf('odoo.sync.submitting', 'Submitting sync job...'));
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
      setSyncMessage(data.jobId ? tf('odoo.sync.acceptedJob', 'Sync accepted. Job: {jobId}', { jobId: data.jobId }) : tf('odoo.sync.accepted', 'Sync accepted.'));
      setSyncTone('success');
      toast.success(tf('odoo.sync.started', 'Odoo sync job started'));
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : tf('odoo.sync.submitFailed', 'Failed to submit Odoo sync job.'));
      setSyncTone('error');
      toast.error(error instanceof Error ? error.message : tf('odoo.sync.submitFailed', 'Failed to submit Odoo sync job.'));
    } finally {
      setIsSyncing(false);
    }
  };

  const loadJob = async () => {
    if (!jobId.trim()) {
      setSyncMessage(tf('odoo.job.enterId', 'Enter a sync job id first.'));
      setSyncTone('error');
      return;
    }

    setIsLoadingJob(true);
    setSyncMessage(tf('odoo.job.loading', 'Loading sync job status...'));
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
      setSyncMessage(tf('odoo.job.state', 'Job {jobId} is {status}{progress}.', { jobId: data.jobId, status: String(data.status || 'unknown').toLowerCase(), progress }));
      setSyncTone(String(data.status || '').toUpperCase() === 'FAILED' ? 'error' : 'success');
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : tf('odoo.job.loadFailed', 'Failed to load sync job status.'));
      setSyncTone('error');
    } finally {
      setIsLoadingJob(false);
    }
  };

  return (
    <div className="space-y-5">
      <WorkspaceCard
        icon={<Workflow className="h-6 w-6" />}
        title={tf('odoo.config.title', 'Odoo configuration')}
        description={tf('odoo.config.description', 'Manage Odoo credentials and mode from a native Merchant Admin form instead of a plugin iframe.')}
      >
        <div className="space-y-6">
          <WorkspaceField label={tf('odoo.config.environmentMode', 'Environment mode')} htmlFor="odoo-mode" className="max-w-md">
            <Select value={mode} onValueChange={(value) => setMode(value === 'production' ? 'production' : 'test')}>
              <SelectTrigger id="odoo-mode" className={workspaceSelectTriggerClass}>
                <SelectValue placeholder={tf('odoo.config.environmentPlaceholder', 'Select environment mode')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="test">{tf('odoo.mode.test', 'test')}</SelectItem>
                <SelectItem value="production">{tf('odoo.mode.production', 'production')}</SelectItem>
              </SelectContent>
            </Select>
          </WorkspaceField>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50/40 p-5">
              <p className="text-sm font-semibold text-gray-900">{tf('odoo.config.testCredentials', 'Test credentials')}</p>
              <WorkspaceField label={tf('odoo.config.channelId', 'Channel ID')} htmlFor="odoo-test-channel-id">
                <Input
                  id="odoo-test-channel-id"
                  value={testChannelId}
                  onChange={(event) => setTestChannelId(event.target.value)}
                  className={workspaceInputClass}
                />
              </WorkspaceField>
              <WorkspaceField label={tf('odoo.config.authSecret', 'Auth Secret')} htmlFor="odoo-test-auth-secret">
                <Input
                  id="odoo-test-auth-secret"
                  type="password"
                  value={testAuthSecret}
                  onChange={(event) => setTestAuthSecret(event.target.value)}
                  autoComplete="off"
                  className={workspaceInputClass}
                />
              </WorkspaceField>
            </div>

            <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50/40 p-5">
              <p className="text-sm font-semibold text-gray-900">{tf('odoo.config.productionCredentials', 'Production credentials')}</p>
              <WorkspaceField label={tf('odoo.config.channelId', 'Channel ID')} htmlFor="odoo-production-channel-id">
                <Input
                  id="odoo-production-channel-id"
                  value={productionChannelId}
                  onChange={(event) => setProductionChannelId(event.target.value)}
                  className={workspaceInputClass}
                />
              </WorkspaceField>
              <WorkspaceField label={tf('odoo.config.authSecret', 'Auth Secret')} htmlFor="odoo-production-auth-secret">
                <Input
                  id="odoo-production-auth-secret"
                  type="password"
                  value={productionAuthSecret}
                  onChange={(event) => setProductionAuthSecret(event.target.value)}
                  autoComplete="off"
                  className={workspaceInputClass}
                />
              </WorkspaceField>
            </div>
          </div>
        </div>
      </WorkspaceCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <WorkspaceCard
          icon={<ShieldCheck className="h-6 w-6" />}
          title={tf('odoo.health.title', 'Health')}
          description={tf('odoo.health.description', 'Check whether the Odoo plugin runtime is reachable through the extension gateway.')}
        >
          <div className="space-y-4">
            <StatusLine tone={healthTone}>{healthMessage}</StatusLine>

            {healthPayload ? (
              <div className="grid gap-3 rounded-2xl border border-gray-100 p-4 text-sm text-gray-600">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">{tf('odoo.health.plugin', 'Plugin')}</span>
                  <span className="font-medium text-gray-900">{healthPayload.plugin || 'odoo'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">{tf('odoo.health.version', 'Version')}</span>
                  <span className="font-medium text-gray-900">{healthPayload.version || 'n/a'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">{tf('odoo.health.reportedAt', 'Reported at')}</span>
                  <span className="font-medium text-gray-900">{formatDate(healthPayload.timestamp)}</span>
                </div>
              </div>
            ) : null}

            <Button variant="outline" onClick={() => void checkHealth()} disabled={isLoadingHealth} className={workspaceOutlineButtonClass}>
              {isLoadingHealth ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}{tf('odoo.health.check', 'Check health')}</Button>
          </div>
        </WorkspaceCard>

        <WorkspaceCard
          icon={<RefreshCw className="h-6 w-6" />}
          title={tf('odoo.sync.title', 'Product sync')}
          description={tf('odoo.sync.description', 'Trigger sync jobs and inspect their runtime status from Merchant Admin.')}
        >
          <div className="space-y-4">
            <WorkspaceField label={tf('odoo.sync.productType', 'Product type')} htmlFor="odoo-product-type">
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger id="odoo-product-type" className={workspaceSelectTriggerClass}>
                  <SelectValue placeholder={tf('odoo.sync.productTypePlaceholder', 'Select product type')} />
                </SelectTrigger>
                <SelectContent>
                  {['all', 'esim', 'data', 'esim-card', 'ota-card', 'effective_date', 'external_data', 'sign_data'].map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </WorkspaceField>

            <Button onClick={() => void startSync()} disabled={isSyncing} className={workspacePrimaryButtonClass}>
              {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Workflow className="mr-2 h-4 w-4" />}{tf('odoo.sync.start', 'Start sync')}</Button>

            <WorkspaceField label={tf('odoo.job.id', 'Job ID')} htmlFor="odoo-job-id">
              <Input
                id="odoo-job-id"
                value={jobId}
                onChange={(event) => setJobId(event.target.value)}
                placeholder={tf('odoo.job.idPlaceholder', 'Paste a sync job id')}
                className={workspaceInputClass}
              />
            </WorkspaceField>

            <Button variant="outline" onClick={() => void loadJob()} disabled={isLoadingJob} className={workspaceOutlineButtonClass}>
              {isLoadingJob ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}{tf('odoo.job.load', 'Load job status')}</Button>

            <StatusLine tone={syncTone}>{syncMessage}</StatusLine>

            {jobPayload ? (
              <div className="grid gap-3 rounded-2xl border border-gray-100 p-4 text-sm text-gray-600">
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">{tf('odoo.job.job', 'Job')}</span>
                  <span className="font-medium text-gray-900">{jobPayload.jobId}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">{tf('odoo.job.status', 'Status')}</span>
                  <span className="font-medium text-gray-900">{jobPayload.status || 'unknown'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">{tf('odoo.job.productType', 'Product type')}</span>
                  <span className="font-medium text-gray-900">{jobPayload.productType || 'n/a'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500">{tf('odoo.job.progress', 'Progress')}</span>
                  <span className="font-medium text-gray-900">
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
          </div>
        </WorkspaceCard>
      </div>
    </div>
  );
}

export function ShippingNativeWorkspace(props: {
  installationId: string;
  enabled: boolean;
}) {
  const { installationId, enabled } = props;
  const tf = useWorkspaceText();
  const [provider, setProvider] = useState<ShippingProvider>('kuaidi100');
  const [action, setAction] = useState(shippingProviderActions.kuaidi100[0].value);
  const [merchantReference, setMerchantReference] = useState('');
  const [orderId, setOrderId] = useState('');
  const [requestDraft, setRequestDraft] = useState('{}');
  const [responseDraft, setResponseDraft] = useState('');
  const readyMessage = tf('shipping.ready', 'Ready');
  const [statusMessage, setStatusMessage] = useState(readyMessage);
  const [statusTone, setStatusTone] = useState<StatusTone>('default');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableActions = shippingProviderActions[provider];
  const selectedAction = availableActions.find((item) => item.value === action) || availableActions[0];

  const selectProvider = (nextProvider: ShippingProvider) => {
    setProvider(nextProvider);
    setAction(shippingProviderActions[nextProvider][0].value);
    setResponseDraft('');
    setStatusMessage(readyMessage);
    setStatusTone('default');
  };

  const reject = (message: string) => {
    setStatusMessage(message);
    setStatusTone('error');
    toast.error(message);
  };

  const submitProviderAction = async () => {
    if (!enabled) {
      reject(tf('shipping.enableFirst', 'Enable the Shipping plugin before running carrier operations.'));
      return;
    }

    if (selectedAction.needsMerchantReference && !merchantReference.trim()) {
      reject(tf('shipping.referenceRequired', 'Enter a merchant reference for create operations.'));
      return;
    }
    if (selectedAction.needsMerchantReference && !orderId.trim()) {
      reject(tf('shipping.orderRequired', 'Enter an order ID for create operations.'));
      return;
    }

    let payload: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = JSON.parse(requestDraft);
      if (isPlainObject(parsed)) {
        payload = parsed;
      } else {
        reject(tf('shipping.objectRequired', 'The request body must be a JSON object.'));
      }
    } catch {
      reject(tf('shipping.invalidJson', 'The request body is not valid JSON.'));
    }
    if (!payload) return;

    setIsSubmitting(true);
    setResponseDraft('');
    setStatusMessage(tf('shipping.running', 'Running...'));
    setStatusTone('default');

    try {
      const requestBody = selectedAction.needsMerchantReference
        ? { reference: merchantReference.trim(), orderId: orderId.trim(), input: payload }
        : ['tracking-subscribe', 'cancel-order', 'get-tracking'].includes(selectedAction.value)
          ? payload
          : { input: payload };
      const response = await apiClient.post(
        `/extensions/plugin/shipping/api/admin/providers/${selectedAction.endpoint}`,
        requestBody,
        { params: { installationId }, timeout: 120000 }
      );
      const data = unwrapApiResponse<unknown>(response);
      setResponseDraft(JSON.stringify(data, null, 2));
      setStatusMessage(tf('shipping.done', 'Operation completed.'));
      setStatusTone('success');
      toast.success(tf('shipping.actionCompleted', '{action} completed', { action: tf(selectedAction.labelKey, selectedAction.label) }));
    } catch (error) {
      const message = error instanceof Error ? error.message : tf('shipping.failed', 'Operation failed.');
      setStatusMessage(message);
      setStatusTone('error');
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = `${workspaceInputClass} bg-white`;

  return (
    <WorkspaceCard
      icon={<Truck className="h-6 w-6" />}
      title={tf('shipping.title', 'Fulfillment operations')}
      description={tf('shipping.description', 'Run carrier operations through the enabled Shipping instance.')}
    >
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <WorkspaceField label={tf('shipping.provider', 'Provider')} htmlFor="shipping-provider">
            <Select value={provider} onValueChange={(value) => selectProvider(value === 'fourpx' ? 'fourpx' : 'kuaidi100')}>
              <SelectTrigger id="shipping-provider" className={workspaceSelectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kuaidi100">Kuaidi100</SelectItem>
                <SelectItem value="fourpx">4PX</SelectItem>
              </SelectContent>
            </Select>
          </WorkspaceField>
          <WorkspaceField label={tf('shipping.operation', 'Operation')} htmlFor="shipping-action">
            <Select value={selectedAction.value} onValueChange={setAction}>
              <SelectTrigger id="shipping-action" className={workspaceSelectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableActions.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{tf(item.labelKey, item.label)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </WorkspaceField>
        </div>

        {selectedAction.needsMerchantReference ? (
          <div className="grid gap-6 md:grid-cols-2">
            <WorkspaceField label={tf('shipping.orderId', 'Order ID')} htmlFor="shipping-order-id">
              <Input
                id="shipping-order-id"
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                placeholder="ord_..."
                className={inputClass}
              />
            </WorkspaceField>
            <WorkspaceField label={tf('shipping.merchantReference', 'Merchant reference')} htmlFor="shipping-merchant-reference">
              <Input
                id="shipping-merchant-reference"
                value={merchantReference}
                onChange={(event) => setMerchantReference(event.target.value)}
                placeholder={tf('shipping.referencePlaceholder', 'Stable carrier operation reference')}
                className={inputClass}
              />
            </WorkspaceField>
          </div>
        ) : null}

        <WorkspaceField label={tf('shipping.request', 'Provider request')} htmlFor="shipping-request-body">
          <Textarea
            id="shipping-request-body"
            value={requestDraft}
            onChange={(event) => setRequestDraft(event.target.value)}
            className="min-h-48 rounded-xl border-gray-100 bg-white font-mono text-xs"
            spellCheck={false}
          />
        </WorkspaceField>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void submitProviderAction()} disabled={isSubmitting || !enabled} className={workspacePrimaryButtonClass}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {tf('shipping.run', 'Run operation')}
          </Button>
          <Badge
            variant="outline"
            className={
              statusTone === 'error'
                ? 'rounded-full border-red-200 bg-red-50 text-red-700'
                : statusTone === 'success'
                  ? 'rounded-full border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'rounded-full border-gray-200 bg-gray-50 text-gray-600'
            }
          >
            {statusMessage}
          </Badge>
        </div>

        {responseDraft ? (
          <WorkspaceField label={tf('shipping.response', 'Response')} htmlFor="shipping-response">
            <pre
              id="shipping-response"
              className="max-h-80 overflow-auto rounded-2xl border border-gray-100 bg-gray-50/60 p-4 text-xs leading-5 text-gray-800"
            >
              {responseDraft}
            </pre>
          </WorkspaceField>
        ) : null}
      </div>
    </WorkspaceCard>
  );
}
