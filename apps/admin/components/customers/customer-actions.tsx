'use client';

import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { useLocale, useT } from 'shared/src/i18n/react';
import { useDeleteUser, useUpdateUser } from '@/lib/hooks/use-api';
import { customerOrdersUrl } from '@/lib/customer-list-state';
import type { Customer } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel } from '@/components/ui/alert-dialog';

export function CustomerStatus({ active }: { active: boolean }) {
  const t = useT();
  return <span className={'inline-flex items-center gap-[7px] whitespace-nowrap ' + (active ? '' : 'text-faint')}><span aria-hidden="true" className={'size-[7px] rounded-full border-[1.4px] border-current ' + (active ? 'bg-current' : '')} />{t('merchant.customers.workspace.' + (active ? 'active' : 'inactive'))}</span>;
}
export function CustomerActions({ customer, detail = false, onDelete }: { customer: Customer; detail?: boolean; onDelete: () => void }) {
  const t = useT(), locale = useLocale(), update = useUpdateUser();
  const copy = (key: string, values?: Record<string, string | number>) => t('merchant.customers.workspace.' + key, values);
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant={detail ? 'outline' : 'ghost'} size="icon" className={detail ? 'size-8' : 'size-7'} aria-label={copy('more', { name: customer.username })}><MoreHorizontal aria-hidden="true" className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent onClick={event => event.stopPropagation()} align="end" aria-label={copy('actions')} className="w-[260px] max-w-[calc(100vw-32px)]">
    {!detail && <DropdownMenuItem asChild><Link href={customerOrdersUrl(locale, customer)}>{copy('viewOrders')}</Link></DropdownMenuItem>}
    <DropdownMenuItem disabled={update.isPending} onSelect={async () => { try { await update.mutateAsync({ id: customer.id, data: { isActive: !customer.isActive } }); } catch { /* The mutation reports mapped errors. */ } }} className="flex flex-col items-start gap-0.5"><span>{copy(customer.isActive ? 'deactivate' : 'reactivate')}</span>{detail && <span className="text-xs leading-relaxed text-faint">{copy(customer.isActive ? 'deactivateHint' : 'reactivateHint')}</span>}</DropdownMenuItem>
    <DropdownMenuSeparator /><DropdownMenuItem disabled={customer.orderCount > 0} onSelect={onDelete} className="flex flex-col items-start gap-0.5"><span>{copy('delete')}</span>{customer.orderCount > 0 && <span className="text-xs leading-relaxed">{copy('deleteBlocked', { count: customer.orderCount })}</span>}</DropdownMenuItem>
  </DropdownMenuContent></DropdownMenu>;
}
export function DeleteCustomerDialog({ customer, onClose, onDeleted }: { customer: Customer | null; onClose: () => void; onDeleted: () => void }) {
  const t = useT(), mutation = useDeleteUser();
  return <AlertDialog open={!!customer} onOpenChange={open => { if (!open && !mutation.isPending) onClose(); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t('merchant.customers.workspace.delete')}</AlertDialogTitle><AlertDialogDescription>{customer && t('merchant.customers.workspace.deleteDescription', { name: customer.username, email: customer.email })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={mutation.isPending}>{t('merchant.customers.cancel')}</AlertDialogCancel><Button variant="destructive" disabled={mutation.isPending || !customer || customer.orderCount > 0} onClick={async () => { if (!customer) return; try { await mutation.mutateAsync(customer.id); onClose(); onDeleted(); } catch { /* Keep the dialog open after a failed deletion. */ } }}>{t('merchant.customers.workspace.delete')}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
