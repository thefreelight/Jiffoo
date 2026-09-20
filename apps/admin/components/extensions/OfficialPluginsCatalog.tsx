'use client';

import { useMemo, useState } from 'react';
import { Loader2, Search, Settings2, WifiOff } from 'lucide-react';
import type { OfficialCatalogItem } from '@/lib/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ExtensionAvatar, OfficialBadge } from '@/components/extensions/ExtensionVisuals';

interface Props {
  items: OfficialCatalogItem[];
  isLoading: boolean;
  marketOnline: boolean;
  marketError?: string;
  officialMarketOnly: boolean;
  installingSlug?: string | null;
  onInstall: (item: OfficialCatalogItem) => void;
  onEnable: (item: OfficialCatalogItem) => void;
  onConfigure: (item: OfficialCatalogItem) => void;
  onManage: (item: OfficialCatalogItem) => void;
  getText: (key: string, fallback: string) => string;
}

export function OfficialPluginsCatalog(props: Props) {
  const [search, setSearch] = useState('');
  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? props.items.filter((item) => `${item.name} ${item.slug} ${item.description} ${item.author}`.toLowerCase().includes(query)) : props.items;
  }, [props.items, search]);

  return <section className="space-y-4"><div className="rounded-lg border border-slate-200 bg-white p-5"><h3 className="text-lg font-semibold">{props.getText('merchant.plugins.marketplace', 'Official plugins')}</h3><p className="mt-1 text-sm text-slate-600">{props.getText('merchant.plugins.officialCatalogDescription', 'Install and manage verified official plugins.')}</p>{!props.isLoading && !props.marketOnline ? <Alert className="mt-4"><WifiOff className="h-4 w-4" /><AlertTitle>{props.getText('merchant.extensions.marketOffline', 'Official catalog unavailable')}</AlertTitle><AlertDescription>{props.marketError || props.getText('merchant.extensions.marketOfflineDescription', 'Installed plugins continue to work.')}</AlertDescription></Alert> : null}{!props.isLoading && props.officialMarketOnly ? <Alert className="mt-4"><AlertTitle>{props.getText('merchant.extensions.officialOnly', 'Official catalog only')}</AlertTitle><AlertDescription>{props.getText('merchant.extensions.officialOnlyPluginsDescription', 'Only verified official packages are available here.')}</AlertDescription></Alert> : null}<div className="relative mt-4"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder={props.getText('merchant.extensions.searchOfficialPlugins', 'Search official plugins')} /></div></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => { const installing = props.installingSlug === item.slug; const canInstall = item.installState === 'not_installed' && props.marketOnline && item.availableInMarket; return <Card key={item.slug} className="rounded-lg"><CardContent className="space-y-4 p-4"><div className="flex gap-3"><ExtensionAvatar slug={item.slug} name={item.name} kind="plugin" thumbnailUrl={item.thumbnailUrl} className="h-10 w-10" /><div><div className="flex items-center gap-2"><h4 className="font-semibold">{item.name}</h4><OfficialBadge compact /></div><p className="text-xs text-slate-500">v{item.version} · {item.author}</p></div></div><p className="text-sm text-slate-600">{item.description}</p><div className="flex items-center justify-between"><Badge variant="outline">{item.installState.replace('_', ' ')}</Badge>{canInstall ? <Button size="sm" onClick={() => props.onInstall(item)} disabled={installing}>{installing ? <Loader2 className="h-4 w-4 animate-spin" /> : props.getText('merchant.plugins.install', 'Install')}</Button> : item.configRequired && !item.configReady ? <Button size="sm" variant="outline" onClick={() => props.onConfigure(item)}><Settings2 className="mr-1 h-4 w-4" />{props.getText('merchant.plugins.configure', 'Configure')}</Button> : item.installState === 'installed' ? <Button size="sm" onClick={() => props.onEnable(item)}>{props.getText('merchant.plugins.enable', 'Enable')}</Button> : <Button size="sm" variant="outline" onClick={() => props.onManage(item)}>{props.getText('merchant.plugins.manage', 'Manage')}</Button>}</div></CardContent></Card>; })}</div></section>;
}
