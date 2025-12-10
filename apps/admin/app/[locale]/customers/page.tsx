/**
 * Customers Page for Tenant Application
 *
 * Displays customer list with search, filter, batch operations and pagination.
 * Supports i18n through the translation function.
 * Uses in-page navigation instead of sidebar submenu (Shopify style).
 */

'use client'

import { AlertTriangle, Eye, Filter, Pencil, Search, Shield, Trash2, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useUsers, useUpdateUser, useDeleteUser, useUserBatchOperations, useUpdateUserRole, type User } from '@/lib/hooks/use-api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageNav } from '@/components/layout/page-nav'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useT, useLocale } from 'shared/src/i18n'


export default function CustomersPage() {
  const t = useT()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Page navigation items for Customers module
  const navItems = [
    { label: getText('tenant.customers.allCustomers', 'All Customers'), href: '/customers', exact: true },
  ]
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // 编辑和删除状态
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)

  // 角色修改状态
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [roleEditingUser, setRoleEditingUser] = useState<User | null>(null)
  const [newRole, setNewRole] = useState<'USER' | 'TENANT_ADMIN'>('USER')

  // 批量操作状态
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [showBatchDialog, setShowBatchDialog] = useState(false)
  const [batchAction, setBatchAction] = useState<'updateRole' | 'delete'>('updateRole')
  const [batchRole, setBatchRole] = useState<'USER' | 'TENANT_ADMIN'>('USER')
  const batchOperationsMutation = useUserBatchOperations()

  // API hooks - 调用真实的后端API，只获取普通用户（客户）
  const {
    data: usersResponse,
    isLoading,
    error,
    refetch
  } = useUsers({
    page: currentPage,
    limit: pageSize,
    search: searchTerm,
    role: 'USER' // 只获取普通用户作为客户
  })

  // Mutation hooks
  const updateUserMutation = useUpdateUser()
  const deleteUserMutation = useDeleteUser()
  const updateRoleMutation = useUpdateUserRole()

  // 处理角色修改
  const handleOpenRoleDialog = (user: User) => {
    setRoleEditingUser(user)
    setNewRole(user.role as 'USER' | 'TENANT_ADMIN')
    setRoleDialogOpen(true)
  }

  const handleUpdateRole = async () => {
    if (!roleEditingUser) return

    try {
      await updateRoleMutation.mutateAsync({
        id: roleEditingUser.id,
        role: newRole,
      })
      setRoleDialogOpen(false)
      setRoleEditingUser(null)
    } catch (error) {
      console.error('Failed to update user role:', error)
    }
  }

  console.log('Users API Response:', usersResponse); // 调试日志

  // 从API响应中提取数据
  const users = Array.isArray(usersResponse?.data) ? usersResponse.data :
                Array.isArray(usersResponse) ? usersResponse : []
  const pagination = (usersResponse as { pagination?: { page: number; limit: number; total: number; totalPages: number } })?.pagination || {
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 0
  }

  // Filter users locally for immediate feedback
  const filteredCustomers = users.filter((user: User) => {
    if (!user) return false
    const matchesSearch = searchTerm === '' ||
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())

    // Map user status to customer status - 所有用户默认为Active，除非role为特殊值
    const customerStatus = user.role === 'VIP' ? 'VIP' : 'Active'
    const matchesStatus = selectedStatus === 'All' || customerStatus === selectedStatus
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VIP':
        return 'bg-purple-100 text-purple-800'
      case 'Active':
        return 'bg-green-100 text-green-800'
      case 'Inactive':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // 处理编辑用户
  const handleUpdateUser = async () => {
    if (!editingUser) return

    try {
      await updateUserMutation.mutateAsync({
        id: editingUser.id,
        data: {
          username: editingUser.username,
          // Note: email cannot be updated via this endpoint
        }
      })
      setEditingUser(null)
      refetch()
    } catch (error) {
      console.error('Failed to update user:', error)
    }
  }

  // 处理删除用户
  const handleDeleteUser = async () => {
    if (!deletingUserId) return

    try {
      await deleteUserMutation.mutateAsync(deletingUserId)
      setDeletingUserId(null)
      refetch()
    } catch (error) {
      console.error('Failed to delete user:', error)
    }
  }

  // 批量操作处理函数
  const handleSelectAll = () => {
    if (selectedUsers.length === filteredCustomers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(filteredCustomers.map((u: User) => u.id))
    }
  }

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleBatchOperation = async () => {
    if (selectedUsers.length === 0) return

    try {
      const data: {
        operation: 'updateRole' | 'delete'
        userIds: string[]
        role?: 'USER' | 'TENANT_ADMIN'
      } = {
        operation: batchAction,
        userIds: selectedUsers
      }

      if (batchAction === 'updateRole') {
        data.role = batchRole
      }

      await batchOperationsMutation.mutateAsync(data)
      setShowBatchDialog(false)
      setSelectedUsers([])
      refetch()
    } catch (error) {
      console.error('Failed to perform batch operation:', error)
    }
  }

  const getCustomerStatus = (user: User) => {
    if (user.role === 'VIP') return 'VIP'
    return 'Active' // 默认所有用户都是活跃的
  }

  // Calculate stats from users data
  const customerStats = {
    total: pagination.total,
    active: users.length, // 所有用户都被认为是活跃的
    vip: users.filter((user: User) => user.role === 'VIP').length,
    newThisMonth: users.filter((user: User) => {
      if (!user.createdAt) return false
      const createdDate = new Date(user.createdAt)
      const now = new Date()
      return createdDate.getMonth() === now.getMonth() &&
             createdDate.getFullYear() === now.getFullYear()
    }).length,
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{getText('tenant.customers.loadFailed', 'Failed to load customers')}</h3>
              <p className="text-gray-600 mb-4">
                {getText('tenant.customers.loadError', 'Error: {message}').replace('{message}', error instanceof Error ? error.message : getText('tenant.customers.unknown', 'Unknown'))}
              </p>
              <Button onClick={() => refetch()}>{getText('tenant.customers.tryAgain', 'Try Again')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getText('tenant.customers.title', 'Customers')}</h1>
            <p className="text-gray-600 mt-1">{getText('tenant.customers.subtitle', 'Manage your customer relationships')}</p>
          </div>
          <Button className="bg-gray-900 hover:bg-gray-800">
            <UserPlus className="w-4 h-4 mr-2" />
            {getText('tenant.customers.addCustomer', 'Add Customer')}
          </Button>
        </div>
        {/* In-page Navigation */}
        <PageNav items={navItems} />
      </div>

      {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">{getText('tenant.customers.totalCustomers', 'Total Customers')}</p>
                    <p className="text-2xl font-bold text-gray-900">{customerStats.total.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">{getText('tenant.customers.active', 'Active')}</p>
                    <p className="text-2xl font-bold text-green-600">{customerStats.active}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">{getText('tenant.customers.vip', 'VIP')}</p>
                    <p className="text-2xl font-bold text-purple-600">{customerStats.vip}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">{getText('tenant.customers.newThisMonth', 'New This Month')}</p>
                    <p className="text-2xl font-bold text-blue-600">{customerStats.newThisMonth}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <UserPlus className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder={getText('tenant.customers.searchPlaceholder', 'Search customers by name or email...')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder={getText('tenant.customers.allStatus', 'All Status')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">{getText('tenant.customers.allStatus', 'All Status')}</SelectItem>
                      <SelectItem value="Active">{getText('tenant.customers.active', 'Active')}</SelectItem>
                      <SelectItem value="VIP">{getText('tenant.customers.vip', 'VIP')}</SelectItem>
                      <SelectItem value="Inactive">{getText('tenant.customers.inactive', 'Inactive')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline">
                    <Filter className="w-4 h-4 mr-2" />
                    {getText('tenant.customers.moreFilters', 'More Filters')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Batch Operations Bar */}
          {selectedUsers.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">
                  {selectedUsers.length} {getText('tenant.customers.usersSelected', 'user(s) selected')}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBatchAction('updateRole')
                      setShowBatchDialog(true)
                    }}
                  >
                    {getText('tenant.customers.updateRole', 'Update Role')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBatchAction('delete')
                      setShowBatchDialog(true)
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    {getText('tenant.customers.deleteSelected', 'Delete Selected')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Customers Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-6 font-medium text-gray-900">
                        <input
                          type="checkbox"
                          checked={selectedUsers.length === filteredCustomers.length && filteredCustomers.length > 0}
                          onChange={handleSelectAll}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.customers.name', 'Customer')}</th>
                      <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.customers.contact', 'Contact')}</th>
                      <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.customers.joinDate', 'Join Date')}</th>
                      <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.customers.role', 'Role')}</th>
                      <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.customers.status', 'Status')}</th>
                      <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.customers.actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center">
                          <div className="text-gray-500">
                            {searchTerm ? getText('tenant.customers.noCustomersMatching', 'No customers found matching your search.') : getText('tenant.customers.noCustomersFound', 'No customers found.')}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((customer: User) => (
                        <tr key={customer.id} className="hover:bg-gray-50">
                          <td className="py-4 px-6">
                            <input
                              type="checkbox"
                              checked={selectedUsers.includes(customer.id)}
                              onChange={() => handleSelectUser(customer.id)}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-gray-200 rounded-full mr-4 flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-600">
                                  {customer.username?.charAt(0)?.toUpperCase() || 'U'}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{customer.username || getText('tenant.customers.unknown', 'Unknown')}</div>
                                <div className="text-sm text-gray-500">ID: {customer.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="text-sm">
                              <div className="text-gray-900">{customer.email || getText('tenant.customers.noPhone', 'No email')}</div>
                              <div className="text-gray-500">{getText('tenant.customers.noPhone', 'No phone')}</div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-gray-600">
                            {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : getText('tenant.customers.unknown', 'Unknown')}
                          </td>
                          <td className="py-4 px-6">
                            <Badge className={customer.role === 'VIP' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}>
                              {customer.role || 'user'}
                            </Badge>
                          </td>
                          <td className="py-4 px-6">
                            <Badge className={getStatusColor(getCustomerStatus(customer))}>
                              {getCustomerStatus(customer)}
                            </Badge>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-2">
                              <Link href={`/${locale}/customers/${customer.id}`}>
                                <Button variant="ghost" size="sm" title={getText('tenant.customers.viewDetails', 'View Details')}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                title={getText('tenant.customers.editRole', 'Edit Role')}
                                onClick={() => handleOpenRoleDialog(customer)}
                              >
                                <Shield className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title={getText('tenant.customers.editUser', 'Edit User')}
                                onClick={() => setEditingUser(customer)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title={getText('tenant.customers.deleteUser', 'Delete User')}
                                onClick={() => setDeletingUserId(customer.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          {pagination && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                {getText('tenant.customers.showingResults', 'Showing {from} to {to} of {total} results')
                  .replace('{from}', String((currentPage - 1) * pageSize + 1))
                  .replace('{to}', String(Math.min(currentPage * pageSize, pagination.total)))
                  .replace('{total}', String(pagination.total))}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  {getText('tenant.customers.previous', 'Previous')}
                </Button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const page = i + 1
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  )
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                  disabled={currentPage === pagination.totalPages}
                >
                  {getText('tenant.customers.next', 'Next')}
                </Button>
              </div>
            </div>
          )}

        {/* Edit User Dialog */}
        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{getText('tenant.customers.editUser', 'Edit User')}</DialogTitle>
              <DialogDescription>
                {getText('tenant.customers.editUserDesc', "Update user information. Click save when you're done.")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="username" className="text-right">
                  {getText('tenant.customers.username', 'Username')}
                </Label>
                <Input
                  id="username"
                  value={editingUser?.username || ''}
                  onChange={(e) => setEditingUser(editingUser ? { ...editingUser, username: e.target.value } : null)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  {getText('tenant.customers.email', 'Email')}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={editingUser?.email || ''}
                  disabled
                  className="col-span-3 bg-gray-50"
                  title={getText('tenant.customers.emailCannotBeModified', 'Email cannot be modified')}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                {getText('tenant.customers.cancel', 'Cancel')}
              </Button>
              <Button onClick={handleUpdateUser} disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? getText('tenant.customers.saving', 'Saving...') : getText('tenant.customers.saveChanges', 'Save changes')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deletingUserId} onOpenChange={(open) => !open && setDeletingUserId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{getText('tenant.customers.deleteUser', 'Delete User')}</DialogTitle>
              <DialogDescription>
                {getText('tenant.customers.deleteUserConfirm', 'Are you sure you want to delete this user? This action cannot be undone.')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletingUserId(null)}>
                {getText('tenant.customers.cancel', 'Cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteUser}
                disabled={deleteUserMutation.isPending}
              >
                {deleteUserMutation.isPending ? getText('tenant.customers.deleting', 'Deleting...') : getText('tenant.customers.delete', 'Delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Batch Operations Dialog */}
        <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{getText('tenant.customers.batchOperation', 'Batch Operation')}</DialogTitle>
              <DialogDescription>
                {batchAction === 'updateRole' && getText('tenant.customers.updateRoleConfirm', 'Update role for {count} selected user(s)').replace('{count}', String(selectedUsers.length))}
                {batchAction === 'delete' && (
                  <span className="text-red-600">
                    {getText('tenant.customers.batchDeleteConfirm', 'Are you sure you want to delete {count} selected user(s)? This action cannot be undone.').replace('{count}', String(selectedUsers.length))}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            {batchAction === 'updateRole' && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="role" className="text-right">
                    {getText('tenant.customers.role', 'Role')}
                  </Label>
                  <Select value={batchRole} onValueChange={(value: 'USER' | 'TENANT_ADMIN') => setBatchRole(value)}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder={getText('tenant.customers.selectRole', 'Select role')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">{getText('tenant.customers.roleUser', 'USER')}</SelectItem>
                      <SelectItem value="TENANT_ADMIN">{getText('tenant.customers.roleTenantAdmin', 'TENANT_ADMIN')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBatchDialog(false)}>
                {getText('tenant.customers.cancel', 'Cancel')}
              </Button>
              <Button
                onClick={handleBatchOperation}
                disabled={batchOperationsMutation.isPending}
                variant={batchAction === 'delete' ? 'destructive' : 'default'}
              >
                {batchOperationsMutation.isPending ? getText('tenant.customers.processing', 'Processing...') : getText('tenant.customers.confirm', 'Confirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Role Edit Dialog */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{getText('tenant.customers.editRoleTitle', 'Edit User Role')}</DialogTitle>
              <DialogDescription>
                {getText('tenant.customers.editRoleDesc', 'Change the role for')} {roleEditingUser?.username || roleEditingUser?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{getText('tenant.customers.selectRole', 'Select Role')}</Label>
                <Select value={newRole} onValueChange={(v: 'USER' | 'TENANT_ADMIN') => setNewRole(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">{getText('tenant.customers.roleUser', 'User')}</SelectItem>
                    <SelectItem value="TENANT_ADMIN">{getText('tenant.customers.roleTenantAdmin', 'Tenant Admin')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {newRole === 'TENANT_ADMIN'
                    ? getText('tenant.customers.adminRoleDesc', 'Tenant Admin has full access to manage the store.')
                    : getText('tenant.customers.userRoleDesc', 'Regular user with standard customer permissions.')}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
                {getText('tenant.customers.cancel', 'Cancel')}
              </Button>
              <Button
                onClick={handleUpdateRole}
                disabled={updateRoleMutation.isPending}
              >
                {updateRoleMutation.isPending ? getText('tenant.customers.saving', 'Saving...') : getText('tenant.customers.saveRole', 'Save Role')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  )
}
