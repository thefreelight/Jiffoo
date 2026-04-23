'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, Mail, ShieldCheck, User as UserIcon, Clock3, History } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useLocale, useT } from 'shared/src/i18n/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useResendStaffInvite, useStaffAuditLogs, useStaffMember } from '@/lib/hooks/use-api'

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}

function formatAction(action: string) {
  return action
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function StaffDetailPage() {
  const params = useParams()
  const router = useRouter()
  const locale = useLocale()
  const t = useT()
  const userId = params.id as string
  const [auditPage, setAuditPage] = useState(1)

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const { data: membership, isLoading, error } = useStaffMember(userId)
  const { data: auditLogResponse, isLoading: isAuditLoading } = useStaffAuditLogs(userId, auditPage, 20)
  const resendStaffInvite = useResendStaffInvite()

  const groupedPermissions = useMemo<Record<string, string[]>>(() => {
    if (!membership) return {}

    return membership.effectivePermissions.reduce<Record<string, string[]>>((groups, permission) => {
      const [resource] = permission.split('.')
      const key = resource || 'other'
      groups[key] = groups[key] || []
      groups[key].push(permission)
      return groups
    }, {})
  }, [membership])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fcfdfe]">
        <div className="text-sm text-gray-500">{getText('merchant.staff.loading', 'Loading staff memberships...')}</div>
      </div>
    )
  }

  if (error || !membership) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fcfdfe]">
        <div className="text-center space-y-4">
          <p className="text-lg font-semibold text-gray-900">{getText('merchant.staff.notFound', 'Staff membership not found')}</p>
          <Button onClick={() => router.push(`/${locale}/staff`)} variant="outline">
            {getText('merchant.staff.backToList', 'Back to staff')}
          </Button>
        </div>
      </div>
    )
  }

  const auditLogs = auditLogResponse?.data || []
  const auditPagination = auditLogResponse?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 }

  return (
    <div className="min-h-screen bg-[#fcfdfe]">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-100 bg-white/80 py-4 pl-4 pr-4 backdrop-blur-md sm:pl-20 sm:pr-8 lg:px-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-xl hover:bg-gray-100 h-10 w-10" onClick={() => router.push(`/${locale}/staff`)}>
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">
              {membership.username}
            </h1>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">
              {getText('merchant.staff.detailSubtitle', 'Staff Access Profile')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!membership.emailVerified && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-2"
              disabled={resendStaffInvite.isPending}
              onClick={() => resendStaffInvite.mutateAsync(membership.userId)}
            >
              <Mail className="w-4 h-4" />
              {getText('merchant.staff.resendInvite', 'Resend invite')}
            </Button>
          )}
          <Badge className={membership.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}>
            {membership.status}
          </Badge>
        </div>
      </div>

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
          <Card className="rounded-3xl border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle>{getText('merchant.staff.profile', 'Profile')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <UserIcon className="w-4 h-4 text-gray-400" />
                <span>{membership.username}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <Mail className="w-4 h-4 text-gray-400" />
                <span>{membership.email}</span>
                <Badge
                  variant="outline"
                  className={membership.emailVerified
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'}
                >
                  {membership.emailVerified
                    ? getText('merchant.staff.emailVerified', 'Verified')
                    : getText('merchant.staff.pendingInvite', 'Pending invite')}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <ShieldCheck className="w-4 h-4 text-gray-400" />
                <span>{membership.adminRole}</span>
                {membership.isOwner && (
                  <Badge className="bg-amber-100 text-amber-800">{getText('merchant.staff.owner', 'Owner')}</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <Clock3 className="w-4 h-4 text-gray-400" />
                <span>{getText('merchant.staff.updatedOn', 'Updated')} {formatDateTime(membership.updatedAt)}</span>
              </div>

              <div className="pt-4 border-t border-gray-100 space-y-2">
                <div className="text-sm font-medium text-gray-900">{getText('merchant.staff.overrides', 'Overrides')}</div>
                <div className="text-sm text-gray-600">
                  {getText('merchant.staff.extraPermissions', 'Extra permissions')}: {membership.extraPermissions.length}
                </div>
                <div className="text-sm text-gray-600">
                  {getText('merchant.staff.revokedPermissions', 'Revoked permissions')}: {membership.revokedPermissions.length}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-3xl border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle>{getText('merchant.staff.effectivePermissions', 'Effective Permissions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(groupedPermissions).map(([group, permissions]) => (
                  <div key={group} className="space-y-3">
                    <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">{group}</div>
                    <div className="flex flex-wrap gap-2">
                      {permissions.map((permission) => (
                        <Badge key={permission} variant="outline" className="rounded-full px-3 py-1">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-gray-100 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  {getText('merchant.staff.auditTrail', 'Audit Trail')}
                </CardTitle>
                <Badge variant="outline">{auditPagination.total}</Badge>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{getText('merchant.staff.auditAction', 'Action')}</TableHead>
                      <TableHead>{getText('merchant.staff.auditActor', 'Actor')}</TableHead>
                      <TableHead>{getText('merchant.staff.auditTime', 'Time')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isAuditLoading ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                          {getText('merchant.staff.auditLoading', 'Loading audit trail...')}
                        </TableCell>
                      </TableRow>
                    ) : auditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                          {getText('merchant.staff.auditEmpty', 'No audit entries yet.')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="font-medium text-gray-900">{formatAction(log.action)}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-gray-700">{log.actorUsername || log.actorEmail || getText('merchant.staff.system', 'System')}</div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">{formatDateTime(log.createdAt)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {auditPagination.totalPages > 1 && (
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={auditPage <= 1}
                      onClick={() => setAuditPage((current) => Math.max(1, current - 1))}
                    >
                      {getText('merchant.staff.previous', 'Previous')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={auditPage >= auditPagination.totalPages}
                      onClick={() => setAuditPage((current) => Math.min(auditPagination.totalPages, current + 1))}
                    >
                      {getText('merchant.staff.next', 'Next')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
