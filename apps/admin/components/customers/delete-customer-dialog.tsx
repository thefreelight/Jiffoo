/**
 * Delete Customer Dialog
 *
 * Confirmation for removing a customer account. The server only deletes
 * accounts that have no orders, payments, wallet, or other records. When it
 * refuses, the dialog explains why and offers to deactivate the account, or to
 * force delete the account together with everything it owns.
 */
'use client'

import { useState } from 'react'
import { AlertTriangle, ArrowLeft, Loader2, Mail, MinusCircle, Trash2, UserX } from 'lucide-react'
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

/** What the server counted when it refused a regular delete. */
type DeleteRefusal = {
  orders: number
  other: number
}

type DeleteStep = 'confirm' | 'refused' | 'force'
type BusyState = false | 'delete' | 'deactivate' | 'force'

interface DeleteCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: CustomerTarget | null
  /** Called after the account was deleted, regularly or by force. */
  onDeleted: (userId: string, result: { force: boolean }) => void
  /** Called after the account was deactivated from inside this dialog. */
  onDeactivated?: (userId: string) => void
}

const ORDERS_TABLE = 'native_order_metadata'
// An order's snapshot is the same order, not another record.
const SAME_ORDER_TABLES = new Set(['native_order_snapshots'])

// The native line lists every blocking table with its row count; the Node line only reports orders.
function readRefusal(details: unknown): DeleteRefusal | null {
  if (!details || typeof details !== 'object') return null
  const { orders, blockers } = details as { orders?: unknown; blockers?: unknown }
  if (typeof orders === 'number') return { orders, other: 0 }
  if (!Array.isArray(blockers)) return null
  const refusal: DeleteRefusal = { orders: 0, other: 0 }
  for (const entry of blockers) {
    const { table, count } = (entry ?? {}) as { table?: unknown; count?: unknown }
    if (typeof table !== 'string') continue
    if (table === ORDERS_TABLE) refusal.orders += Number(count) || 0
    else if (!SAME_ORDER_TABLES.has(table)) refusal.other += Number(count) || 0
  }
  return refusal
}

// What a force delete takes with the account, in the order the reader should meet it.
const FORCE_REMOVE_ITEMS = [
  { key: 'forceItemAccount', fallback: 'The account itself: sign-in methods, profile, addresses, and cart' },
  { key: 'forceItemOrders', fallback: 'Orders, with their payments, refunds, and shipments' },
  { key: 'forceItemMoney', fallback: 'Wallet balance and history, subscriptions, and purchases' },
  { key: 'forceItemOther', fallback: 'Promotion, affiliate, and other records linked to the account' },
]

export function DeleteCustomerDialog(props: DeleteCustomerDialogProps) {
  // A new target starts over, even when the previous dialog was closed by its parent after a delete.
  return <DeleteCustomerDialogBody key={props.user?.id ?? 'none'} {...props} />
}

function DeleteCustomerDialogBody({ open, onOpenChange, user, onDeleted, onDeactivated }: DeleteCustomerDialogProps) {
  const t = useT()
  const fill = (text: string, params?: Record<string, string | number>) =>
    params
      ? Object.entries(params).reduce((out, [name, value]) => out.replace(`{${name}}`, String(value)), text)
      : text
  const getText = (key: string, fallback: string, params?: Record<string, string | number>) => {
    if (!t) return fill(fallback, params)
    const translated = t(key, params)
    return fill(translated === key ? fallback : translated, params)
  }

  const [step, setStep] = useState<DeleteStep>('confirm')
  const [busy, setBusy] = useState<BusyState>(false)
  const [error, setError] = useState('')
  // What the server said the customer still has, once it refused a regular delete.
  const [refusal, setRefusal] = useState<DeleteRefusal | null>(null)
  const [seenOpen, setSeenOpen] = useState(open)
  // Reopening starts over; resetting on close instead would flash the first step during the exit animation.
  if (open !== seenOpen) {
    setSeenOpen(open)
    if (open) {
      setStep('confirm')
      setError('')
      setRefusal(null)
    }
  }

  const describeError = (err: unknown, forced: boolean) => {
    const code = isAdminApiError(err) ? err.code : ''
    if (code === 'CUSTOMER_DELETE_NOT_ALLOWED') {
      return getText('merchant.customers.customerDelete.notAllowed',
        'This account cannot be deleted. Staff and administrator accounts must be managed on the Staff page.')
    }
    if (code === 'CUSTOMER_DELETE_GUARD_UNAVAILABLE') {
      return getText('merchant.customers.customerDelete.guardUnavailable',
        'The account could not be checked for related records, so it was not deleted. Try again later.')
    }
    if (code === 'CUSTOMER_DELETE_REFERENCED') {
      return getText('merchant.customers.customerDelete.forceReferenced',
        'This account is referenced by records that cannot be removed automatically. Nothing was deleted.')
    }
    if (code === 'CUSTOMER_HAS_DATA' || code === 'USER_HAS_DATA') {
      // Forced, the same code means the database refused because a related record is still there.
      return forced
        ? getText('merchant.customers.customerDelete.forceFailed',
            'Force delete did not complete. The account still has related records that could not be removed.')
        : getText('merchant.customers.customerDelete.hasData',
            'This customer still has orders, payments, wallet, or other records and cannot be deleted normally. Deactivate the account instead, or force delete to remove everything.')
    }
    return resolveApiErrorMessage(err, t,
      forced ? 'merchant.customers.customerDelete.forceFailed' : 'merchant.customers.customerDelete.failed',
      forced ? 'Force delete did not complete.' : 'Failed to delete the customer.')
  }

  const handleClose = () => {
    if (busy) return
    onOpenChange(false)
  }

  const handleDelete = async () => {
    if (!user) return

    setError('')
    setBusy('delete')

    try {
      unwrapApiResponse(await usersApi.delete(user.id))
      onDeleted(user.id, { force: false })
      onOpenChange(false)
    } catch (err: unknown) {
      if (isAdminApiError(err) && (err.code === 'CUSTOMER_HAS_DATA' || err.code === 'USER_HAS_DATA')) {
        setRefusal(readRefusal(err.details))
        setStep('refused')
      } else {
        setError(describeError(err, false))
      }
    } finally {
      setBusy(false)
    }
  }

  const handleForce = async () => {
    if (!user) return

    setError('')
    setBusy('force')

    try {
      unwrapApiResponse(await usersApi.delete(user.id, { force: true }))
      onDeleted(user.id, { force: true })
      onOpenChange(false)
    } catch (err: unknown) {
      setError(describeError(err, true))
    } finally {
      setBusy(false)
    }
  }

  const handleDeactivate = async () => {
    if (!user) return

    setError('')
    setBusy('deactivate')

    try {
      unwrapApiResponse(await usersApi.update(user.id, { isActive: false }))
      onDeactivated?.(user.id)
      onOpenChange(false)
    } catch (err: unknown) {
      setError(resolveApiErrorMessage(err, t, 'merchant.customers.customerDelete.toggleFailed', 'Failed to update the account.'))
    } finally {
      setBusy(false)
    }
  }

  let countSummary = ''
  if (refusal) {
    if (refusal.orders > 0 && refusal.other > 0) {
      countSummary = getText('merchant.customers.customerDelete.forceCountBoth',
        'This covers {orders} orders and {other} other records', refusal)
    } else if (refusal.orders > 0) {
      countSummary = getText('merchant.customers.customerDelete.forceCountOrders',
        'This covers {orders} orders', refusal)
    } else {
      countSummary = getText('merchant.customers.customerDelete.forceCountOther',
        'This covers {other} records linked to this account', refusal)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {/* Only the body scrolls, so the title and the actions stay in view on a short screen. */}
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] rounded-[32px] border-gray-100 p-8 shadow-2xl gap-0 flex flex-col outline-none">
        <DialogHeader className="mb-8 shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-red-50 rounded-2xl">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900 tracking-tight">
                {step === 'force'
                  ? getText('merchant.customers.customerDelete.forceTitle', 'Force delete customer')
                  : getText('merchant.customers.customerDelete.title', 'Delete Customer')}
              </DialogTitle>
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">
                {step === 'force'
                  ? getText('merchant.customers.customerDelete.forceTagline', 'Permanent. This cannot be undone.')
                  : getText('merchant.customers.customerDelete.description', 'Permanently remove this customer account. This cannot be undone.')}
              </span>
            </div>
          </div>
          <DialogDescription className="text-sm text-gray-500 font-medium">
            {step === 'force'
              ? getText('merchant.customers.customerDelete.forceLead',
                  'The account is deleted together with everything it owns: orders, payments, wallet, and other records.')
              : getText('merchant.customers.customerDelete.rule',
                  'Only accounts with no orders, payments, wallet, or other records can be deleted on their own. For customers with records, deactivate the account or use Force delete to remove the records with it.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 flex-1 min-h-0 overflow-y-auto">
          {/* A refused delete explains itself here; any other failure reports its own message. */}
          {(error || step === 'refused') && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p className="text-xs font-bold uppercase tracking-wide">
                {error || getText('merchant.customers.customerDelete.hasData',
                  'This customer still has orders, payments, wallet, or other records and cannot be deleted normally. Deactivate the account instead, or force delete to remove everything.')}
              </p>
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
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest break-all">
                  <Mail className="w-3 h-3 text-red-500 shrink-0" />
                  {user?.email}
                </div>
              </div>
            </div>
          </div>

          {step === 'force' && (
            <>
              <div className="bg-red-50 border border-red-100 p-5 rounded-2xl">
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">
                  {getText('merchant.customers.customerDelete.forceWillRemove', 'Will be deleted')}
                </p>
                <ul className="mt-3 space-y-2.5">
                  {FORCE_REMOVE_ITEMS.map((item) => (
                    <li key={item.key} className="flex items-start gap-2.5 text-sm text-gray-700 leading-snug">
                      <MinusCircle className="mt-0.5 w-4 h-4 text-red-500 shrink-0" />
                      <span>{getText(`merchant.customers.customerDelete.${item.key}`, item.fallback)}</span>
                    </li>
                  ))}
                </ul>
                {countSummary && (
                  <p className="mt-4 pt-4 border-t border-red-100 text-sm font-bold text-red-600">{countSummary}</p>
                )}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                {getText('merchant.customers.customerDelete.forceKept',
                  'Staff audit logs and error logs are kept. Other records that only point at the account keep their data and lose the link.')}
              </p>
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 text-amber-700 px-4 py-3 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-xs font-semibold leading-relaxed">
                  {getText('merchant.customers.customerDelete.forceWarning',
                    'Nothing is refunded and the customer is not notified. If paid orders are involved, confirm your accounting and tax retention rules first.')}
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mt-8 flex gap-3 sm:gap-0 sm:flex-wrap shrink-0">
          {step === 'force' ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setError(''); setStep('refused') }}
                disabled={Boolean(busy)}
                className="flex-1 sm:flex-none h-11 px-6 rounded-xl font-bold text-gray-500 hover:bg-gray-100"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {getText('merchant.customers.customerDelete.forceBack', 'Back')}
              </Button>
              <Button
                type="button"
                onClick={handleForce}
                disabled={Boolean(busy)}
                className="flex-1 sm:flex-none h-11 px-8 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-100 transition-all disabled:opacity-50"
              >
                {busy === 'force' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {busy === 'force'
                  ? getText('merchant.customers.customerDelete.forceWorking', 'Force deleting...')
                  : getText('merchant.customers.customerDelete.forceConfirm', 'Confirm force delete')}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={Boolean(busy)}
                className="flex-1 sm:flex-none h-11 px-6 rounded-xl font-bold text-gray-500 hover:bg-gray-100"
              >
                {getText('merchant.customers.cancel', 'Cancel')}
              </Button>
              {step === 'refused' && (
                <>
                  <Button
                    type="button"
                    onClick={handleDeactivate}
                    disabled={Boolean(busy)}
                    className="flex-1 sm:flex-none h-11 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-md shadow-amber-100 transition-all disabled:opacity-50"
                  >
                    {busy === 'deactivate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
                    {getText('merchant.customers.customerDelete.deactivate', 'Deactivate account')}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep('force')}
                    disabled={Boolean(busy)}
                    className="flex-1 sm:flex-none h-11 px-6 rounded-xl border-2 border-red-200 bg-white hover:bg-red-50 hover:border-red-300 text-red-600 font-bold transition-all disabled:opacity-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {getText('merchant.customers.customerDelete.forceAction', 'Force delete...')}
                  </Button>
                </>
              )}
              {step === 'confirm' && (
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
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
