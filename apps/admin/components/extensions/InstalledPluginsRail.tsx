'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PluginMetaWithState } from '@/lib/types';
import type { ManagedPackageDefinition } from '@/lib/managed-mode';
import { ChevronRight, Puzzle, Settings2, ShieldCheck } from 'lucide-react';

interface InstalledPluginsRailProps {
  locale: string;
  plugins: PluginMetaWithState[];
  selectedSlug?: string;
  officialSlugs?: Set<string>;
  getText: (key: string, fallback: string) => string;
  managedPackage?: ManagedPackageDefinition | null;
}

type RailStatusTone = 'emerald' | 'amber' | 'slate';

function resolvePluginStatus(
  plugin: PluginMetaWithState,
  getText: InstalledPluginsRailProps['getText'],
): { label: string; tone: RailStatusTone } {
  if (plugin.enabled) {
    return { label: getText('merchant.plugins.enabled', 'Enabled'), tone: 'emerald' };
  }

  if (plugin.configRequired && !plugin.configReady) {
    return { label: getText('merchant.plugins.needsConfiguration', 'Needs config'), tone: 'amber' };
  }

  return { label: getText('merchant.plugins.installed', 'Installed'), tone: 'slate' };
}

const STATUS_DOT: Record<RailStatusTone, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  slate: 'bg-slate-300',
};

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
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
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
          <Button asChild variant="outline" size="icon" className="h-11 w-11 rounded-lg shrink-0">
            <Link href={`/${locale}/plugins`}>
              <Settings2 className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <div className="mb-2 flex items-center justify-between px-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
            {getText('merchant.plugins.installedCollection', 'Installed plugins')}
          </p>
          <Badge variant="secondary" className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {plugins.length}
          </Badge>
        </div>

        {plugins.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            {getText('merchant.plugins.noPluginsInstalled', 'No plugins installed.')}
          </div>
        ) : (
          <div className="space-y-1">
            {plugins.map((plugin) => {
              const isSelected = plugin.slug === selectedSlug;
              const isOfficial = officialSlugs?.has(plugin.slug) || plugin.source === 'official-market';
              const status = resolvePluginStatus(plugin, getText);

              return (
                <Link
                  key={plugin.slug}
                  href={`/${locale}/plugins/${plugin.slug}`}
                  title={plugin.name}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors',
                    isSelected
                      ? 'bg-blue-50 ring-1 ring-blue-200'
                      : 'hover:bg-slate-50'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                      isSelected
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600'
                    )}
                  >
                    <Puzzle className="h-4.5 w-4.5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className={cn('truncate text-sm font-semibold', isSelected ? 'text-blue-700' : 'text-slate-900')}>
                        {plugin.name}
                      </p>
                      {isOfficial ? (
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-label="Official" />
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status.tone])} aria-hidden />
                      <span className="truncate">{status.label}</span>
                      <span className="text-slate-300">·</span>
                      <span>v{plugin.version}</span>
                    </div>
                  </div>

                  <ChevronRight className={cn('h-4 w-4 shrink-0 transition-colors', isSelected ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-500')} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
