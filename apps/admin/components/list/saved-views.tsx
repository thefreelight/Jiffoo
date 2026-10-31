'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bookmark, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { listPreferencesApi, unwrapApiResponse, type AdminListView } from '@/lib/api';

export type ListViewsCopy = (key: string, values?: Record<string, string | number>) => string;

/**
 * Per-user saved views for one Admin list. Applying a view navigates to the
 * view's query so the list's own URL state machinery picks it up; no second
 * state store is introduced.
 */
export function SavedViews({ listKey, query, label, copy }: {
  listKey: string;
  query: Record<string, string>;
  label: string;
  copy: ListViewsCopy;
}) {
  const router = useRouter(), pathname = usePathname();
  const [views, setViews] = useState<AdminListView[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (naming) nameInput.current?.focus();
  }, [naming]);

  const load = useCallback(async () => {
    try {
      const response = await listPreferencesApi.listViews(listKey);
      setViews(unwrapApiResponse(response).views ?? []);
      setError('');
    } catch { setError('viewsFailed'); }
  }, [listKey]);

  useEffect(() => { void load(); }, [load]);

  const apply = (view: AdminListView) => {
    const search = new URLSearchParams(view.query).toString();
    router.push(pathname + (search ? '?' + search : ''));
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await listPreferencesApi.createView({ list: listKey, name: trimmed, query });
      setName('');
      setNaming(false);
      setMessage('viewSaved');
      setError('');
      await load();
    } catch { setError('viewSaveFailed'); }
  };

  const remove = async (view: AdminListView) => {
    try {
      await listPreferencesApi.deleteView(view.id);
      setMessage('');
      setError('');
      await load();
    } catch { setError('viewDeleteFailed'); }
  };

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" aria-label={label} className="h-[34px] gap-2 bg-raised px-3">
          <Bookmark aria-hidden="true" className="size-3.5 text-faint" />{label}<ChevronDown aria-hidden="true" className="size-3 text-faint" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label={label} className="w-64 p-1">
        {views.map(view => <DropdownMenuItem key={view.id} onSelect={() => apply(view)} className="flex items-center justify-between gap-2">
          <span className="truncate">{view.name}</span>
          <button type="button" aria-label={copy('deleteView', { name: view.name })} onClick={event => { event.preventDefault(); event.stopPropagation(); void remove(view); }} className="flex size-5 shrink-0 items-center justify-center rounded text-faint focus-visible:outline-2 focus-visible:outline-ring"><Trash2 aria-hidden="true" className="size-3" /></button>
        </DropdownMenuItem>)}
        {!views.length && <p className="px-2 py-1 text-xs text-faint">{copy('noSavedViews')}</p>}
        <DropdownMenuItem onSelect={event => { event.preventDefault(); setNaming(true); }}>{copy('saveCurrentView')}</DropdownMenuItem>
        {naming && <div className="space-y-2 border-t border-border p-2">
          <Input
            ref={nameInput}
            autoFocus
            aria-label={copy('viewName')}
            placeholder={copy('viewNamePlaceholder')}
            value={name}
            onChange={event => setName(event.target.value)}
            onKeyDown={event => {
              // The surrounding dropdown menu runs a typeahead search on every
              // printable key and moves focus to the matching menu item, which
              // would swallow the rest of the name while it is typed. Tab and
              // Escape keep their menu behaviour.
              if (event.key !== 'Tab' && event.key !== 'Escape') event.stopPropagation();
            }}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void save()}>{copy('save')}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setNaming(false); setName(''); }}>{copy('cancel')}</Button>
          </div>
        </div>}
      </DropdownMenuContent>
    </DropdownMenu>
    {message && <p role="status" className="text-xs text-muted-foreground">{copy(message)}</p>}
    {error && <p role="alert" className="text-xs text-destructive">{copy(error)}</p>}
  </>;
}
