'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useLocale } from 'shared/src/i18n/react'
import { Copy, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useResendStaffInvite, useStaffAuditLogs, useStaffMember } from '@/lib/hooks/use-api'
import { staffApi, unwrapApiResponse } from '@/lib/api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function StaffDetailPage() {
  const userId = useParams().id as string
  const locale = useLocale()
  const [inviteLink, setInviteLink] = useState('')
  const [auditPage, setAuditPage] = useState(1)
  const { data: admin, isLoading } = useStaffMember(userId)
  const { data: audit } = useStaffAuditLogs(userId, auditPage, 20)
  const resend = useResendStaffInvite()

  if (isLoading) return <main className="p-6">Loading administrator...</main>
  if (!admin) return <main className="p-6">Administrator not found</main>

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <Link className="text-sm text-neutral-strong hover:underline" href={`/${locale}/staff`}>Back to administrators</Link>
      <div>
        <h1 className="text-2xl font-semibold">{admin.username}</h1>
        <p className="text-neutral-strong">{admin.email}</p>
      </div>
      <dl className="grid gap-3 border-y py-4 sm:grid-cols-3">
        <div><dt className="text-sm text-neutral-base">Status</dt>
          <dd>{admin.isInstallAdmin ? 'Install administrator' : admin.isActive ? 'Active' : admin.emailVerified ? 'Removed' : 'Invited'}</dd></div>
        <div><dt className="text-sm text-neutral-base">Created</dt><dd>{new Date(admin.createdAt).toLocaleString()}</dd></div>
        <div><dt className="text-sm text-neutral-base">Role</dt><dd>Administrator</dd></div>
      </dl>
      {!admin.emailVerified && !admin.isActive && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => resend.mutate(userId)} disabled={resend.isPending}>
            <Mail className="mr-2 h-4 w-4" />Resend invitation
          </Button>
          <Button variant="outline" onClick={async () => setInviteLink(unwrapApiResponse(await staffApi.generateInviteLink(userId)).link)}>
            Generate invitation link
          </Button>
          {inviteLink && (
            <>
              <Input aria-label="Invitation link" readOnly value={inviteLink} className="min-w-64 flex-1" />
              <Button variant="outline" onClick={() => void navigator.clipboard.writeText(inviteLink)}>
                <Copy className="mr-2 h-4 w-4" />Copy invitation link
              </Button>
            </>
          )}
        </div>
      )}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Activity</h2>
        <Table><TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Time</TableHead></TableRow></TableHeader>
          <TableBody>{(audit?.data ?? []).map((entry) => (
            <TableRow key={entry.id}><TableCell>{entry.action}</TableCell>
              <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell></TableRow>
          ))}</TableBody></Table>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" disabled={auditPage <= 1} onClick={() => setAuditPage(auditPage - 1)}>Previous</Button>
          <Button variant="outline" disabled={auditPage >= (audit?.pagination.totalPages ?? 1)} onClick={() => setAuditPage(auditPage + 1)}>Next</Button>
        </div>
      </section>
    </main>
  )
}
