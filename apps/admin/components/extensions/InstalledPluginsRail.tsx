'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PluginMetaWithState } from '@/lib/types';
import { ExtensionAvatar, OfficialBadge } from '@/components/extensions/ExtensionVisuals';
import type { ManagedPackageDefinition } from '@/lib/managed-mode';
import { ChevronRight, Settings2 } from 'lucide-react';

interface InstalledPluginsRailProps {
  locale: string;
  plugins: PluginMetaWithState[];
  selectedSlug?: string;
  officialSlugs?: Set<string>;
  getText: (key: string, fallback: string) => string;
  managedPackage?: ManagedPackageDefinition | null;
}

function resolvePluginStatus(plugin: PluginMetaWithState, getText: InstalledPluginsRailProps['getText']): string {
  if (plugin.enabled) {
    return getText('merchant.plugins.enabled', 'Enabled');
  }

  if (plugin.configRequired && !plugin.configReady) {
    return getText('merchant.plugins.needsConfiguration', 'Needs config');
  }

  return getText('merchant.plugins.installed', 'Installed');
}

export function InstalledPluginsRail({
  locale,
  plugins,
  selectedSlug,
  officialSlugs,
  getText,
  managedPackage,
}: InstalledPluginsRailProps) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-24">
      <div className="rounded-[1.75rem] border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-blue-600">
              {getText('merchant.plugins.installedCollection', 'Installed plugins')}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">
              {managedPackage
                ? getText('merchant.plugins.licensedPluginCenter', 'Licensed plugins')
                : getText('merchant.plugins.pluginCenter', 'Plugin center')}
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {managedPackage
                ? getText(
                    'merchant.plugins.licensedPluginCenterDescription',
                    'Open the plugins included in your managed package and adjust their configuration without exposing the public marketplace.'
                  )
                : getText(
                    'merchant.plugins.pluginCenterDescription',
                    'Jump straight into each plugin workspace, keep configuration close, and manage the official catalog from one place.'
                  )}
            </p>
          </div>
          <Button asChild variant="outline" size="icon" className="h-11 w-11 rounded-2xl shrink-0">
            <Link href={`/${locale}/plugins`}>
              <Settings2 className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-gray-100 bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between px-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            {getText('merchant.plugins.installedCollection', 'Installed plugins')}
          </p>
          <Badge variant="secondary" className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {plugins.length}
          </Badge>
        </div>

        {plugins.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            {getText('merchant.plugins.noPluginsInstalled', 'No plugins installed.')}
          </div>
        ) : (
          <div className="space-y-2">
            {plugins.map((plugin) => {
              const isSelected = plugin.slug === selectedSlug;
              const isOfficial = officialSlugs?.has(plugin.slug) || plugin.source === 'official-market';

              return (
                <Link
                  key={plugin.slug}
                  href={`/${locale}/plugins/${plugin.slug}`}
                  className={cn(
                    'group flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all',
                    isSelected
                      ? 'border-blue-200 bg-blue-50 shadow-sm'
                      : 'border-transparent bg-slate-50 hover:border-slate-200 hover:bg-white'
                  )}
                >
                  <ExtensionAvatar
                    slug={plugin.slug}
                    name={plugin.name}
                    kind="plugin"
                    className="h-11 w-11 shrink-0"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-slate-950">{plugin.name}</p>
                      {isOfficial ? <OfficialBadge compact /> : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span className="truncate">v{plugin.version}</span>
                      <span className="text-slate-300">•</span>
                      <span className="truncate">{resolvePluginStatus(plugin, getText)}</span>
                    </div>
                  </div>

                  <ChevronRight className={cn('h-4 w-4 shrink-0 text-slate-300 transition-colors', isSelected ? 'text-blue-600' : 'group-hover:text-slate-500')} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
