'use client';

import Link from 'next/link';
import { AlertCircle, ArrowRight, ExternalLink, Loader2, Package, Palette, Settings2, ShieldCheck, Sliders } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useManagedMode } from '@/lib/managed-mode';
import { useOfficialCatalog, useProvisionManagedPackage } from '@/lib/hooks/use-api';
import { useLocale, useT } from 'shared/src/i18n/react';

function getSetupHref(href?: string | null, surface?: string | null): string | null {
  if (href) {
    return href;
  }

  switch (surface) {
    case 'settings':
      return '/settings';
    case 'themes':
      return '/themes';
    case 'plugins':
      return '/plugins';
    case 'dashboard':
      return '/package';
    default:
      return null;
  }
}

export default function PackagePage() {
  const { record, readiness, isManaged, isSuspended } = useManagedMode();
  const { data: catalog, isLoading } = useOfficialCatalog();
  const provisionMutation = useProvisionManagedPackage();
  const locale = useLocale();
  const t = useT();

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  if (!isManaged || !record) {
    return (
      <div className="space-y-6 p-6 lg:p-8">
        <Card className="rounded-[1.75rem] border-dashed">
          <CardHeader>
            <CardTitle>{getText('merchant.package.notManagedTitle', 'No managed package is active')}</CardTitle>
            <CardDescription>
              {getText(
                'merchant.package.notManagedDescription',
                'Activate a commercial package from Settings before using the package workspace.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/${locale}/settings`}>
                {getText('merchant.package.openSettings', 'Open settings')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const catalogItems = catalog?.items || [];
  const includedThemeItems = catalogItems.filter((item) => item.kind === 'theme');
  const includedPluginItems = catalogItems.filter((item) => item.kind === 'plugin');
  const installedThemeCount = readiness?.themesInstalled ?? includedThemeItems.filter((item) => item.installState !== 'not_installed').length;
  const activeThemeCount = readiness?.defaultThemeActive ? 1 : includedThemeItems.filter((item) => item.installState === 'active').length;
  const installedPluginCount = readiness?.pluginsInstalled ?? includedPluginItems.filter((item) => item.installState !== 'not_installed').length;
  const configuredPluginCount = readiness?.pluginsConfigured ?? includedPluginItems.filter(
    (item) => item.installState !== 'not_installed' && (item.configRequired ? item.configReady : true),
  ).length;
  const readinessComplete = readiness?.ready ?? false;

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <Card className="rounded-[1.75rem] border-gray-100 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                  {record.offerKind === 'theme_first_solution'
                    ? getText('merchant.package.solutionBadge', 'Theme-first solution')
                    : getText('merchant.package.managedBadge', 'Managed package')}
                </Badge>
                <Badge
                  variant="outline"
                  className={isSuspended ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-700'}
                >
                  {record.status}
                </Badge>
              </div>
              <CardTitle className="text-3xl tracking-tight">
                {record.displaySolutionName}
              </CardTitle>
              <CardDescription className="max-w-3xl text-sm leading-6">
                {record.description ||
                  getText(
                    'merchant.package.defaultDescription',
                    'This workspace collects the licensed assets, setup flow, and storefront handoff for your managed solution.'
                  )}
              </CardDescription>
            </div>

            <div className="grid gap-3 text-sm text-slate-600 md:min-w-[320px] md:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Brand</p>
                <p className="mt-1 font-medium text-slate-950">{record.displayBrandName}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Package</p>
                <p className="mt-1 font-medium text-slate-950">{record.packageName}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => provisionMutation.mutate()}
              disabled={isSuspended || provisionMutation.isPending}
              className="rounded-xl"
            >
              {provisionMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {getText('merchant.package.provisionAssets', 'Provision included assets')}
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={`/${locale}/themes`}>
                {getText('merchant.package.reviewThemes', 'Review themes')}
              </Link>
            </Button>
          </div>

          {isSuspended ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {getText(
                'merchant.package.suspendedDescription',
                'This commercial package is suspended. Existing assets remain visible, but new package installs and changes should be treated as frozen until billing is restored.'
              )}
            </div>
          ) : null}
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Card className="rounded-[1.75rem] border-gray-100 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              <CardTitle>{getText('merchant.package.setupTitle', 'Solution Setup')}</CardTitle>
            </div>
            <CardDescription>
              {getText(
                'merchant.package.setupDescription',
                'Complete these steps to move from package activation into an immediately sellable starter state.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {record.setupSteps.length === 0 ? (
              <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-slate-500">
                {getText('merchant.package.noSetupSteps', 'No guided setup steps have been defined for this package yet.')}
              </div>
            ) : (
              record.setupSteps.map((step, index) => {
                const targetHref = getSetupHref(step.href, step.surface);
                const isExternal = Boolean(targetHref && /^https?:\/\//.test(targetHref));

                return (
                  <div key={step.id} className="rounded-xl border border-gray-100 bg-slate-50/60 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                            Step {index + 1}
                          </Badge>
                          <span className="font-semibold text-slate-950">{step.title}</span>
                        </div>
                        {step.description ? (
                          <p className="text-sm leading-6 text-slate-600">{step.description}</p>
                        ) : null}
                      </div>
                      {targetHref ? (
                        <Button asChild variant="outline" className="rounded-xl">
                          <Link
                            href={targetHref}
                            target={isExternal ? '_blank' : undefined}
                            rel={isExternal ? 'noreferrer' : undefined}
                          >
                            {step.ctaLabel || getText('merchant.package.openStep', 'Open')}
                            {isExternal ? <ExternalLink className="ml-2 h-4 w-4" /> : <ArrowRight className="ml-2 h-4 w-4" />}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[1.75rem] border-gray-100 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                <CardTitle>{getText('merchant.package.readinessTitle', 'Launch Readiness')}</CardTitle>
              </div>
              <CardDescription>
                {getText(
                  'merchant.package.readinessDescription',
                  'A compact view of how close this managed solution is to an immediately sellable starter state.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-gray-100 bg-slate-50/60 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Themes ready</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">
                    {installedThemeCount}/{includedThemeItems.length || 0}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {activeThemeCount > 0
                      ? getText('merchant.package.themeReadyActive', 'A storefront theme is active.')
                      : getText('merchant.package.themeReadyNeedsActivation', 'No included storefront theme is active yet.')}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-slate-50/60 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Plugin setup</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">
                    {configuredPluginCount}/{includedPluginItems.length || 0}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {installedPluginCount === includedPluginItems.length && configuredPluginCount === includedPluginItems.length
                      ? getText('merchant.package.pluginsReady', 'All included plugins are provisioned and config-ready.')
                      : getText('merchant.package.pluginsNeedAttention', 'Some included plugins still need provisioning or configuration.')}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border px-4 py-3 text-sm font-medium">
                {readinessComplete ? (
                  <div className="text-emerald-700">
                    {getText(
                      'merchant.package.readinessComplete',
                      'This managed solution looks launch-ready: the default theme is active and the companion capabilities are provisioned.'
                    )}
                  </div>
                ) : (
                  <div className="text-amber-700">
                    {getText(
                      'merchant.package.readinessIncomplete',
                      'This package still needs setup attention before it reaches the target sellable starter state.'
                    )}
                  </div>
              )}
            </div>

              {readiness && readiness.missingThemeSlugs.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Missing included themes: {readiness.missingThemeSlugs.join(', ')}
                </div>
              ) : null}

              {readiness && readiness.pluginDetails.some((item) => item.installed && item.configRequired && !item.configReady) ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Plugins still needing configuration:{' '}
                  {readiness.pluginDetails
                    .filter((item) => item.installed && item.configRequired && !item.configReady)
                    .map((item) => item.slug)
                    .join(', ')}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-gray-100 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-blue-600" />
                <CardTitle>{getText('merchant.package.includedThemes', 'Included Themes')}</CardTitle>
              </div>
              <CardDescription>
                {getText('merchant.package.includedThemesDescription', 'The storefront themes available under this managed package.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="text-sm text-slate-500">{getText('common.status.loading', 'Loading...')}</div>
              ) : includedThemeItems.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-slate-500">
                  {getText('merchant.package.noIncludedThemes', 'No included themes are currently visible.')}
                </div>
              ) : (
                includedThemeItems.map((item) => (
                  <div key={item.slug} className="flex items-center justify-between rounded-xl border border-gray-100 bg-slate-50/60 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-950">{item.name}</p>
                      <p className="text-sm text-slate-500 capitalize">{item.installState.replace('_', ' ')}</p>
                    </div>
                    <Badge variant="outline">{item.version}</Badge>
                  </div>
                ))
              )}
              <Button asChild variant="outline" className="w-full rounded-xl">
                <Link href={`/${locale}/themes`}>
                  <Palette className="mr-2 h-4 w-4" />
                  {getText('merchant.package.openThemes', 'Open themes')}
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-gray-100 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-blue-600" />
                <CardTitle>{getText('merchant.package.includedPlugins', 'Included Plugins')}</CardTitle>
              </div>
              <CardDescription>
                {getText('merchant.package.includedPluginsDescription', 'The companion capabilities shipped with this managed package.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="text-sm text-slate-500">{getText('common.status.loading', 'Loading...')}</div>
              ) : includedPluginItems.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-slate-500">
                  {getText('merchant.package.noIncludedPlugins', 'No included plugins are currently visible.')}
                </div>
              ) : (
                includedPluginItems.map((item) => (
                  <div key={item.slug} className="flex items-center justify-between rounded-xl border border-gray-100 bg-slate-50/60 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-950">{item.name}</p>
                      <p className="text-sm text-slate-500 capitalize">{item.installState.replace('_', ' ')}</p>
                    </div>
                    <Badge variant="outline">{item.version}</Badge>
                  </div>
                ))
              )}
              <Button asChild variant="outline" className="w-full rounded-xl">
                <Link href={`/${locale}/plugins`}>
                  <Sliders className="mr-2 h-4 w-4" />
                  {getText('merchant.package.openPlugins', 'Open plugins')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="rounded-[1.75rem] border-gray-100 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            <CardTitle>{getText('merchant.package.supportTitle', 'Support & Package Info')}</CardTitle>
          </div>
          <CardDescription>
            {getText(
              'merchant.package.supportDescription',
              'Low-visibility package details for audit, support, and commercial operations.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-gray-100 bg-slate-50/60 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Activation</p>
            <p className="mt-1 font-medium text-slate-950">{record.activationCode}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-slate-50/60 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Default Theme</p>
            <p className="mt-1 font-medium text-slate-950">{record.defaultThemeSlug || 'Not set'}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-slate-50/60 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Support</p>
            <p className="mt-1 font-medium text-slate-950">{record.supportEmail || 'Not configured'}</p>
          </div>
        </CardContent>
      </Card>

      {!catalog?.marketOnline ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <span>
              {catalog?.marketError ||
                getText(
                  'merchant.package.marketOffline',
                  'Official market data is currently unavailable. Package setup steps remain visible, but live asset metadata may be incomplete.'
                )}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
