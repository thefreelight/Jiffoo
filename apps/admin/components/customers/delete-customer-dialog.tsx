/**
 * Delete Customer Dialog
 *
 * Confirmation for removing a customer account. The server only deletes
 * accounts that have no orders, payments, wallet, or other records; when it
 * refuses, the dialog explains why and offers to deactivate the account.
 */
'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2, Mail, Trash2, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { isAdminApiError, unwrapApiResponse, usersApi, type UserProfile } from '@/lib/api'
import { useT } from 'shared/src/i18n/react'
import { resolveApiErrorMessage } from '@/lib/error-utils'
import { UserAvatar } from '@/components/ui/user-avatar'

type CustomerTarget = Pick<UserProfile, 'id' | 'username' | 'email' | 'avatar'>

interface DeleteCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: CustomerTarget | null
  /** Called after the account was deleted. */
  onDeleted: (userId: string) => void
  /** Called after the account was deactivated from inside this dialog. */
  onDeactivated?: (userId: string) => void
}

export function DeleteCustomerDialog({ open, onOpenChange, user, onDeleted, onDeactivated }: DeleteCustomerDialogProps) {
  const t = useT()
  const getText = (key: string, fallback: string) => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const [busy, setBusy] = useState<false | 'delete' | 'deactivate'>(false)
  const [error, setError] = useState('')
  // True when the server refused because the customer still has records.
  const [refused, setRefused] = useState(false)

  const handleClose = () => {
    if (busy) return
    setError('')
    setRefused(false)
    onOpenChange(false)
  }

  const handleDelete = async () => {
    if (!user) return

    setError('')
    setRefused(false)
    setBusy('delete')

    try {
      const response = await usersApi.delete(user.id)
      unwrapApiResponse(response)
      onDeleted(user.id)
      onOpenChange(false)
    } catch (err: unknown) {
      const code = isAdminApiError(err) ? err.code : ''
      if (code === 'CUSTOMER_HAS_DATA' || code === 'USER_HAS_DATA') {
        setRefused(true)
        setError(getText('merchant.customers.customerDelete.hasData',
          'This customer still has orders, payments, wallet, or other records and cannot be deleted. Deactivate the account instead.'))
      } else if (code === 'CUSTOMER_DELETE_NOT_ALLOWED') {
        setError(getText('merchant.customers.customerDelete.notAllowed',
          'This account cannot be deleted. Staff and administrator accounts must be managed on the Staff page.'))
      } else if (code === 'CUSTOMER_DELETE_GUARD_UNAVAILABLE') {
        setError(getText('merchant.customers.customerDelete.guardUnavailable',
          'The account could not be checked for related records, so it was not deleted. Try again later.'))
      } else {
        setError(resolveApiErrorMessage(err, t, 'merchant.customers.customerDelete.failed', 'Failed to delete the customer.'))
      }
    } finally {
      setBusy(false)
    }
  }

  const handleDeactivate = async () => {
    if (!user) return

    setError('')
    setBusy('deactivate')

    try {
      const response = await usersApi.update(user.id, { isActive: false })
      unwrapApiResponse(response)
      onDeactivated?.(user.id)
      onOpenChange(false)
    } catch (err: unknown) {
      setError(resolveApiErrorMessage(err, t, 'merchant.customers.customerDelete.toggleFailed', 'Failed to update the account.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] rounded-[32px] border-gray-100 p-8 shadow-2xl overflow-hidden gap-0">
        <DialogHeader className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-red-50 rounded-2xl">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900 tracking-tight">
                {getText('merchant.customers.customerDelete.title', 'Delete Customer')}
              </DialogTitle>
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">
                {getText('merchant.customers.customerDelete.description', 'Permanently remove this customer account. This cannot be undone.')}
              </span>
            </div>
          </div>
          <DialogDescription className="text-sm text-gray-500 font-medium">
            {getText('merchant.customers.customerDelete.rule',
              'Only accounts with no orders, payments, wallet, or other records can be deleted. For customers with records, deactivate the account instead.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p className="text-xs font-bold uppercase tracking-wide">{error}</p>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-100 p-6 rounded-2xl space-y-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
              {getText('merchant.customers.customerDelete.target', 'Account')}
            </span>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                <UserAvatar
                  src={user?.avatar}
                  name={user?.username}
                  username={user?.username}
                  className="h-full w-full rounded-xl"
                  imageClassName="h-full w-full rounded-xl object-cover"
                  fallbackClassName="h-full w-full rounded-xl bg-gray-50 text-gray-500"
                  textClassName="text-sm"
                />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-gray-900 tracking-tight">
                  {user?.username || getText('merchant.customers.unknown', 'Unknown')}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <Mail className="w-3 h-3 text-red-500" />
                  {user?.email}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-8 flex gap-3 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={Boolean(busy)}
            className="flex-1 sm:flex-none h-11 px-6 rounded-xl font-bold text-gray-500 hover:bg-gray-100"
          >
            {getText('merchant.customers.cancel', 'Cancel')}
          </Button>
          {refused ? (
            <Button
              type="button"
              onClick={handleDeactivate}
              disabled={Boolean(busy)}
              className="flex-1 sm:flex-none h-11 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-md shadow-amber-100 transition-all disabled:opacity-50"
            >
              {busy === 'deactivate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
              {getText('merchant.customers.customerDelete.deactivate', 'Deactivate account')}
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={handleDelete}
            disabled={Boolean(busy)}
            className="flex-1 sm:flex-none h-11 px-8 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-100 transition-all disabled:opacity-50"
          >
            {busy === 'delete' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            {busy === 'delete'
              ? getText('merchant.customers.customerDelete.deleting', 'Deleting...')
              : getText('merchant.customers.customerDelete.submit', 'Delete customer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
