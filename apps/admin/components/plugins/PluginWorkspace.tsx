'use client';

import Link from 'next/link';
import { useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { CheckCircle2, Inbox, Loader2, Save, Search } from 'lucide-react';
import { ADMIN_PERMISSIONS } from 'shared';
import { useLocale, useT } from 'shared/src/i18n/react';
import type { PluginInstance } from '@/lib/api';
import type { PluginConfigMeta } from '@/lib/types';
import {
  useAffiliateNativeOverview,
  useCreatePluginInstance,
  useInstalledPlugins,
  useOfficialCatalog,
  usePluginConfig,
  usePluginInstances,
  useUpdatePluginInstance,
} from '@/lib/hooks/use-api';
import { useJobsAdminCapability } from '@/hooks/use-jobs-admin-capability';
import { canAccessAnyPermission } from '@/lib/admin-access';
import { useAuthStore } from '@/lib/store';
import { localizeExtensionDescription, localizeExtensionName } from '@/lib/extension-catalog-zh';
import { toast } from 'sonner';
import { PageShell } from '@/components/layout/page-shell';
import { OfficialBadge } from '@/components/extensions/ExtensionVisuals';
import { InstalledPluginsRail } from '@/components/extensions/InstalledPluginsRail';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AffiliateNativeWorkspace } from '@/components/plugins/AffiliateNativeWorkspace';
import {
  I18nNativeWorkspace,
  NativeConnectionTest,
  OdooNativeWorkspace,
  ShippingNativeWorkspace,
} from '@/components/plugins/PluginNativeWorkspaces';
import { I18nTranslationsPanel } from '@/components/plugins/I18nTranslationsPanel';
import { PluginConfigSection } from '@/components/plugins/PluginConfigSection';
import { PluginInstanceCard } from '@/components/plugins/PluginInstanceCard';
import { RemoteRadarJobsNativeWorkspace } from '@/components/plugins/RemoteRadarJobsNativeWorkspace';
import { SupportHubAiPanel } from '@/components/plugins/SupportHubAiPanel';
import { SUPPORT_HUB_CHANNEL_FIELDS, SupportHubChannelsSection } from '@/components/plugins/SupportHubChannelsSection';
import {
  buildJsonFieldDrafts,
  evaluateConfigReadiness,
  getConfigFieldLabel,
  isPlainObject,
  isSameConfigValue,
  type PluginConfigSchema,
} from '@/components/plugins/plugin-config-utils';
import { PluginSaveProvider, usePluginSaveContribution, usePluginSaveRegistry } from '@/components/plugins/plugin-save-registry';
import {
  WorkspaceCard,
  WorkspaceNotice,
  workspaceOutlineButtonClass,
  workspacePrimaryButtonClass,
} from '@/components/plugins/plugin-workspace-ui';
import { useWorkspaceText } from '@/components/plugins/use-workspace-text';

// Support Hub renders its AI/chat controls and contact channels in dedicated
// sections; keep those fields out of the generic schema form.
const SUPPORT_HUB_AI_FIELDS = new Set([
  'chatEnabled', 'aiEnabled', 'aiProvider', 'aiBaseUrl', 'aiApiKey', 'aiModel',
  'aiSystemPrompt', 'aiWelcomeMessage', 'aiHandoffMessage',
]);
const SUPPORT_HUB_CHANNEL_FIELD_SET = new Set(SUPPORT_HUB_CHANNEL_FIELDS);

const EMPTY_CONFIG: Record<string, unknown> = {};

/**
 * The config draft and the state it is compared against. Keeping both in one
 * reducer lets a server refresh be judged against the latest edits atomically,
 * so a background refetch never silently discards what the merchant is typing.
 */
type ConfigDraftState = {
  /** The installation the draft belongs to; switching installations always re-seeds. */
  installationId: string | null;
  /** What the merchant sees and edits. */
  draft: Record<string, unknown>;
  /** The server's last confirmed config, or the last successful save. */
  persisted: Record<string, unknown>;
  /** The config sent by the last successful save, until its own echo arrives. */
  lastSaved: Record<string, unknown> | null;
  jsonDrafts: Record<string, string>;
  jsonErrors: Record<string, string>;
};

type ConfigDraftAction =
  | { type: 'sync'; installationId: string | null; config: Record<string, unknown>; schema?: PluginConfigSchema }
  | { type: 'field'; field: string; value: unknown }
  | { type: 'json'; field: string; raw: string; expectedType: 'object' | 'array' }
  | { type: 'saved'; config: Record<string, unknown> };

function configDraftReducer(state: ConfigDraftState, action: ConfigDraftAction): ConfigDraftState {
  switch (action.type) {
    case 'sync': {
      // A refresh of the same installation returning the same data must not clobber edits in progress.
      if (action.installationId === state.installationId && isSameConfigValue(action.config, state.persisted)) {
        // The schema can arrive after the instance: seed the JSON editors once there are no edits to protect.
        const needsJsonDrafts = Object.keys(state.jsonDrafts).length === 0
          && isSameConfigValue(state.draft, state.persisted)
          && Object.values(state.jsonErrors).every((message) => !message);
        if (!state.lastSaved && !needsJsonDrafts) return state;
        return {
          ...state,
          lastSaved: null,
          ...(needsJsonDrafts ? { jsonDrafts: buildJsonFieldDrafts(action.schema, state.draft) } : {}),
        };
      }

      if (state.lastSaved && isSameConfigValue(action.config, state.lastSaved)) {
        // Our own save landing: keep any newer edits the merchant made on top of it and move the baseline.
        return { ...state, installationId: action.installationId, persisted: action.config, lastSaved: null };
      }

      // A different installation, or a change made elsewhere: start from the server state.
      return {
        installationId: action.installationId,
        draft: action.config,
        persisted: action.config,
        lastSaved: null,
        jsonDrafts: buildJsonFieldDrafts(action.schema, action.config),
        jsonErrors: {},
      };
    }
    case 'field':
      return { ...state, draft: { ...state.draft, [action.field]: action.value } };
    case 'json': {
      const next = { ...state, jsonDrafts: { ...state.jsonDrafts, [action.field]: action.raw } };
      if (!action.raw.trim()) {
        return {
          ...next,
          draft: { ...state.draft, [action.field]: action.expectedType === 'array' ? [] : {} },
          jsonErrors: { ...state.jsonErrors, [action.field]: '' },
        };
      }

      try {
        const parsed = JSON.parse(action.raw);
        const valid = action.expectedType === 'array' ? Array.isArray(parsed) : isPlainObject(parsed);
        if (!valid) {
          throw new Error(`Value must be a JSON ${action.expectedType}`);
        }
        return { ...next, draft: { ...state.draft, [action.field]: parsed }, jsonErrors: { ...state.jsonErrors, [action.field]: '' } };
      } catch (error) {
        return {
          ...next,
          jsonErrors: { ...state.jsonErrors, [action.field]: error instanceof Error ? error.message : 'Invalid JSON' },
        };
      }
    }
    case 'saved':
      return { ...state, persisted: action.config, lastSaved: action.config };
  }
}

export function PluginWorkspace({ slug }: { slug: string }) {
  return (
    <PluginSaveProvider>
      <PluginWorkspaceContent slug={slug} />
    </PluginSaveProvider>
  );
}

function PluginWorkspaceContent({ slug }: { slug: string }) {
  const locale = useLocale();
  const t = useT();
  const tf = useWorkspaceText();
  const registry = usePluginSaveRegistry();
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, error } = usePluginConfig(slug);
  const jobsAdminAvailable = useJobsAdminCapability();
  const affiliateOverviewQuery = useAffiliateNativeOverview(slug);
  const { data: instancesData, isLoading: isInstancesLoading } = usePluginInstances(slug);
  const { data: installedPluginsData } = useInstalledPlugins();
  const { data: officialCatalogData } = useOfficialCatalog();
  const { mutateAsync: createInstance, isPending: isCreatingInstance } = useCreatePluginInstance();
  const { mutateAsync: updateInstance, isPending: isUpdatingInstance } = useUpdatePluginInstance();
  const [selectedInstallationId, setSelectedInstallationId] = useState('default');
  const [draftState, dispatchDraft] = useReducer(configDraftReducer, undefined, () => ({
    installationId: null,
    draft: EMPTY_CONFIG,
    persisted: EMPTY_CONFIG,
    lastSaved: null,
    jsonDrafts: {},
    jsonErrors: {},
  }));

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const instances = useMemo(() => instancesData?.items || [], [instancesData?.items]);
  const installedPlugins = installedPluginsData?.items || [];
  const installedMeta = installedPlugins.find((plugin) => plugin.slug === slug);
  const officialPluginSlugs = useMemo(
    () =>
      new Set(
        (officialCatalogData?.items || [])
          .filter((item) => item.kind === 'plugin')
          .map((item) => item.slug)
      ),
    [officialCatalogData?.items],
  );
  const configSchema = isPlainObject(data?.configSchema) ? (data?.configSchema as PluginConfigSchema) : undefined;
  const editorConfigSchema = useMemo(() => {
    if (!configSchema || slug !== 'support-hub') return configSchema;
    const filtered: PluginConfigSchema = {};
    for (const [field, descriptor] of Object.entries(configSchema)) {
      if (!SUPPORT_HUB_AI_FIELDS.has(field) && !SUPPORT_HUB_CHANNEL_FIELD_SET.has(field)) filtered[field] = descriptor;
    }
    return filtered;
  }, [configSchema, slug]);
  const hasEditableConfig = Boolean(editorConfigSchema && Object.keys(editorConfigSchema).length > 0);

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

  const selectedInstance: PluginInstance | null = instances.find((instance) => instance.installationId === selectedInstallationId)
    || instances.find((instance) => instance.instanceKey === 'default')
    || instances[0]
    || null;
  const selectedInstallationKey = selectedInstance?.installationId ?? null;
  const installationId = selectedInstance?.installationId || 'default';
  const instanceEnabled = Boolean(selectedInstance?.enabled);
  // This is the server's own object, so its identity only changes when the instance data does
  // (react-query shares unchanged results between refetches); the sync effect relies on that.
  const selectedConfig = isPlainObject(selectedInstance?.config) ? selectedInstance.config : EMPTY_CONFIG;
  const selectedConfigMeta: PluginConfigMeta | undefined = selectedInstance?.configMeta || data?.configMeta;
  const isNative = data?.runtimeType === 'cloudflare-native';

  useEffect(() => {
    dispatchDraft({ type: 'sync', installationId: selectedInstallationKey, config: selectedConfig, schema: configSchema });
  }, [selectedInstallationKey, selectedConfig, configSchema]);

  const configDraft = draftState.draft;
  const hasConfigChanges = !isSameConfigValue(configDraft, draftState.persisted);
  // Readiness is judged on the draft so the notice clears as soon as the required fields are filled in.
  const draftReadiness = evaluateConfigReadiness(configSchema, configDraft, selectedConfigMeta);

  const updateConfigField = (field: string, value: unknown) => {
    dispatchDraft({ type: 'field', field, value });
  };

  const updateJsonConfigField = (field: string, rawValue: string, expectedType: 'object' | 'array') => {
    dispatchDraft({ type: 'json', field, raw: rawValue, expectedType });
  };

  const persistSelectedConfig = async (nextConfig: Record<string, unknown>) => {
    if (Object.values(draftState.jsonErrors).some(Boolean)) {
      const message = getText('common.validation.invalidFormat', 'Invalid format');
      toast.error(message);
      throw new Error(message);
    }

    try {
      if (selectedInstance) {
        await updateInstance({
          slug,
          installationId: selectedInstance.installationId,
          enabled: selectedInstance.enabled,
          config: nextConfig,
          successMessage: tf('saved', 'Changes saved'),
        });
      } else {
        const created = await createInstance({
          slug,
          instanceKey: 'default',
          enabled: false,
          config: nextConfig,
          successMessage: tf('saved', 'Changes saved'),
        });
        if (created?.installationId) setSelectedInstallationId(created.installationId);
      }
    } catch {
      // The toast is surfaced through the mutation hook; reject so the page stays dirty.
      throw new Error('Plugin configuration was not saved');
    }

    dispatchDraft({ type: 'saved', config: nextConfig });
  };

  usePluginSaveContribution(
    'plugin-config',
    hasConfigChanges,
    async () => {
      await persistSelectedConfig(configDraft);
    },
    hasEditableConfig,
  );

  const instanceBusy = isCreatingInstance || isUpdatingInstance || registry.saving;

  const refuseMissingConfig = (fields: string[]) => {
    toast.error(tf(
      'missingRequired',
      'Complete these required settings before enabling: {fields}',
      { fields: describeMissingFields(slug, locale, fields, configSchema) },
    ));
  };

  /** Flips the on/off switch of the selected instance. Resolves false when it could not. */
  const toggleEnabled = async (): Promise<boolean> => {
    if (instanceBusy) return false;
    const nextEnabled = !instanceEnabled;

    try {
      if (selectedInstance) {
        if (nextEnabled) {
          // Turning the plugin on uses what is on screen: persist pending edits first.
          if (registry.hasDirty && !(await registry.save())) return false;
          const readiness = evaluateConfigReadiness(configSchema, configDraft, selectedConfigMeta);
          if (readiness.configRequired && !readiness.configReady) {
            refuseMissingConfig(readiness.missingConfigFields);
            return false;
          }
        }

        await updateInstance({
          slug,
          installationId: selectedInstance.installationId,
          enabled: nextEnabled,
          // The native PATCH merges only the fields it receives, so the just-saved config is
          // left untouched; other runtimes replace it and need the current one sent along.
          ...(isNative ? {} : { config: nextEnabled ? configDraft : selectedInstance.config }),
          successMessage: nextEnabled ? tf('instanceEnabled', 'Plugin enabled') : tf('instanceDisabled', 'Plugin disabled'),
        });
      } else {
        // No instance yet: creating it carries the whole draft, so nothing else needs saving first.
        const readiness = evaluateConfigReadiness(configSchema, configDraft, selectedConfigMeta);
        if (readiness.configRequired && !readiness.configReady) {
          refuseMissingConfig(readiness.missingConfigFields);
          return false;
        }
        const created = await createInstance({
          slug,
          instanceKey: 'default',
          enabled: true,
          config: configDraft,
          successMessage: tf('instanceEnabled', 'Plugin enabled'),
        });
        dispatchDraft({ type: 'saved', config: configDraft });
        if (created?.installationId) setSelectedInstallationId(created.installationId);
      }
      return true;
    } catch {
      // The toast is surfaced through the mutation hook.
      return false;
    }
  };

  // Unsaved edits are easy to lose on a refresh; warn before a full page unload.
  useEffect(() => {
    if (!registry.hasDirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [registry.hasDirty]);

  const pluginName = localizeExtensionName(slug, data?.name || installedMeta?.name || slug, locale);
  const pluginDescription = localizeExtensionDescription(
    slug,
    data?.description || installedMeta?.description || getText('merchant.plugins.defaultDescription', 'A merchant-facing plugin that extends your store operations.'),
    locale,
  );
  const pluginVersion = data?.version || installedMeta?.version || '';
  const isOfficial = officialPluginSlugs.has(slug) || data?.source === 'official-market' || installedMeta?.source === 'official-market';
  const canOpenInbox = canAccessAnyPermission(user, [ADMIN_PERMISSIONS.SUPPORT_READ]);
  const supportsConfigForm = slug !== 'i18n' && (slug !== 'odoo' || isNative);
  const hasNativeWorkspace = slug === 'odoo' || slug === 'i18n' || slug === 'remoteradar-jobs' || slug === 'seo' || Boolean(configSchema);
  // True for plugins that declare no settings and ship no dedicated panel, such as the wallet.
  const hasNoContent = !(
    (supportsConfigForm && hasEditableConfig)
    || slug === 'i18n'
    || slug === 'odoo'
    || (slug === 'shipping' && isNative)
    || slug === 'remoteradar-jobs'
    || slug === 'support-hub'
    || slug === 'seo'
  );

  const headerActions = (
    <>
      {instances.length > 1 ? (
        <div className="min-w-[200px]">
          <Select
            value={selectedInstance?.installationId || ''}
            onValueChange={setSelectedInstallationId}
            disabled={isInstancesLoading || instanceBusy}
          >
            <SelectTrigger
              className="h-9 rounded-lg border-gray-100 bg-white text-sm font-semibold"
              aria-label={tf('selectInstance', 'Select instance')}
            >
              <SelectValue placeholder={tf('selectInstance', 'Select instance')} />
            </SelectTrigger>
            <SelectContent>
              {instances.map((instance) => (
                <SelectItem key={instance.installationId} value={instance.installationId}>
                  {instance.instanceKey}
                  {instance.enabled ? '' : ` (${tf('common.status.disabled', 'Disabled')})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="flex h-9 items-center gap-2.5 rounded-lg border border-gray-100 bg-white px-3">
        <span className="text-sm font-semibold text-gray-700">{tf('enablePlugin', 'Enable plugin')}</span>
        <Switch
          checked={instanceEnabled}
          disabled={instanceBusy}
          onCheckedChange={() => void toggleEnabled()}
          aria-label={tf('enablePlugin', 'Enable plugin')}
        />
      </div>

      {registry.registered ? (
        <Button
          onClick={() => void registry.save()}
          disabled={registry.saving || !registry.hasDirty}
          className={workspacePrimaryButtonClass}
        >
          {registry.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {registry.saving ? tf('saving', 'Saving...') : tf('save', 'Save changes')}
        </Button>
      ) : null}
    </>
  );

  const renderShell = (children: ReactNode) => (
    <PageShell
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          {pluginName}
          {isOfficial ? <OfficialBadge compact /> : null}
          {pluginVersion ? (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500">v{pluginVersion}</span>
          ) : null}
        </span>
      }
      description={pluginDescription}
      actions={headerActions}
    >
      <div className="grid gap-5 lg:grid-cols-[260px,minmax(0,1fr)]">
        {/* On narrow screens the settings come first; the plugin rail follows below them. */}
        <div className="order-last lg:order-first">
          <InstalledPluginsRail
            locale={locale}
            plugins={installedPlugins}
            selectedSlug={slug}
            officialSlugs={officialPluginSlugs}
            getText={getText}
          />
        </div>
        <div className="min-w-0 space-y-5">{children}</div>
      </div>
    </PageShell>
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-500">{tf('loadingWorkspace', 'Loading plugin workspace...')}</p>
        </div>
      </div>
    );
  }

  // The native affiliate adapter serves live partners/commissions/attributions
  // from native_affiliate_* tables through its own admin overview endpoint, so
  // the affiliate workspace renders that data view instead of the generic
  // config-driven workspace (the generic detail endpoint is still used on
  // platform deployments where the overview route does not exist).
  if (slug === 'affiliate' && affiliateOverviewQuery.isSuccess) {
    return renderShell(<AffiliateNativeWorkspace data={affiliateOverviewQuery.data} />);
  }

  if (error || !data) {
    // The RemoteRadar jobs administration reads live connector/source data
    // through the dedicated Core admin proxy, so it does not depend on the
    // plugin-detail endpoint (which Cloudflare-native instances do not
    // implement). Keep the panel available even when the generic workspace
    // cannot load — but only on instances that actually configure the jobs
    // service, so generic deployments still see the standard failure surface.
    if (slug === 'remoteradar-jobs' && jobsAdminAvailable) {
      return renderShell(<RemoteRadarJobsNativeWorkspace installationId="default" />);
    }

    return (
      <PageShell
        title={tf('unavailableTitle', 'Plugin unavailable')}
        description={tf('unavailableDescription', 'The plugin details could not be loaded.')}
        actions={
          <Button asChild variant="outline" className={workspaceOutlineButtonClass}>
            <Link href={`/${locale}/plugins`}>{getText('merchant.plugins.backToMarketplace', 'Back to plugins')}</Link>
          </Button>
        }
      >
        <WorkspaceNotice tone="warning">
          <span className="font-semibold">{pluginName}.</span>{' '}
          {tf('unavailableDescription', 'The plugin details could not be loaded.')}
        </WorkspaceNotice>
      </PageShell>
    );
  }

  return renderShell(
    <>
      {draftReadiness.configRequired && !draftReadiness.configReady ? (
        <WorkspaceNotice tone="warning">
          {tf(
            'missingRequired',
            'Complete these required settings before enabling: {fields}',
            { fields: describeMissingFields(slug, locale, draftReadiness.missingConfigFields, configSchema) },
          )}
        </WorkspaceNotice>
      ) : null}

      {slug === 'i18n' ? (
        <>
          <I18nNativeWorkspace installationId={installationId} disabled={!selectedInstance} />
          <I18nTranslationsPanel installationId={installationId} disabled={!selectedInstance} />
        </>
      ) : null}

      {slug === 'odoo' && !isNative ? (
        <OdooNativeWorkspace
          installationId={installationId}
          selectedInstance={selectedInstance}
          onSaveConfig={persistSelectedConfig}
        />
      ) : null}

      {slug === 'remoteradar-jobs' ? (
        <RemoteRadarJobsNativeWorkspace installationId={installationId} disabled={!selectedInstance} />
      ) : null}

      {slug === 'support-hub' ? (
        <>
          <SupportHubAiPanel configDraft={configDraft} onUpdateField={updateConfigField} />
          {configSchema ? (
            <SupportHubChannelsSection
              configSchema={configSchema}
              configDraft={configDraft}
              onUpdateField={updateConfigField}
            />
          ) : null}
        </>
      ) : null}

      {supportsConfigForm && hasEditableConfig ? (
        <>
          {slug === 'stripe' ? (
            configDraft.mode === 'live' ? (
              <WorkspaceNotice tone="warning">
                <span className="font-semibold">{tf('stripeLiveTitle', 'Live mode')}.</span>{' '}
                {tf('stripeLiveDescription', 'Stripe will create real charges after this configuration is saved.')}
              </WorkspaceNotice>
            ) : (
              <WorkspaceNotice tone="info">
                <span className="font-semibold">{tf('stripeTestTitle', 'Test mode')}.</span>{' '}
                {tf('stripeTestDescription', 'Stripe test data is active. No real charges will be created.')}
              </WorkspaceNotice>
            )
          ) : null}
          <PluginConfigSection
            slug={slug}
            configSchema={editorConfigSchema ?? {}}
            configDraft={configDraft}
            configMeta={selectedConfigMeta}
            jsonFieldDrafts={draftState.jsonDrafts}
            jsonFieldErrors={draftState.jsonErrors}
            onUpdateField={updateConfigField}
            onUpdateJsonField={updateJsonConfigField}
            title={slug === 'support-hub' ? tf('otherTitle', 'Other settings') : undefined}
          />
        </>
      ) : null}

      {/* Settings come first; the carrier console is a tool that runs against them. */}
      {slug === 'shipping' && isNative ? (
        <ShippingNativeWorkspace installationId={installationId} enabled={instanceEnabled} />
      ) : null}

      {isNative && ['smtp-email', 'stripe', 'odoo'].includes(slug) ? (
        <NativeConnectionTest slug={slug} disabled={!instanceEnabled} onEnable={toggleEnabled} />
      ) : null}

      {slug === 'seo' ? (
        <WorkspaceCard
          icon={<Search className="h-6 w-6" />}
          title={tf('seoTitle', 'SEO management')}
          description={tf(
            'seoDescription',
            'Redirects, audit, and settings live in the built-in SEO pages; storefront robots.txt, sitemap.xml, and product metadata are generated automatically.',
          )}
        >
          <div className="flex flex-wrap gap-3">
            {[
              { href: 'seo/redirects', label: tf('seoRedirects', 'Redirects') },
              { href: 'seo/audit', label: tf('seoAudit', 'SEO audit') },
              { href: 'seo', label: tf('seoSettings', 'SEO settings') },
            ].map((link) => (
              <Button key={link.href} asChild variant="outline" className={workspaceOutlineButtonClass}>
                <Link href={`/${locale}/${link.href}`}>{link.label}</Link>
              </Button>
            ))}
          </div>
        </WorkspaceCard>
      ) : null}

      {slug === 'support-hub' && canOpenInbox ? (
        <WorkspaceCard
          icon={<Inbox className="h-6 w-6" />}
          title={tf('inboxTitle', 'Support conversations')}
          description={tf(
            'inboxDescription',
            'Visitor messages and agent replies are handled on the Support conversations page.',
          )}
          actions={
            <Button asChild variant="outline" className={workspaceOutlineButtonClass}>
              <Link href={`/${locale}/support`}>{tf('openInbox', 'Open support conversations')}</Link>
            </Button>
          }
        >
          <p className="text-sm leading-6 text-gray-600">
            {tf(
              'inboxHint',
              'Replies sent there appear in the storefront chat within seconds, and a conversation answered by an agent stops using AI replies.',
            )}
          </p>
        </WorkspaceCard>
      ) : null}

      {hasNoContent ? (
        hasNativeWorkspace ? (
          // A plugin with an empty schema (e.g. the wallet) is usable as soon as it is enabled.
          <WorkspaceCard
            icon={<CheckCircle2 className="h-6 w-6" />}
            title={tf('noSettingsTitle', 'No settings required')}
            description={tf(
              'noSettingsDescription',
              'This plugin has no options to configure. It is ready to use once enabled.',
            )}
          />
        ) : (
          <WorkspaceNotice>
            <span className="font-semibold">{tf('noControlsTitle', 'No settings yet')}.</span>{' '}
            {tf('noControlsDescription', 'This plugin does not declare any settings or native Admin controls.')}
          </WorkspaceNotice>
        )
      ) : null}

      {/* The native runtime keeps a single, fixed "default" installation per plugin, so the
          header switch already covers everything there is to manage. */}
      {isNative ? null : (
        <PluginInstanceCard
          pluginSlug={slug}
          pluginName={pluginName}
          instances={instances}
          selectedInstallationId={selectedInstance?.installationId ?? null}
          onSelect={setSelectedInstallationId}
        />
      )}
    </>
  );
}

function describeMissingFields(
  slug: string,
  locale: string,
  fields: string[],
  configSchema: PluginConfigSchema | undefined,
): string {
  return fields.map((field) => getConfigFieldLabel(slug, locale, field, configSchema?.[field])).join(', ');
}
