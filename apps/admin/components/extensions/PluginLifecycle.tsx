'use client';
import { useRef, useState } from 'react';
import { useT } from 'shared/src/i18n/react';
import { useUninstallPlugin, useRestorePlugin, usePurgePlugin } from '@/lib/hooks/use-api';
import type { PluginMetaWithState } from '@/lib/types';
import { pluginLifecycleErrorKey } from '@/lib/plugin-lifecycle';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function PluginLifecycle({ plugin }: { plugin: PluginMetaWithState }) {
  const t = useT();
  const text = (key: string) => t(`merchant.plugins.lifecycle.${key}`);
  const uninstall = useUninstallPlugin(), restore = useRestorePlugin(), purge = usePurgePlugin();
  const [operation, setOperation] = useState<'uninstall' | 'restore' | 'purge' | null>(null);
  const [typedSlug, setTypedSlug] = useState(''), [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  if (plugin.source === 'builtin') return null;
  const close = () => { if (!submitting.current) { setOperation(null); setTypedSlug(''); setError(null); } };
  const submit = async () => {
    if (!operation || submitting.current || (operation === 'purge' && typedSlug !== plugin.slug)) return;
    submitting.current = true; setBusy(true); setError(null);
    try {
      if (operation === 'uninstall') await uninstall.mutateAsync(plugin.slug);
      else if (operation === 'restore') await restore.mutateAsync(plugin.slug);
      else await purge.mutateAsync({ slug: plugin.slug, confirmationSlug: typedSlug });
      setOperation(null); setTypedSlug('');
    } catch (value) { setError(pluginLifecycleErrorKey(value)); }
    finally { submitting.current = false; setBusy(false); }
  };
  const removed = Boolean(plugin.uninstalled);
  return <>
    {removed ? <>
      <Button disabled={busy || plugin.packageState?.status === 'unavailable' || plugin.packageState?.status === 'corrupt'} onClick={() => setOperation('restore')}>{text('restore')}</Button>
      <Button variant="outline" disabled={busy} onClick={() => setOperation('purge')}>{text('purge')}</Button>
    </> : <Button variant="outline" disabled={busy} onClick={() => setOperation('uninstall')}>{text('uninstall')}</Button>}
    <Dialog open={operation !== null} onOpenChange={open => { if (!open) close(); }}>
      <DialogContent><DialogHeader>
        <DialogTitle>{operation ? text(`${operation}Title`) : ''}</DialogTitle>
        <DialogDescription>{operation ? text(`${operation}Description`) : ''}</DialogDescription>
      </DialogHeader>
        {operation === 'purge' && <label>{text('typeSlug')}: {plugin.slug}
          <input aria-label={text('slugConfirmation')} value={typedSlug} disabled={busy} onChange={event => setTypedSlug(event.target.value)} className="block w-full rounded border border-cool-soft p-2" />
        </label>}
        {error && <p role="alert">{text(error)}</p>}
        <Button variant="outline" disabled={busy} onClick={close}>{text('cancel')}</Button>
        <Button disabled={busy || (operation === 'purge' && typedSlug !== plugin.slug)} onClick={() => void submit()}>{busy ? text('working') : text('confirm')}</Button>
      </DialogContent>
    </Dialog>
  </>;
}
