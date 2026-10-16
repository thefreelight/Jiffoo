'use client';
import { useRef, useState } from 'react';
import { useLocale, useT } from 'shared/src/i18n/react';
import { pluginMessage } from 'shared/src/i18n/messages/admin-plugins';
import { MoreHorizontal } from 'lucide-react';
import { useUninstallPlugin, useRestorePlugin, usePurgePlugin } from '@/lib/hooks/use-api';
import type { PluginMetaWithState } from '@/lib/types';
import { pluginLifecycleErrorKey } from '@/lib/plugin-lifecycle';
import { usePluginDialogLayout } from '@/lib/plugin-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export function PluginLifecycle({ plugin, beforeAction, onUninstalled, triggerVariant = 'ghost' }: { plugin: PluginMetaWithState; beforeAction?: (action: () => void) => void; onUninstalled?: () => void; triggerVariant?: 'ghost' | 'outline' }) {
  const t = useT();
  const locale = useLocale();
  const dialogLayout = usePluginDialogLayout('confirm');
  const text = (key: string) => t(`merchant.plugins.lifecycle.${key}`);
  const uninstall = useUninstallPlugin(), restore = useRestorePlugin(), purge = usePurgePlugin();
  const [operation, setOperation] = useState<'uninstall' | 'restore' | 'purge' | null>(null);
  const [typedSlug, setTypedSlug] = useState(''), [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const close = () => { if (!submitting.current) { setOperation(null); setTypedSlug(''); setError(null); } };
  const submit = async () => {
    if (!operation || submitting.current || (operation === 'purge' && typedSlug !== plugin.slug)) return;
    submitting.current = true; setBusy(true); setError(null);
    try {
      if (operation === 'uninstall') await uninstall.mutateAsync(plugin.slug);
      else if (operation === 'restore') await restore.mutateAsync(plugin.slug);
      else await purge.mutateAsync({ slug: plugin.slug, confirmationSlug: typedSlug });
      setOperation(null); setTypedSlug('');
      if (operation === 'uninstall') onUninstalled?.();
    } catch (value) { setError(pluginLifecycleErrorKey(value)); }
    finally { submitting.current = false; setBusy(false); }
  };
  const removed = Boolean(plugin.uninstalled);
  const builtin = plugin.source === 'builtin' || plugin.trustLevel === 'builtin';
  return <>
    {removed && <>
      <Button size="sm" variant="outline" className="h-[30px] bg-ground" disabled={busy || plugin.packageState?.status === 'unavailable' || plugin.packageState?.status === 'corrupt'} onClick={() => setOperation('restore')}>{text('restore')}</Button>
    </>}
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant={triggerVariant} className={triggerVariant === 'outline' ? 'bg-ground' : undefined} size="icon" aria-label={pluginMessage(locale, 'more', { name: plugin.name })}><MoreHorizontal size={16} aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={busy || builtin} onSelect={() => { const action = () => { setError(null); setOperation(removed ? 'purge' : 'uninstall'); }; if (beforeAction) beforeAction(action); else action(); }}>{builtin ? pluginMessage(locale, 'builtinReason') : text(removed ? 'purge' : 'uninstall')}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    <Dialog open={operation !== null} onOpenChange={open => { if (!open) close(); }}>
      <DialogContent {...dialogLayout} showCloseButton={false}><DialogHeader className="text-left">
        <DialogTitle className="text-[15px]">{operation ? text(`${operation}Title`) : ''}</DialogTitle>
        <DialogDescription>{operation ? text(`${operation}Description`) : ''}</DialogDescription>
      </DialogHeader>
        {operation === 'purge' && <label>{text('typeSlug')}: {plugin.slug}
          <input aria-label={text('slugConfirmation')} value={typedSlug} disabled={busy} onChange={event => setTypedSlug(event.target.value)} className="block h-[34px] w-full rounded-md border border-border bg-ground px-2.5 font-mono text-xs" />
        </label>}
        {error && <p role="alert">{text(error)}</p>}
        <div className="flex justify-end gap-2"><Button variant="outline" className="bg-ground" disabled={busy} onClick={close}>{text('cancel')}</Button>
        <Button variant={operation === 'purge' ? 'destructive' : 'default'} disabled={busy || (operation === 'purge' && typedSlug !== plugin.slug)} onClick={() => void submit()}>{busy ? text('working') : text('confirm')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
