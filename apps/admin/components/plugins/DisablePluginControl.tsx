'use client';

import { useState } from 'react';
import { useT } from 'shared/src/i18n/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { pluginsApi } from '@/lib/api';
import { usePluginDialogLayout } from '@/lib/plugin-dialog';

export function DisablePluginControl({
  slug, pluginName, payment, label, disabled, onDisable,
}: {
  slug: string;
  pluginName: string;
  payment: boolean;
  label: string;
  disabled?: boolean;
  /** The confirmation of a disable that strands a dependent is passed to the mutation. */
  onDisable: (confirmation?: string) => Promise<unknown>;
}) {
  const t = useT();
  const dialogLayout = usePluginDialogLayout('confirm');
  const [count, setCount] = useState<number | null>(null);
  const [dependents, setDependents] = useState<string[] | null>(null);
  const [confirmation, setConfirmation] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  async function disable() {
    setBusy(true);
    try {
      await onDisable(confirmation);
      setCount(null);
      setDependents(null);
      setConfirmation(undefined);
    } finally {
      setBusy(false);
    }
  }

  async function checkImpact() {
    setBusy(true);
    try {
      const impact = await pluginsApi.getDisableImpact(slug);
      if (impact.serviceDependents.length) {
        // The plugins that call a service of this one are listed and confirmed
        // before the disable; the confirmation binds that list.
        setDependents(impact.serviceDependents);
        setConfirmation(impact.disableConfirmation);
        return;
      }
      if (impact.pendingPaymentOrders > 0) setCount(impact.pendingPaymentOrders);
      else await onDisable();
    } catch {
      toast.error(t('merchant.plugins.disableImpactFailed'));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <Button type="button" size="sm" variant="outline" className="bg-ground" onClick={() => void checkImpact()} disabled={disabled || busy}>{label}</Button>
    <Dialog open={count !== null} onOpenChange={(open) => { if (!open && !busy) setCount(null); }}>
      <DialogContent {...dialogLayout} role="alertdialog" showCloseButton={false}>
        <DialogHeader className="text-left">
          <DialogTitle className="text-[15px]">{t('merchant.plugins.disableWarningTitle')}</DialogTitle>
          <DialogDescription>{t('merchant.plugins.disableWarning').replace('{count}', String(count ?? 0)).replace('{name}', pluginName)}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2 sm:space-x-0">
          <Button type="button" variant="outline" className="bg-ground" disabled={busy} onClick={() => setCount(null)}>{t('merchant.plugins.disableCancel')}</Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void disable()}>{t('merchant.plugins.disableAnyway')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={dependents !== null} onOpenChange={(open) => { if (!open && !busy) { setDependents(null); setConfirmation(undefined); } }}>
      <DialogContent {...dialogLayout} role="alertdialog" showCloseButton={false}>
        <DialogHeader className="text-left">
          <DialogTitle className="text-[15px]">{t('merchant.plugins.disableDependentsTitle')}</DialogTitle>
          <DialogDescription>{t('merchant.plugins.disableDependentsNote').replace('{plugins}', (dependents ?? []).join(', '))}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2 sm:space-x-0">
          <Button type="button" variant="outline" className="bg-ground" disabled={busy} onClick={() => { setDependents(null); setConfirmation(undefined); }}>{t('merchant.plugins.disableCancel')}</Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void disable()}>{t('merchant.plugins.disableAnyway')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
