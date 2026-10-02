/**
 * Theme Marketplace — reference design layout:
 * page header with 我的主题/上传主题 actions, featured hero banner, style
 * category chips with live counts, search + sort toolbar, and a 4-column
 * theme card grid with mini dashboard previews, palette dots, and
 * 使用/使用中 state buttons.
 *
 * Data: the official theme catalog drives the grid; an empty catalog falls
 * back to the reference style cards so the layout stays complete.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { themesApi, unwrapApiResponse, type OfficialCatalogItem } from '@/lib/api';
import {
  useActivateTheme,
  useActiveTheme,
  useInstallOfficialExtension,
  useOfficialCatalog,
  usePlatformConnectionStatus,
  useProvisionManagedPackage,
  useRollbackTheme,
  useThemes,
} from '@/lib/hooks/use-api';
import type { ActiveTheme, ThemeMeta } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, Loader2, LayoutGrid, RotateCcw, Search, Sparkles, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useLocale, useT } from 'shared/src/i18n/react';
import { resolveApiErrorMessage } from '@/lib/error-utils';
import { PlatformConnectionCard } from '@/components/extensions/PlatformConnectionCard';
import { useManagedMode } from '@/lib/managed-mode';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Style palettes                                                      */

interface StyleTint {
  page: string
  sidebar: string
  panel: string
  accent: string
  accent2: string
  dark?: boolean
}

interface StyleCard {
  slug: string
  name: string
  description: string
  tag: TagKey
  tint: StyleTint
  dots: string[]
}

const TAG_KEYS = {
  minimal: 'merchant.themes.market.tagMinimal',
  business: 'merchant.themes.market.tagBusiness',
  dark: 'merchant.themes.market.tagDark',
  fresh: 'merchant.themes.market.tagFresh',
  creative: 'merchant.themes.market.tagCreative',
} as const;

const TAGS = ['minimal', 'business', 'dark', 'fresh', 'creative'] as const;
type TagKey = (typeof TAGS)[number];

const DEMO_STYLES: StyleCard[] = [
  {
    slug: 'style-modern-minimal', name: '现代简约', tag: 'minimal',
    description: '简洁现代，专注于提升管理效率',
    tint: { page: '#eef4ff', sidebar: '#dbe7fd', panel: '#ffffff', accent: '#3b82f6', accent2: '#8b5cf6' },
    dots: ['#3b82f6', '#8b5cf6', '#a78bfa', '#cbd5e1'],
  },
  {
    slug: 'style-dark-tech', name: '深色科技', tag: 'dark',
    description: '深色模式，适合夜间使用',
    tint: { page: '#0f172a', sidebar: '#1e293b', panel: '#334155', accent: '#38bdf8', accent2: '#a855f7', dark: true },
    dots: ['#2563eb', '#a855f7', '#ec4899', '#0f172a'],
  },
  {
    slug: 'style-fresh-nature', name: '清新自然', tag: 'fresh',
    description: '清新舒适的视觉风格',
    tint: { page: '#ecfdf5', sidebar: '#d1fae5', panel: '#ffffff', accent: '#10b981', accent2: '#14b8a6' },
    dots: ['#059669', '#34d399', '#6ee7b7', '#fcd34d'],
  },
  {
    slug: 'style-elegant-business', name: '优雅商务', tag: 'business',
    description: '适合企业级管理场景',
    tint: { page: '#f5f3ff', sidebar: '#e2d9fd', panel: '#ffffff', accent: '#7c3aed', accent2: '#a855f7' },
    dots: ['#7c3aed', '#a855f7', '#c4b5fd', '#e9d5ff'],
  },
  {
    slug: 'style-warm-minimal', name: '温暖简约', tag: 'minimal',
    description: '柔和的色彩，舒适的视觉体验',
    tint: { page: '#fff7ed', sidebar: '#ffedd5', panel: '#ffffff', accent: '#f97316', accent2: '#f59e0b' },
    dots: ['#f97316', '#fbbf24', '#fda4af', '#fed7aa'],
  },
  {
    slug: 'style-ocean-heart', name: '海洋之心', tag: 'business',
    description: '清爽的蓝色主题，专注高效',
    tint: { page: '#eff6ff', sidebar: '#dbeafe', panel: '#ffffff', accent: '#2563eb', accent2: '#0ea5e9' },
    dots: ['#1d4ed8', '#3b82f6', '#38bdf8', '#bfdbfe'],
  },
  {
    slug: 'style-pure-white', name: '极简白', tag: 'minimal',
    description: '极致简约，回归本质',
    tint: { page: '#f8fafc', sidebar: '#e2e8f0', panel: '#ffffff', accent: '#475569', accent2: '#94a3b8' },
    dots: ['#0f172a', '#475569', '#94a3b8', '#cbd5e1'],
  },
  {
    slug: 'style-vivid-creative', name: '炫彩创意', tag: 'creative',
    description: '充满活力的渐变风格',
    tint: { page: 'linear-gradient(135deg, #ede9fe 0%, #fce7f3 100%)', sidebar: '#e9d5ff', panel: '#ffffff', accent: '#a855f7', accent2: '#ec4899' },
    dots: ['#7c3aed', '#c026d3', '#f97316', '#fbbf24'],
  },
];

const FALLBACK_TINTS: StyleTint[] = DEMO_STYLES.map((style) => style.tint);

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function tintForSlug(slug: string): StyleTint {
  return FALLBACK_TINTS[hashString(slug) % FALLBACK_TINTS.length];
}

function dotsForSlug(slug: string): string[] {
  const style = DEMO_STYLES[hashString(slug) % DEMO_STYLES.length];
  return style.dots;
}

function tagForSlug(slug: string): TagKey {
  return TAGS[hashString(`${slug}:tag`) % TAGS.length];
}

/* ------------------------------------------------------------------ */
/* Mini dashboard preview (pure CSS/SVG mockup, tinted per theme)      */

function MiniPreview({ tint, className }: { tint: StyleTint; className?: string }) {
  const chipBg = tint.dark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.05)';
  const panelBg = tint.panel;
  const barColor = tint.dark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.18)';
  const lineColor = tint.accent;
  const lineColor2 = tint.accent2;

  return (
    <div
      aria-hidden
      className={cn('overflow-hidden rounded-lg border border-black/5 shadow-sm', className)}
      style={{ background: tint.page }}
    >
      <div className="flex h-full">
        {/* mini sidebar */}
        <div className="flex w-[17%] flex-col gap-1.5 p-2" style={{ background: tint.sidebar }}>
          <div className="h-2 w-2 rounded-full" style={{ background: lineColor }} />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-1 rounded-full" style={{ background: barColor, width: `${80 - index * 8}%` }} />
          ))}
        </div>
        {/* main panel */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2">
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-8 rounded-full" style={{ background: barColor }} />
            <div className="ml-auto h-1.5 w-4 rounded-full" style={{ background: chipBg }} />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-md p-1.5" style={{ background: panelBg }}>
                <div className="h-1 w-3/4 rounded-full" style={{ background: chipBg }} />
                <div className="mt-1 h-1.5 w-1/2 rounded-full" style={{ background: index === 0 ? lineColor : barColor }} />
              </div>
            ))}
          </div>
          <div className="flex min-h-0 flex-1 items-end gap-1.5">
            <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-full min-h-[24px] flex-1 rounded-md" style={{ background: panelBg }}>
              <path d="M0 24 L14 18 L28 22 L42 12 L56 17 L70 9 L84 13 L100 6" fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" />
              <path d="M0 26 L14 22 L28 24 L42 18 L56 21 L70 15 L84 18 L100 12" fill="none" stroke={lineColor2} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
            </svg>
            <svg viewBox="0 0 36 36" className="h-full max-h-[36px] shrink-0" style={{ width: 36 }}>
              <circle cx="18" cy="18" r="12" fill="none" stroke={chipBg} strokeWidth="7" />
              <circle cx="18" cy="18" r="12" fill="none" stroke={lineColor} strokeWidth="7" strokeDasharray="46 76" strokeLinecap="round" transform="rotate(-90 18 18)" />
              <circle cx="18" cy="18" r="12" fill="none" stroke={lineColor2} strokeWidth="7" strokeDasharray="20 76" strokeDashoffset="-48" strokeLinecap="round" transform="rotate(-90 18 18)" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Card/hero preview: prefer the official catalog thumbnail artwork and fall
 * back to the generated mini mockup when a theme has none (or it fails to
 * load).
 */
const ARTIFACTS_VISUALS_BASE = 'https://get.jiffoo.com/official-artifacts/visuals/themes';

function ThemePreview({ item, className }: { item: OfficialCatalogItem; className?: string }) {
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const candidateSources = [
    item.thumbnailUrl,
    `${ARTIFACTS_VISUALS_BASE}/${item.slug}/thumbnail.jpg`,
  ].filter((source): source is string => Boolean(source) && !failedSources.includes(source as string));
  const showImage = candidateSources.length > 0;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={candidateSources[0]}
        alt={item.name}
        className={cn('object-cover', className)}
        onError={() => setFailedSources((sources) => [...sources, candidateSources[0]])}
      />
    );
  }
  return <MiniPreview tint={tintForSlug(item.slug)} className={className} />;
}

/* ------------------------------------------------------------------ */
/* Marketplace component                                               */

export function ThemeMarketplace() {
  const queryClient = useQueryClient();
  const locale = useLocale();
  const t = useT();

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const [mineOnly, setMineOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTag, setActiveTag] = useState<'all' | TagKey>('all');
  const [sortMode, setSortMode] = useState<'default' | 'name'>('default');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [themeType, setThemeType] = useState<'pack' | 'app'>('pack');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [configText, setConfigText] = useState('{}');

  const { record } = useManagedMode();
  const { data: officialCatalogData, isLoading: isCatalogLoading } = useOfficialCatalog();
  const { data: platformConnectionStatus } = usePlatformConnectionStatus();
  const { data: installedThemes } = useThemes('shop');
  const { data: activeTheme } = useActiveTheme('shop');

  const installOfficialMutation = useInstallOfficialExtension();
  const provisionManagedPackageMutation = useProvisionManagedPackage();
  const activateMutation = useActivateTheme();
  const rollbackMutation = useRollbackTheme();

  const [installingSlug, setInstallingSlug] = useState<string | null>(null);

  const officialMarketOnly = Boolean(officialCatalogData?.officialMarketOnly);
  const canUploadLocalZip = !record && !officialMarketOnly;

  /* ---------------- data shaping ---------------- */

  const realItems = useMemo(
    () => (officialCatalogData?.items || []).filter((item) => item.kind === 'theme' && (item.target || 'shop') === 'shop'),
    [officialCatalogData?.items],
  );
  const usingDemoStyles = !realItems.length && !isCatalogLoading;

  const demoItems = useMemo<OfficialCatalogItem[]>(
    () =>
      DEMO_STYLES.map((style, index) => ({
        slug: style.slug,
        name: style.name,
        kind: 'theme' as const,
        version: '1.0.0',
        author: 'Jiffoo',
        description: style.description,
        category: style.tag,
        deliveryMode: 'package-managed' as const,
        pricingModel: 'free' as const,
        price: 0,
        currency: 'USD',
        installState: index === 0 ? ('active' as const) : ('not_installed' as const),
        releaseStatus: 'published' as const,
        source: 'catalog' as const,
        availableInMarket: true,
      })),
    [],
  );

  const items = usingDemoStyles ? demoItems : realItems;

  const tagOf = (item: OfficialCatalogItem): TagKey => {
    if (usingDemoStyles) {
      return DEMO_STYLES.find((style) => style.slug === item.slug)?.tag ?? 'minimal';
    }
    return tagForSlug(item.slug);
  };

  const tagCounts = useMemo(() => {
    const counts: Record<TagKey, number> = { minimal: 0, business: 0, dark: 0, fresh: 0, creative: 0 };
    for (const item of items) counts[tagOf(item)] += 1;
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, usingDemoStyles]);

  const activeSlug = activeTheme?.slug;
  const featured = useMemo(() => {
    const active = items.find((item) => item.slug === activeSlug);
    return active ?? items[0] ?? null;
  }, [items, activeSlug]);

  const visibleItems = useMemo(() => {
    let list = [...items];
    if (mineOnly) list = list.filter((item) => item.installState !== 'not_installed');
    if (activeTag !== 'all') list = list.filter((item) => tagOf(item) === activeTag);
    if (searchTerm.trim()) {
      const keyword = searchTerm.trim().toLowerCase();
      list = list.filter(
        (item) => item.name.toLowerCase().includes(keyword) || item.description.toLowerCase().includes(keyword),
      );
    }
    if (sortMode === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, mineOnly, activeTag, searchTerm, sortMode, usingDemoStyles]);

  const themeList: ThemeMeta[] = installedThemes?.items || [];

  /* ---------------- effects & mutations ---------------- */

  useEffect(() => {
    const sourceConfig =
      activeTheme?.config && typeof activeTheme.config === 'object' ? activeTheme.config : {};
    try {
      setConfigText(JSON.stringify(sourceConfig, null, 2));
    } catch {
      setConfigText('{}');
    }
  }, [activeTheme]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => themesApi.installFromZip('shop', file).then(unwrapApiResponse),
    onSuccess: () => {
      toast.success(getText('merchant.themes.installSuccess', 'Theme installed successfully'));
      setUploadOpen(false);
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      queryClient.invalidateQueries({ queryKey: ['official-catalog'] });
    },
    onError: (error: unknown) => {
      toast.error(resolveApiErrorMessage(error, t, 'merchant.themes.installFailed', 'Installation failed'));
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: (theme: ThemeMeta) => themesApi.uninstall('shop', theme.slug, theme.type ?? 'pack').then(unwrapApiResponse),
    onSuccess: () => {
      toast.success(getText('merchant.themes.uninstallSuccess', 'Theme uninstalled successfully'));
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      queryClient.invalidateQueries({ queryKey: ['official-catalog'] });
    },
    onError: (error: unknown) => {
      toast.error(resolveApiErrorMessage(error, t, 'merchant.themes.uninstallFailed', 'Uninstall failed'));
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (config: Record<string, unknown>) => {
      const response = await themesApi.updateConfig(config, 'shop');
      return unwrapApiResponse(response);
    },
    onSuccess: () => {
      toast.success(getText('merchant.themes.updateConfigSuccess', 'Theme configuration updated successfully'));
      setConfigOpen(false);
      queryClient.invalidateQueries({ queryKey: ['themes'] });
    },
    onError: (error: unknown) => {
      toast.error(resolveApiErrorMessage(error, t, 'merchant.themes.updateConfigFailed', 'Failed to update theme configuration'));
    },
  });

  const handleUseTheme = async (item: OfficialCatalogItem) => {
    setInstallingSlug(item.slug);
    try {
      if (item.solutionPackage?.offerKind === 'theme_first_solution' && record?.offerKind === 'theme_first_solution') {
        await provisionManagedPackageMutation.mutateAsync();
        return;
      }
      if (item.installState === 'not_installed') {
        await installOfficialMutation.mutateAsync({
          slug: item.slug,
          kind: 'theme-shop',
          version: item.latestVersion || item.sellableVersion || item.version,
          activate: false,
        });
        return;
      }
      activateMutation.mutate({ slug: item.slug, target: 'shop', type: 'pack' });
    } finally {
      setInstallingSlug(null);
    }
  };

  const handleUploadClick = () => {
    if (canUploadLocalZip) {
      setUploadOpen(true);
      return;
    }
    toast.info(
      getText('merchant.themes.officialOnly', 'Official catalog only'),
      { description: getText('merchant.extensions.officialOnlyThemesDescription', '此环境已停用本地主题 ZIP 安装。') },
    );
  };

  const handleUpdateConfig = () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(configText) as Record<string, unknown>;
    } catch {
      toast.error(getText('merchant.themes.invalidConfigJson', 'Invalid JSON format in theme config'));
      return;
    }
    updateConfigMutation.mutate(parsed);
  };

  /* ---------------- rendering ---------------- */

  const renderDots = (item: OfficialCatalogItem): string[] =>
    usingDemoStyles
      ? DEMO_STYLES.find((style) => style.slug === item.slug)?.dots ?? dotsForSlug(item.slug)
      : dotsForSlug(item.slug);

  const tagLabel = (tag: TagKey): string => getText(TAG_KEYS[tag], tag);

  const chipBase =
    'inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors';
  const chipActive = 'bg-blue-600 text-white shadow-sm shadow-blue-500/25';
  const chipIdle = 'border border-[#eef1f6] bg-white text-slate-600 hover:border-blue-200 hover:text-blue-600';

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-black tracking-tight text-slate-900">
            {getText('merchant.themes.market.title', '主题市场')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {getText('merchant.themes.market.subtitle', '为你的店铺选择合适的主题风格，打造更好的使用体验。')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setMineOnly((value) => !value)}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-lg border px-4 text-sm font-semibold transition-colors',
              mineOnly
                ? 'border-blue-200 bg-blue-50 text-blue-600'
                : 'border-[#eef1f6] bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            {getText('merchant.themes.market.myThemes', '我的主题')}
          </button>
          <button
            type="button"
            onClick={handleUploadClick}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <Upload className="h-4 w-4" />
            {getText('merchant.themes.market.uploadTheme', '上传主题')}
          </button>
        </div>
      </div>

      {/* Featured hero */}
      {featured && (
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#dbe9ff] via-[#e6e6fd] to-[#efe3fb]">
          <div className="relative flex items-center gap-6 px-8 py-7">
            <div className="min-w-0 max-w-[52%] py-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                {getText('merchant.themes.market.featured', '精选推荐')}
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              </span>
              <h2 className="mt-3 truncate text-[24px] font-black tracking-tight text-slate-900 sm:text-[28px]">
                {featured.name}
                {usingDemoStyles ? ' · 高效管理' : ''}
              </h2>
              <p className="mt-1.5 line-clamp-1 text-sm text-slate-600">
                {usingDemoStyles
                  ? getText('merchant.themes.market.featuredTagline', '全新设计的默认主题，简洁、现代、专注于提升你的管理效率。')
                  : featured.description}
              </p>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  disabled={featured.installState === 'active' || installingSlug === featured.slug || activateMutation.isPending}
                  onClick={() => void handleUseTheme(featured)}
                  className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm shadow-blue-500/30 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {installingSlug === featured.slug || activateMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {featured.installState === 'active'
                    ? getText('merchant.themes.market.inUse', '使用中')
                    : getText('merchant.themes.market.useNow', '立即使用')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMineOnly(false);
                    setActiveTag('all');
                    setSearchTerm(featured.name);
                  }}
                  className="inline-flex h-10 items-center rounded-lg bg-white/90 px-5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-white"
                >
                  {getText('merchant.themes.market.viewDetails', '查看详情')}
                </button>
              </div>
            </div>
            <div className="pointer-events-none relative hidden min-w-0 flex-1 md:block">
              <ThemePreview item={featured} className="ml-auto h-44 w-full max-w-[420px] rotate-[1deg] rounded-xl object-cover drop-shadow-xl" />
            </div>
          </div>
        </section>
      )}

      {/* Filter chips + search + sort */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setActiveTag('all')} className={cn(chipBase, activeTag === 'all' ? chipActive : chipIdle)}>
          {getText('merchant.themes.market.allThemes', '全部主题')}
          <span className={cn('rounded-full px-1.5 text-xs', activeTag === 'all' ? 'bg-white/20' : 'bg-slate-100 text-slate-400')}>
            {items.length}
          </span>
        </button>
        {TAGS.map((tag) => (
          <button key={tag} type="button" onClick={() => setActiveTag(tag)} className={cn(chipBase, activeTag === tag ? chipActive : chipIdle)}>
            {tagLabel(tag)}
            <span className={cn('rounded-full px-1.5 text-xs', activeTag === tag ? 'bg-white/20' : 'bg-slate-100 text-slate-400')}>
              {tagCounts[tag]}
            </span>
          </button>
        ))}

        <div className="ml-auto flex items-center gap-3">
          <div className="relative w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={getText('merchant.themes.market.searchPlaceholder', '搜索主题名称...')}
              className="h-9 w-full rounded-lg border border-[#eef1f6] bg-white pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-blue-300"
            />
          </div>
          <Select value={sortMode} onValueChange={(value) => setSortMode(value as 'default' | 'name')}>
            <SelectTrigger className="h-9 w-[120px] rounded-lg border-[#eef1f6] bg-white text-sm text-slate-600 shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">{getText('merchant.themes.market.sortDefault', '默认排序')}</SelectItem>
              <SelectItem value="name">{getText('merchant.themes.market.sortName', '按名称')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Card grid */}
      {isCatalogLoading ? (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-xl border border-[#eef1f6] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
              <div className="m-2 h-36 animate-pulse rounded-lg bg-slate-100" />
              <div className="space-y-2 p-4 pt-2">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {visibleItems.map((item) => {
            const isActive = item.installState === 'active' || item.slug === activeSlug;
            const isInstalling = installingSlug === item.slug;
            const updateBadge = item.updateAvailable && item.latestVersion;
            return (
              <div
                key={item.slug}
                className="group overflow-hidden rounded-xl border border-[#eef1f6] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/5"
              >
                <div className="relative p-2 pb-0">
                  <ThemePreview item={item} className="h-36 w-full rounded-lg" />
                  {isActive && (
                    <span className="absolute left-4 top-4 inline-flex items-center rounded-md bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
                      {getText('merchant.themes.market.currentBadge', '当前使用')}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="truncate text-[15px] font-bold text-slate-900">{item.name}</h3>
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{item.description}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      {renderDots(item).map((dot, dotIndex) => (
                        <span key={dotIndex} className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: dot }} />
                      ))}
                    </span>
                    <button
                      type="button"
                      disabled={isActive || isInstalling || activateMutation.isPending}
                      onClick={() => void handleUseTheme(item)}
                      className={cn(
                        'inline-flex h-8 items-center gap-1 rounded-lg px-3.5 text-sm font-semibold transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white disabled:cursor-not-allowed disabled:opacity-90'
                          : 'border border-blue-200 text-blue-600 hover:bg-blue-50',
                      )}
                    >
                      {isInstalling || (activateMutation.isPending && isActive === false && installingSlug === item.slug) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {isActive
                        ? getText('merchant.themes.market.inUse', '使用中')
                        : getText('merchant.themes.market.use', '使用')}
                    </button>
                  </div>
                  {updateBadge && (
                    <p className="mt-2 text-[11px] font-medium text-amber-500">
                      {getText('merchant.themes.market.updateAvailable', '可更新')} · v{item.latestVersion}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          {visibleItems.length === 0 && (
            <div className="col-span-2 rounded-xl border border-dashed border-[#e2e8f0] bg-white/60 py-16 text-center text-sm text-slate-400 xl:col-span-4">
              {mineOnly
                ? getText('merchant.themes.market.mineEmpty', '还没有已安装的主题，去市集挑一个吧。')
                : getText('common.noData', '暂无数据')}
            </div>
          )}
        </div>
      )}

      {/* Installed theme management (我的主题 view) */}
      {mineOnly && themeList.length > 0 && (
        <section className="rounded-xl border border-[#eef1f6] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-bold text-slate-900">
                {getText('merchant.themes.installedThemes', 'Installed themes')}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {getText('merchant.themes.installedThemesDescription', 'Switch the active storefront look, remove unused themes, and keep built-in themes available as fallbacks.')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeTheme?.previousSlug && (
                <Button variant="outline" size="sm" className="rounded-lg" disabled={rollbackMutation.isPending} onClick={() => rollbackMutation.mutate('shop')}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  {getText('merchant.themes.rollback', 'Rollback')}
                </Button>
              )}
              <Button variant="outline" size="sm" className="rounded-lg" disabled={!activeTheme || updateConfigMutation.isPending} onClick={() => setConfigOpen(true)}>
                {getText('merchant.themes.editConfig', '编辑配置')}
              </Button>
            </div>
          </div>
          <ul className="mt-4 divide-y divide-[#f4f6fa]">
            {themeList.map((theme) => {
              const isActive = activeTheme?.slug === theme.slug && (activeTheme?.type ?? 'pack') === (theme.type ?? 'pack');
              return (
                <li key={`${theme.slug}:${theme.type ?? 'pack'}`} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                    {theme.name}
                    <span className="ml-2 text-xs font-normal text-slate-400">v{theme.version}</span>
                  </span>
                  {isActive && (
                    <Badge className="rounded-md bg-blue-50 text-blue-600 hover:bg-blue-50">
                      {getText('merchant.themes.market.currentBadge', '当前使用')}
                    </Badge>
                  )}
                  {!isActive && (
                    <Button variant="outline" size="sm" className="h-8 rounded-lg" disabled={activateMutation.isPending} onClick={() => activateMutation.mutate({ slug: theme.slug, target: 'shop', type: theme.type })}>
                      <Check className="mr-1 h-3.5 w-3.5" />
                      {getText('merchant.themes.activate', 'Activate')}
                    </Button>
                  )}
                  {theme.source !== 'builtin' && !isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600"
                      disabled={uninstallMutation.isPending}
                      onClick={() => uninstallMutation.mutate(theme)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Platform connection (contextual, below the fold) */}
      {record ? null : <PlatformConnectionCard getText={getText} />}

      {/* Upload dialog (local ZIP, only where allowed) */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getText('merchant.themes.uploadTitle', 'Upload Theme')}</DialogTitle>
            <DialogDescription>
              {getText('merchant.themes.uploadDescription', 'Upload a .zip file containing the theme structure.')} {' '}
              {getText('merchant.themes.uploadTarget', 'Target')}: <b>SHOP</b>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
              <Label className="text-left sm:text-right">{getText('merchant.themes.type', 'Type')}</Label>
              <div className="sm:col-span-3">
                <Select value={themeType} onValueChange={(value) => setThemeType(value as 'pack' | 'app')}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={getText('merchant.themes.type', 'Type')} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="pack" className="rounded-lg">{getText('merchant.themes.typePack', 'Theme Pack (L3.5)')}</SelectItem>
                    <SelectItem value="app" className="rounded-lg">{getText('merchant.themes.typeApp', 'Theme App (L4)')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {themeType === 'app'
                    ? getText('merchant.themes.typeAppHint', 'Executable storefront (Next.js standalone build).')
                    : getText('merchant.themes.typePackHint', 'Static resources only (tokens/templates/assets).')}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
              <Label htmlFor="theme-file" className="text-left sm:text-right">
                {getText('common.labels.file', 'File')}
              </Label>
              <Input
                id="theme-file"
                type="file"
                accept=".zip"
                className="rounded-xl sm:col-span-3"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setSelectedFile(file);
                  if (file && /theme-app|themeapp/i.test(file.name)) {
                    setThemeType('app');
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} className="rounded-xl">
              {getText('common.actions.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={() => {
                if (selectedFile) uploadMutation.mutate(selectedFile);
              }}
              disabled={!selectedFile || uploadMutation.isPending}
              className="rounded-xl"
            >
              {uploadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {getText('merchant.themes.install', 'Install')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config dialog (active theme JSON) */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getText('merchant.themes.editConfigTitle', 'Edit Theme Config')}</DialogTitle>
            <DialogDescription>
              {getText('merchant.themes.editConfigDescription', 'Update active theme runtime configuration as JSON.')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="theme-config-json">{getText('merchant.themes.configJson', 'Config JSON')}</Label>
            <Textarea
              id="theme-config-json"
              value={configText}
              onChange={(event) => setConfigText(event.target.value)}
              className="min-h-56 font-mono text-xs rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)} className="rounded-xl">
              {getText('common.actions.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleUpdateConfig} disabled={updateConfigMutation.isPending} className="rounded-xl">
              {updateConfigMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {getText('common.actions.saveChanges', 'Save Changes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
