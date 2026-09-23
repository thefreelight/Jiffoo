'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { useT } from 'shared/src/i18n/react'
import { ADMIN_PERMISSIONS } from 'shared'
import { canAccessAnyPermission } from '@/lib/admin-access'
import { useAuthStore } from '@/lib/store'
import { notificationsApi, unwrapApiResponse, type AdminNotification } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

const statuses = ['PENDING', 'SENDING', 'SENT', 'FAILED'] as const
type Status = typeof statuses[number]

export default function NotificationsPage() {
  const t = useT()
  const { user } = useAuthStore()
  const label = (key: string, fallback: string) => {
    const value = t(`merchant.notifications.${key}`)
    return value === `merchant.notifications.${key}` ? fallback : value
  }
  const [items, setItems] = useState<AdminNotification[]>([])
  const [selected, setSelected] = useState<AdminNotification | null>(null)
  const resendPermission = selected?.type === 'staff_invite'
    ? ADMIN_PERMISSIONS.STAFF_WRITE
    : selected?.type === 'email_verification'
      ? ADMIN_PERMISSIONS.CUSTOMERS_WRITE
      : ADMIN_PERMISSIONS.ORDERS_WRITE
  const canResend = canAccessAnyPermission(user, [resendPermission])
  const [status, setStatus] = useState<Status | 'all'>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [resending, setResending] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = unwrapApiResponse(await notificationsApi.getAll(page, 20, status === 'all' ? undefined : status))
      setItems(result.items)
      setTotalPages(result.totalPages)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { void refresh() }, [refresh])

  const openDetail = async (id: string) => {
    try {
      setSelected(unwrapApiResponse(await notificationsApi.getById(id)))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load notification')
    }
  }

  const resend = async () => {
    if (!selected) return
    setResending(true)
    try {
      setSelected(unwrapApiResponse(await notificationsApi.resend(selected.id)))
      toast.success(label('queued', 'Notification queued'))
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to queue notification')
    } finally {
      setResending(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Bell className="h-5 w-5" />{label('title', 'Notifications')}</h1>
        <Select value={status} onValueChange={(value) => { setStatus(value as Status | 'all'); setPage(1) }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{label('all', 'All statuses')}</SelectItem>
            {statuses.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>{label('created', 'Created')}</TableHead>
          <TableHead>{label('type', 'Type')}</TableHead>
          <TableHead>{label('recipient', 'Recipient')}</TableHead>
          <TableHead>{label('status', 'Status')}</TableHead>
          <TableHead className="text-right">{label('attempts', 'Attempts')}</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="cursor-pointer" onClick={() => void openDetail(item.id)}>
              <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
              <TableCell>{item.type.replace(/_/g, ' ')}</TableCell>
              <TableCell>{item.toAddress}</TableCell>
              <TableCell>{item.status}</TableCell>
              <TableCell className="text-right">{item.attempts}</TableCell>
            </TableRow>
          ))}
          {!loading && items.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">{label('empty', 'No notifications')}</TableCell></TableRow>}
          {loading && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">...</TableCell></TableRow>}
        </TableBody>
      </Table>
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
        <span>{page} / {Math.max(totalPages, 1)}</span>
        <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent aria-describedby={undefined} className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{label('detail', 'Notification detail')}</DialogTitle></DialogHeader>
          {selected && <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-[8rem_1fr] gap-2">
              <dt>{label('recipient', 'Recipient')}</dt><dd className="break-all">{selected.toAddress}</dd>
              <dt>{label('type', 'Type')}</dt><dd>{selected.type}</dd>
              <dt>{label('status', 'Status')}</dt><dd>{selected.status}</dd>
              <dt>{label('attempts', 'Attempts')}</dt><dd>{selected.attempts}</dd>
              <dt>{label('error', 'Last error')}</dt><dd className="break-words">{selected.lastError || '-'}</dd>
            </dl>
            <div><h2 className="font-medium">{label('content', 'Content')}</h2><p className="mt-2 font-medium">{selected.subject}</p><pre className="mt-2 whitespace-pre-wrap break-words font-sans">{selected.text}</pre></div>
            {canResend && <Button onClick={() => void resend()} disabled={resending}><RotateCw className="mr-2 h-4 w-4" />{label('resend', 'Resend')}</Button>}
          </div>}
        </DialogContent>
      </Dialog>
    </main>
  )
}
