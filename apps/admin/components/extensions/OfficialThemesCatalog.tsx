'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, Loader2, Sparkles, Search, ShieldCheck, WifiOff } from 'lucide-react';
import type { OfficialCatalogItem } from '@/lib/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExtensionAvatar, OfficialBadge } from '@/components/extensions/ExtensionVisuals';
import type { ManagedPackageDefinition } from '@/lib/managed-mode';

interface OfficialThemesCatalogProps {
  locale: string;
  target: 'shop' | 'admin';
  items: OfficialCatalogItem[];
  isLoading: boolean;
  marketOnline: boolean;
  marketError?: string;
  officialMarketOnly: boolean;
  marketplaceReady: boolean;
  installingSlug?: string | null;
  isProvisioningPackage?: boolean;
  isActivating: boolean;
  onInstall: (item: OfficialCatalogItem) => void;
  onActivate: (item: OfficialCatalogItem) => void;
  getText: (key: string, fallback: string) => string;
  managedPackage?: ManagedPackageDefinition | null;
}

function formatPrice(item: OfficialCatalogItem): string {
  if (item.pricingModel === 'free' || item.price <= 0) {
    return 'Free';
  }
  return `${item.pricingModel === 'subscription' ? 'Subscription' : 'One-time'} · ${item.currency} ${item.price}`;
}

export function OfficialThemesCatalog({
  locale,
  target,
  items,
  isLoading,
  marketOnline,
  marketError,
  officialMarketOnly,
  marketplaceReady,
  installingSlug,
  isProvisioningPackage = false,
  isActivating,
  onInstall,
  onActivate,
  getText,
  managedPackage,
}: OfficialThemesCatalogProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const isThemeFirstSolution = managedPackage?.offerKind === 'theme_first_solution';

  const visibleItems = useMemo(() => {
    if (!managedPackage) {
      return items;
    }
    const allowed = new Set(managedPackage.includedThemes);
    return items.filter((item) => allowed.has(item.slug));
  }, [items, managedPackage]);

  const categories = useMemo(() => {
    return Array.from(new Set(visibleItems.map((item) => item.category).filter(Boolean))).sort();
  }, [visibleItems]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return visibleItems.filter((item) => {
      if (category !== 'all' && item.category !== category) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [item.name, item.slug, item.description, item.author, item.category]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [category, visibleItems, search]);

  if (target !== 'shop') {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
        <p className="font-semibold text-slate-900">
          {getText('merchant.themes.noOfficialAdminThemes', 'No official Admin themes in this launch wave.')}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {getText('merchant.themes.noOfficialAdminThemesDescription', 'The v1 official catalog only includes storefront themes for the Shop target.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-semibold tracking-tight">
            {managedPackage
              ? getText('merchant.themes.includedThemes', 'Included themes')
              : getText('merchant.themes.officialCatalog', 'Official theme marketplace')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {managedPackage
              ? getText(
                  'merchant.themes.includedThemesDescription',
                  'These storefront themes are included in your managed package. Activate the approved theme directly from Merchant Admin.'
                )
              : getText(
                  'merchant.themes.officialCatalogDescription',
                  'Browse the official storefront themes and activate them directly from Merchant Admin.'
                )}
          </p>
        </div>

        {managedPackage ? (
          <Alert className="border-blue-200 bg-blue-50 text-blue-900">
            <AlertTitle>{getText('merchant.themes.managedModeActive', 'Managed Mode active')}</AlertTitle>
            <AlertDescription>
              {isThemeFirstSolution
                ? `${managedPackage.displaySolutionName} is delivered as a theme-first solution package. Use the package workspace for guided setup and launch tasks.`
                : `${managedPackage.displaySolutionName} only exposes the licensed storefront themes.`}
            </AlertDescription>
          </Alert>
        ) : null}

        {!isLoading && !marketOnline ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <WifiOff className="h-4 w-4" />
            <AlertTitle>{getText('merchant.extensions.marketOffline', 'Official market is offline')}</AlertTitle>
            <AlertDescription>
              {marketError || getText('merchant.extensions.marketOfflineThemesDescription', 'Theme activation still works for installed themes, but new installs are unavailable right now.')}
            </AlertDescription>
          </Alert>
        ) : null}

        {!isLoading && officialMarketOnly ? (
          <Alert className="border-blue-200 bg-blue-50 text-blue-900">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{getText('merchant.extensions.officialOnly', 'Official catalog only')}</AlertTitle>
            <AlertDescription>
              {getText('merchant.extensions.officialOnlyThemesDescription', 'Local ZIP theme installs are disabled in this environment.')}
            </AlertDescription>
          </Alert>
        ) : null}

        {!isLoading && !marketplaceReady && !managedPackage && visibleItems.some((item) => item.pricingModel !== 'free') ? (
          <Alert className="border-slate-200 bg-slate-50 text-slate-900">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{getText('merchant.extensions.platformConnectionRequired', 'Platform connection required')}</AlertTitle>
            <AlertDescription>
              {getText('merchant.extensions.platformConnectionRequiredThemesDescription', 'Connect this instance to Jiffoo Platform and bind the default store before installing official themes.')}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={getText('merchant.extensions.searchOfficial', 'Search official themes')}
              className="rounded-xl pl-9"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full rounded-xl md:w-[220px]">
              <SelectValue placeholder={getText('common.labels.category', 'Category')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{getText('common.labels.all', 'All')}</SelectItem>
              {categories.map((itemCategory) => (
                <SelectItem key={itemCategory} value={itemCategory} className="capitalize">
                  {itemCategory}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={`official-theme-skeleton-${index}`} className="rounded-[1.25rem] border-gray-100">
              <CardHeader className="space-y-3 px-4 py-4">
                <div className="h-6 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4">
                <div className="h-24 animate-pulse rounded-[1rem] bg-slate-100" />
                <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
              </CardContent>
            </Card>
          ))
        ) : filteredItems.length === 0 ? (
          <div className="col-span-full rounded-[1.75rem] border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-muted-foreground">
            {managedPackage
              ? getText('merchant.extensions.noIncludedThemes', 'No licensed storefront themes are available for this package.')
              : getText('merchant.extensions.noOfficialMatches', 'No official themes match the current filter.')}
        </div>
        ) : (
          filteredItems.map((item) => {
            const solutionMeta = item.solutionPackage;
            const controlPlaneSolution = item.solutionOffer;
            const hasSolutionSemantics = solutionMeta?.offerKind === 'theme_first_solution' || controlPlaneSolution?.offerKind === 'theme_first_solution';
            const isInstalling = installingSlug === item.slug || (isProvisioningPackage && solutionMeta?.offerKind === 'theme_first_solution');
            const isManagedDefaultTheme = solutionMeta?.defaultTheme ?? managedPackage?.defaultThemeSlug === item.slug;
            const canInstall = item.installState === 'not_installed' && marketOnline && marketplaceReady && item.availableInMarket;
            const effectiveCanInstall =
              managedPackage && item.installState === 'not_installed'
                ? managedPackage.status !== 'SUSPENDED'
                : canInstall;
            const actionLabel =
              item.installState === 'active'
                ? getText('merchant.themes.active', 'Active')
                : item.installState === 'installed'
                  ? getText('merchant.themes.activate', 'Activate')
                  : hasSolutionSemantics
                    ? (controlPlaneSolution?.ctaLabel || getText('merchant.package.provisionSolution', 'Provision solution'))
                    : getText('merchant.themes.install', 'Install');

              const handlePrimaryAction = () => {
                if (item.installState === 'not_installed') {
                  onInstall(item);
                  return;
                }

                onActivate(item);
              };

              const priceLabel = managedPackage
                ? getText('merchant.themes.includedInPackage', 'Included in package')
                : formatPrice(item);

              return (
              <Card key={item.slug} className="overflow-hidden rounded-[1.15rem] border-gray-100 shadow-sm">
                <div className="h-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-3 text-white">
                  <div className="flex h-full flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <ExtensionAvatar
                          slug={item.slug}
                          name={item.name}
                          kind="theme"
                          thumbnailUrl={item.thumbnailUrl}
                          className="h-8 w-8 shrink-0 border border-white/15"
                        />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <OfficialBadge compact className="border-white/15 bg-white/10 text-white" />
                            {hasSolutionSemantics ? (
                              <Badge variant="outline" className="rounded-lg border-white/20 bg-white/10 text-white">
                                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                                {controlPlaneSolution?.badgeLabel || getText('merchant.package.solutionBadge', 'Theme-first solution')}
                              </Badge>
                            ) : null}
                            {isManagedDefaultTheme ? (
                              <Badge variant="outline" className="rounded-lg border-white/20 bg-white/10 text-white">
                                {getText('merchant.package.defaultThemeBadge', 'Default package theme')}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                            {getText('merchant.themes.embeddedFullTheme', 'Embedded Full Theme')}
                          </p>
                          <h3 className="mt-1.5 text-lg font-semibold leading-tight">{item.name}</h3>
                        </div>
                      </div>
                      <Sparkles className="h-5 w-5 text-white/70" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="rounded-lg border-white/20 bg-white/10 px-2 py-0.5 text-[10px] text-white">
                        {priceLabel}
                      </Badge>
                      <Badge variant="outline" className="rounded-lg border-white/20 bg-white/10 px-2 py-0.5 text-[10px] text-white capitalize">
                        {item.installState.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </div>

                <CardHeader className="space-y-2 px-4 pb-0 pt-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                      v{item.version} {getText('common.labels.by', 'by')} {item.author}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="rounded-lg capitalize">
                      {item.category}
                    </Badge>
                    <Badge variant="outline" className="rounded-lg capitalize">
                      {item.releaseStatus === 'published'
                        ? getText('merchant.extensions.releasePublished', 'Published')
                        : item.releaseStatus === 'offline'
                          ? getText('merchant.extensions.releaseOffline', 'Offline')
                          : getText('merchant.extensions.releaseCatalogOnly', 'Catalog Only')}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 px-4 pb-4 pt-2">
                  <p className="min-h-[3.75rem] line-clamp-3 text-sm leading-5 text-slate-600">{item.description}</p>

                  {hasSolutionSemantics ? (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-sm text-blue-900">
                      {isManagedDefaultTheme
                        ? getText(
                            'merchant.package.defaultThemeExplanation',
                            'This theme is the default storefront surface for the managed solution package. Companion gateway capabilities and setup steps are handled from Your Package.'
                          )
                        : controlPlaneSolution?.summary ||
                          getText(
                            'merchant.package.includedThemeExplanation',
                            'This theme is included through the managed solution package. Install or activate it here, then continue setup from Your Package.'
                          )}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {getText('merchant.extensions.deliveryMode', 'Delivery')}
                      </p>
                      <p className="mt-1 font-medium text-slate-900">{item.deliveryMode}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {getText('merchant.extensions.downloads', 'Downloads')}
                      </p>
                      <p className="mt-1 font-medium text-slate-900">{item.downloads ?? 0}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <Button
                      onClick={handlePrimaryAction}
                      disabled={item.installState === 'active' || (item.installState === 'not_installed' && (!effectiveCanInstall || isInstalling)) || isActivating}
                      className="h-10 w-full rounded-lg"
                    >
                      {isInstalling || isActivating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {actionLabel}
                    </Button>

                    {hasSolutionSemantics ? (
                      <Button asChild variant="outline" className="w-full rounded-xl">
                        <Link href={`/${locale}/package`}>
                          {getText('merchant.package.openPackageWorkspace', 'Open Your Package')}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
