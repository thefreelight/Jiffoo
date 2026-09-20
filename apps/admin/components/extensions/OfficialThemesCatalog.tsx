'use client';

import { useMemo, useState } from 'react';
import { Loader2, Search, WifiOff } from 'lucide-react';
import type { OfficialCatalogItem } from '@/lib/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ExtensionAvatar, OfficialBadge } from '@/components/extensions/ExtensionVisuals';

interface Props {
  target: 'shop' | 'admin';
  items: OfficialCatalogItem[];
  isLoading: boolean;
  marketOnline: boolean;
  marketError?: string;
  officialMarketOnly: boolean;
  installingSlug?: string | null;
  isActivating: boolean;
  onInstall: (item: OfficialCatalogItem) => void;
  onActivate: (item: OfficialCatalogItem) => void;
  getText: (key: string, fallback: string) => string;
}

export function OfficialThemesCatalog(props: Props) {
  const [search, setSearch] = useState('');
  const items = useMemo(() => search.trim() ? props.items.filter((item) => `${item.name} ${item.slug} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase())) : props.items, [props.items, search]);
  if (props.target !== 'shop') return null;
  return <section className="space-y-4"><div className="rounded-lg border border-slate-200 bg-white p-5"><h3 className="text-lg font-semibold">{props.getText('merchant.themes.officialCatalog', 'Official themes')}</h3><p className="mt-1 text-sm text-slate-600">{props.getText('merchant.themes.officialCatalogDescription', 'Install verified storefront themes.')}</p>{!props.isLoading && !props.marketOnline ? <Alert className="mt-4"><WifiOff className="h-4 w-4" /><AlertTitle>{props.getText('merchant.extensions.marketOffline', 'Official catalog unavailable')}</AlertTitle><AlertDescription>{props.marketError || props.getText('merchant.extensions.marketOfflineThemesDescription', 'Installed themes remain available.')}</AlertDescription></Alert> : null}<div className="relative mt-4"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder={props.getText('merchant.extensions.searchOfficial', 'Search official themes')} /></div></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => { const installing = props.installingSlug === item.slug; const canInstall = item.installState === 'not_installed' && props.marketOnline && item.availableInMarket; return <Card key={item.slug} className="rounded-lg"><CardContent className="space-y-4 p-4"><div className="flex gap-3"><ExtensionAvatar slug={item.slug} name={item.name} kind="theme" thumbnailUrl={item.thumbnailUrl} className="h-10 w-10" /><div><div className="flex items-center gap-2"><h4 className="font-semibold">{item.name}</h4><OfficialBadge compact /></div><p className="text-xs text-slate-500">v{item.version} · {item.author}</p></div></div><p className="text-sm text-slate-600">{item.description}</p><div className="flex items-center justify-between"><Badge variant="outline">{item.installState.replace('_', ' ')}</Badge>{canInstall ? <Button size="sm" onClick={() => props.onInstall(item)} disabled={installing}>{installing ? <Loader2 className="h-4 w-4 animate-spin" /> : props.getText('merchant.themes.install', 'Install')}</Button> : item.installState === 'active' ? <Button size="sm" variant="outline" disabled>{props.getText('merchant.themes.active', 'Active')}</Button> : <Button size="sm" onClick={() => props.onActivate(item)} disabled={props.isActivating}>{props.getText('merchant.themes.activate', 'Activate')}</Button>}</div></CardContent></Card>; })}</div></section>;
}
