'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ShieldCheck,
  Search,
  Plus,
  Trash2,
  Pencil,
  Mail,
  User as UserIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLocale, useT } from 'shared/src/i18n/react'
import { ADMIN_PERMISSIONS } from 'shared'
import { useAuthStore } from '@/lib/store'
import { canAccessAnyPermission } from '@/lib/admin-access'
import {
  type StaffMembership,
  type StaffPermissionCatalogGroup,
  type StaffRoleDefinition,
} from '@/lib/api'
import {
  useCreateStaff,
  useRemoveStaff,
  useResendStaffInvite,
  useStaff,
  useStaffPermissions,
  useStaffRoles,
  useUpdateStaff,
} from '@/lib/hooks/use-api'

type StaffFormState = {
  email: string;
  username: string;
  password: string;
  role: string;
  status: 'ACTIVE' | 'SUSPENDED';
  isOwner: boolean;
  selectedPermissions: string[];
};

const EMPTY_FORM: StaffFormState = {
  email: '',
  username: '',
  password: '',
  role: 'ADMIN',
  status: 'ACTIVE',
  isOwner: false,
  selectedPermissions: [],
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

export default function StaffPage() {
  const t = useT()
  const locale = useLocale()
  const { user } = useAuthStore()
  const canWriteStaff = canAccessAnyPermission(user, [ADMIN_PERMISSIONS.STAFF_WRITE])
  const actorPermissions = user?.permissions || []
  const actorIsOwner = Boolean(user?.isOwner)

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMembership | null>(null)
  const [form, setForm] = useState<StaffFormState>(EMPTY_FORM)

  const { data: staffResponse, isLoading } = useStaff({
    page,
    limit: 20,
    search: searchTerm || undefined,
    role: roleFilter === 'all' ? undefined : roleFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
  })
  const { data: roleCatalog = [] } = useStaffRoles()
  const { data: permissionCatalog = [] } = useStaffPermissions()
  const createStaff = useCreateStaff()
  const updateStaff = useUpdateStaff()
  const removeStaff = useRemoveStaff()
  const resendStaffInvite = useResendStaffInvite()

  const staffItems = staffResponse?.data || []
  const pagination = staffResponse?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 }

  const selectedRole = useMemo(
    () => roleCatalog.find((role) => role.role === form.role) || roleCatalog[0] || null,
    [form.role, roleCatalog],
  )

  const assignableRoles = useMemo(() => {
    if (actorIsOwner) {
      return roleCatalog
    }

    const actorPermissionSet = new Set(actorPermissions)
    return roleCatalog.filter((role) => {
      if (role.role === 'OWNER' || role.role === 'ADMIN') {
        return false
      }

      return role.permissions.every((permission) => actorPermissionSet.has(permission))
    })
  }, [actorIsOwner, actorPermissions, roleCatalog])

  useEffect(() => {
    if (assignableRoles.length > 0 && !assignableRoles.some((role) => role.role === form.role)) {
      setForm((current) => ({
        ...current,
        role: assignableRoles[0].role,
        selectedPermissions: assignableRoles[0].permissions,
      }))
    }
  }, [assignableRoles, form.role])

  const openCreateDialog = () => {
    const defaultRole = assignableRoles[0]
    setEditingStaff(null)
    setForm({
      ...EMPTY_FORM,
      role: defaultRole?.role || 'ADMIN',
      selectedPermissions: defaultRole?.permissions || [],
    })
    setDialogOpen(true)
  }

  const openEditDialog = (staff: StaffMembership) => {
    setEditingStaff(staff)
    setForm({
      email: staff.email,
      username: staff.username,
      password: '',
      role: staff.adminRole,
      status: staff.status,
      isOwner: staff.isOwner,
      selectedPermissions: staff.effectivePermissions,
    })
    setDialogOpen(true)
  }

  const handleRoleChange = (role: string) => {
    const roleDefinition = assignableRoles.find((item) => item.role === role) || roleCatalog.find((item) => item.role === role)
    setForm((current) => ({
      ...current,
      role,
      isOwner: role === 'OWNER',
      selectedPermissions: roleDefinition?.permissions || [],
    }))
  }

  const togglePermission = (permissionKey: string, enabled: boolean) => {
    setForm((current) => {
      const currentSet = new Set(current.selectedPermissions)
      if (enabled) {
        currentSet.add(permissionKey)
      } else {
        currentSet.delete(permissionKey)
      }

      return {
        ...current,
        selectedPermissions: Array.from(currentSet),
      }
    })
  }

  const buildPermissionOverrides = (
    roleDefinition: StaffRoleDefinition | null,
    selectedPermissions: string[],
  ) => {
    const basePermissions = new Set(roleDefinition?.permissions || [])
    const selectedSet = new Set(selectedPermissions)

    return {
      extraPermissions: Array.from(selectedSet).filter((permission) => !basePermissions.has(permission)),
      revokedPermissions: Array.from(basePermissions).filter((permission) => !selectedSet.has(permission)),
    }
  }

  const handleSubmit = async () => {
    if (!selectedRole) {
      return
    }

    const { extraPermissions, revokedPermissions } = buildPermissionOverrides(selectedRole, form.selectedPermissions)

    if (editingStaff) {
      await updateStaff.mutateAsync({
        userId: editingStaff.userId,
        data: {
          role: selectedRole.role,
          status: form.status,
          isOwner: form.isOwner,
          extraPermissions,
          revokedPermissions,
        },
      })
    } else {
      await createStaff.mutateAsync({
        email: form.email.trim(),
        username: form.username.trim(),
        password: form.password,
        role: selectedRole.role,
        status: form.status,
        isOwner: form.isOwner,
        extraPermissions,
        revokedPermissions,
      })
    }

    setDialogOpen(false)
  }

  const handleRemove = async (membership: StaffMembership) => {
    await removeStaff.mutateAsync(membership.userId)
  }

  const handleResendInvite = async (membership: StaffMembership) => {
    await resendStaffInvite.mutateAsync(membership.userId)
  }

  return (
    <div className="w-full bg-[#fcfdfe] min-h-screen">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-100 bg-white/80 py-4 pl-4 pr-4 backdrop-blur-md sm:pl-20 sm:pr-8 lg:px-8">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">
            {getText('merchant.nav.staff', 'Staff')}
          </h1>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">
            {getText('merchant.staff.subtitle', 'Back Office Access Control')}
          </span>
        </div>

        {canWriteStaff && (
          <Button
            onClick={openCreateDialog}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <Plus className="w-4 h-4" />
            {getText('merchant.staff.addStaff', 'Grant Staff Access')}
          </Button>
        )}
      </div>

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
                setPage(1)
              }}
              placeholder={getText('merchant.staff.searchPlaceholder', 'Search by email or username')}
              className="pl-10 h-11 rounded-2xl bg-white"
            />
          </div>

          <Select value={roleFilter} onValueChange={(value) => { setRoleFilter(value); setPage(1) }}>
            <SelectTrigger className="h-11 rounded-2xl bg-white">
              <SelectValue placeholder={getText('merchant.staff.roleFilter', 'Filter by role')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{getText('merchant.staff.allRoles', 'All roles')}</SelectItem>
              {roleCatalog.map((role) => (
                <SelectItem key={role.role} value={role.role}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1) }}>
            <SelectTrigger className="h-11 rounded-2xl bg-white">
              <SelectValue placeholder={getText('merchant.staff.statusFilter', 'Filter by status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{getText('merchant.staff.allStatuses', 'All statuses')}</SelectItem>
              <SelectItem value="ACTIVE">{getText('merchant.staff.active', 'Active')}</SelectItem>
              <SelectItem value="SUSPENDED">{getText('merchant.staff.suspended', 'Suspended')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{getText('merchant.staff.teamAccess', 'Team Access')}</h2>
              <p className="text-sm text-gray-500">
                {getText('merchant.staff.teamAccessDesc', 'Assign admin roles and permission overrides to staff members.')}
              </p>
            </div>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {pagination.total} {getText('merchant.staff.members', 'members')}
            </Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{getText('merchant.staff.member', 'Member')}</TableHead>
                <TableHead>{getText('merchant.staff.role', 'Admin role')}</TableHead>
                <TableHead>{getText('merchant.staff.status', 'Status')}</TableHead>
                <TableHead>{getText('merchant.staff.permissions', 'Permissions')}</TableHead>
                <TableHead className="text-right">{getText('merchant.staff.actions', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                    {getText('merchant.staff.loading', 'Loading staff memberships...')}
                  </TableCell>
                </TableRow>
              ) : staffItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                    {getText('merchant.staff.empty', 'No staff memberships found for this filter.')}
                  </TableCell>
                </TableRow>
              ) : (
                staffItems.map((membership) => (
                  <TableRow key={membership.membershipId}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          <UserIcon className="w-4 h-4 text-gray-400" />
                          <Link
                            href={`/${locale}/staff/${membership.userId}`}
                            className="hover:text-blue-600 transition-colors"
                          >
                            {membership.username}
                          </Link>
                          {membership.isOwner && (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                              {getText('merchant.staff.owner', 'Owner')}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          {membership.email}
                          {!membership.emailVerified && (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                              {getText('merchant.staff.pendingInvite', 'Pending invite')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">{membership.adminRole}</div>
                        <div className="text-xs text-gray-500">
                          {getText('merchant.staff.updatedOn', 'Updated')} {formatDate(membership.updatedAt)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={membership.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800 hover:bg-green-100'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-100'}
                      >
                        {membership.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-gray-900">
                          {membership.effectivePermissions.length} {getText('merchant.staff.permissionsGranted', 'granted')}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {membership.effectivePermissions.slice(0, 3).map((permission) => (
                            <Badge key={permission} variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                              {permission}
                            </Badge>
                          ))}
                          {membership.effectivePermissions.length > 3 && (
                            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                              +{membership.effectivePermissions.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canWriteStaff && !membership.emailVerified && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            disabled={resendStaffInvite.isPending}
                            onClick={() => handleResendInvite(membership)}
                          >
                            <Mail className="w-4 h-4" />
                          </Button>
                        )}
                        {canWriteStaff && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => openEditDialog(membership)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {canWriteStaff && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleRemove(membership)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {editingStaff
                ? getText('merchant.staff.editDialogTitle', 'Edit Staff Permissions')
                : getText('merchant.staff.createDialogTitle', 'Grant Staff Access')}
            </DialogTitle>
            <DialogDescription>
              {editingStaff
                ? getText('merchant.staff.editDialogDesc', 'Adjust role, status, and permission overrides for this team member.')
                : getText('merchant.staff.createDialogDesc', 'Create a staff login or grant admin access to an existing account.')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 overflow-y-auto pr-2 md:grid-cols-[320px,1fr]">
            <div className="space-y-4">
              {!editingStaff && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="staff-email">{getText('merchant.staff.email', 'Email')}</Label>
                    <Input
                      id="staff-email"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="staff@jiffoo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-username">{getText('merchant.staff.username', 'Username')}</Label>
                    <Input
                      id="staff-username"
                      value={form.username}
                      onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                      placeholder={getText('merchant.staff.usernamePlaceholder', 'team-member')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-password">{getText('merchant.staff.password', 'Temporary password')}</Label>
                    <Input
                      id="staff-password"
                      type="password"
                      value={form.password}
                      onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                      placeholder={getText('merchant.staff.passwordPlaceholder', 'Optional, invite setup is preferred')}
                    />
                    <p className="text-xs text-gray-500">
                      {getText('merchant.staff.existingAccountHint', 'Leave this blank to let the staff member set their own password from the invite email.')}
                    </p>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>{getText('merchant.staff.role', 'Role')}</Label>
                <Select value={form.role} onValueChange={handleRoleChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={getText('merchant.staff.selectRole', 'Select role')} />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map((role) => (
                      <SelectItem key={role.role} value={role.role}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{getText('merchant.staff.status', 'Status')}</Label>
                <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as 'ACTIVE' | 'SUSPENDED' }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={getText('merchant.staff.selectStatus', 'Select status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">{getText('merchant.staff.active', 'Active')}</SelectItem>
                    <SelectItem value="SUSPENDED">{getText('merchant.staff.suspended', 'Suspended')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{getText('merchant.staff.ownerAccess', 'Owner access')}</p>
                    <p className="text-sm text-gray-500">
                      {getText('merchant.staff.ownerAccessDesc', 'Owner status is reserved for top-level governance actions.')}
                    </p>
                  </div>
                  <Switch
                    checked={form.isOwner}
                    onCheckedChange={(checked) => setForm((current) => ({ ...current, isOwner: checked }))}
                    disabled={!user?.isOwner}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900 flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 mt-0.5" />
                <div>
                  {selectedRole
                    ? getText('merchant.staff.permissionsHint', 'Start from the role default, then toggle permissions on or off to create per-user overrides.')
                    : getText('merchant.staff.permissionsHintFallback', 'Choose a role to configure permission overrides.')}
                </div>
              </div>

              {permissionCatalog.map((group: StaffPermissionCatalogGroup) => (
                <div key={group.group} className="rounded-2xl border border-gray-100">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-semibold text-gray-900">{group.label}</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {group.permissions.map((permission) => {
                      const enabled = form.selectedPermissions.includes(permission.key)
                      const roleHasPermission = selectedRole?.permissions.includes(permission.key) ?? false
                      const canAssignPermission = actorIsOwner || actorPermissions.includes(permission.key)

                      return (
                        <div key={permission.key} className="px-4 py-3 flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="font-medium text-gray-900">{permission.label}</div>
                            <div className="text-sm text-gray-500">{permission.description}</div>
                            <div className="text-xs text-gray-400">{permission.key}</div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {roleHasPermission && (
                              <Badge variant="outline" className="rounded-full">
                                {getText('merchant.staff.defaultInRole', 'Default')}
                              </Badge>
                            )}
                            <Switch
                              checked={enabled}
                              onCheckedChange={(checked) => togglePermission(permission.key, checked)}
                              disabled={!canAssignPermission}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {getText('merchant.staff.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createStaff.isPending || updateStaff.isPending || !selectedRole}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {editingStaff
                ? getText('merchant.staff.saveChanges', 'Save changes')
                : getText('merchant.staff.grantAccess', 'Grant access')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
