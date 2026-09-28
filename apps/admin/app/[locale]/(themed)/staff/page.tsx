'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Trash2 } from 'lucide-react'
import { useLocale } from 'shared/src/i18n/react'
import { useAuthStore } from '@/lib/store'
import { useCreateStaff, useRemoveStaff, useStaff } from '@/lib/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

export default function StaffPage() {
  const locale = useLocale()
  const user = useAuthStore((state) => state.user)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [removeId, setRemoveId] = useState<string | null>(null)
  const staff = useStaff({ search, page, limit: 20 })
  const create = useCreateStaff()
  const remove = useRemoveStaff()

  const invite = async () => {
    await create.mutateAsync({ email, username })
    setInviteOpen(false)
    setEmail('')
    setUsername('')
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Administrators</h1>
        <Button onClick={() => setInviteOpen(true)}><Plus className="mr-2 h-4 w-4" />Invite administrator</Button>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-light" />
        <Input aria-label="Search administrators" placeholder="Search administrators" value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1) }} className="pl-9" />
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Administrator</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {(staff.data?.data ?? []).map((admin) => (
            <TableRow key={admin.id}>
              <TableCell>
                <Link className="font-medium hover:underline" href={`/${locale}/staff/${admin.id}`}>{admin.username}</Link>
                <div className="text-sm text-neutral-base">{admin.email}</div>
              </TableCell>
              <TableCell>{admin.isInstallAdmin ? 'Install administrator' : admin.isActive ? 'Active' : admin.emailVerified ? 'Removed' : 'Invited'}</TableCell>
              <TableCell>{new Date(admin.createdAt).toLocaleDateString()}</TableCell>
              <TableCell className="text-right">
                {!admin.isInstallAdmin && admin.id !== user?.id && admin.isActive && (
                  <Button variant="ghost" size="icon" aria-label={`Remove ${admin.username}`}
                    onClick={() => setRemoveId(admin.id)}><Trash2 className="h-4 w-4" /></Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
        <Button variant="outline" disabled={page >= (staff.data?.pagination.totalPages ?? 1)} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite administrator</DialogTitle>
            <DialogDescription>An invitation link lets the administrator set a password.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); void invite() }} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="admin-email">Email</Label>
              <Input id="admin-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="admin-username">Username</Label>
              <Input id="admin-username" required value={username} onChange={(event) => setUsername(event.target.value)} /></div>
            <DialogFooter><Button type="submit" disabled={create.isPending}>Send invitation</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={removeId !== null} onOpenChange={(open) => { if (!open) setRemoveId(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove administrator?</DialogTitle>
            <DialogDescription>Their active sessions will be revoked immediately.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={async () => {
              if (removeId) await remove.mutateAsync(removeId)
              setRemoveId(null)
            }}>Remove administrator</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
