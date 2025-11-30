/**
 * User Detail Page - Super Admin
 *
 * 用户详情页承担所有操作：
 * - 查看用户信息
 * - 编辑用户信息（用户名、头像）
 * - 启用/停用用户
 * - 删除用户
 */
'use client'

import { ArrowLeft, Building2, Calendar, Clock, Mail, ShieldCheck, User, Save, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useUsersStore } from '@/store/users'
import { useUIStore } from '@/store/ui'
import { getUserStatusConfig, getStatusBadgeClass } from '@/lib/status-utils'

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string

  // 编辑模式状态
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    avatar: ''
  })

  // 删除确认对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')

  const {
    selectedUser,
    isLoading,
    isUpdating,
    isDeleting,
    error,
    fetchUserById,
    updateUser,
    deleteUser,
    activateUser,
    deactivateUser,
    clearError
  } = useUsersStore()

  const { setPageTitle, setBreadcrumbs } = useUIStore()

  useEffect(() => {
    if (userId) {
      fetchUserById(userId)
    }
  }, [userId, fetchUserById])

  useEffect(() => {
    if (selectedUser) {
      setPageTitle(`User Details - ${selectedUser.username}`)
      setBreadcrumbs([
        { label: 'Dashboard', href: '/' },
        { label: 'User Management', href: '/users' },
        { label: selectedUser.username }
      ])
      // 初始化表单数据
      setFormData({
        username: selectedUser.username || '',
        avatar: selectedUser.avatar || ''
      })
    }
  }, [selectedUser, setPageTitle, setBreadcrumbs])

  useEffect(() => {
    if (error) {
      console.error('User Detail Error:', error)
      clearError()
    }
  }, [error, clearError])

  const handleBack = () => {
    router.push('/users')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    if (!selectedUser) return
    try {
      await updateUser(selectedUser.id, formData)
      setIsEditing(false)
      // 重新获取用户数据
      await fetchUserById(userId)
    } catch (err) {
      console.error('Failed to update user:', err)
      alert('Failed to update user')
    }
  }

  const handleToggleStatus = async () => {
    if (!selectedUser) return
    try {
      if (selectedUser.isActive) {
        await deactivateUser(selectedUser.id, 'Deactivated by admin')
      } else {
        await activateUser(selectedUser.id)
      }
      await fetchUserById(userId)
    } catch (err) {
      console.error('Failed to toggle user status:', err)
      alert('Failed to update user status')
    }
  }

  const handleDelete = async () => {
    if (!selectedUser) return
    try {
      await deleteUser(selectedUser.id, deleteReason || 'Deleted by admin')
      setDeleteDialogOpen(false)
      router.push('/users')
    } catch (err) {
      console.error('Failed to delete user:', err)
      alert('Failed to delete user')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!selectedUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">User Not Found</h2>
          <p className="text-gray-600 mb-8">The user you're looking for doesn't exist.</p>
          <Button onClick={handleBack}>Back to Users</Button>
        </div>
      </div>
    )
  }

  const statusConfig = getUserStatusConfig(selectedUser.effectiveStatus || (selectedUser.isActive ? 'ACTIVE' : 'INACTIVE'))
  const canToggleStatus = selectedUser.tenant?.status === 'ACTIVE'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Users
          </button>
        </div>
        <div className="flex items-center space-x-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isUpdating}>
                <Save className="h-4 w-4 mr-2" />
                {isUpdating ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              Edit User
            </Button>
          )}
        </div>
      </div>

      {/* User Info Card */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 bg-gray-300 rounded-full flex items-center justify-center">
              {selectedUser.avatar ? (
                <Image
                  src={selectedUser.avatar}
                  alt={selectedUser.username}
                  className="h-16 w-16 rounded-full object-cover"
                  width={64}
                  height={64}
                />
              ) : (
                <User className="h-8 w-8 text-gray-600" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{selectedUser.username}</h1>
              <p className="text-gray-600">{selectedUser.email}</p>
              <div className="flex items-center mt-2 gap-2">
                {/* 用户有效状态徽章 */}
                <span className={getStatusBadgeClass(statusConfig)}>
                  {statusConfig.label}
                </span>
                {/* 租户状态提示 */}
                {selectedUser.tenant?.status && selectedUser.tenant.status !== 'ACTIVE' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    Tenant: {selectedUser.tenant.status}
                  </span>
                )}
                {/* 角色徽章 */}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  selectedUser.role === 'SUPER_ADMIN'
                    ? 'bg-purple-100 text-purple-800'
                    : selectedUser.role === 'TENANT_ADMIN'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  {selectedUser.role}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          {isEditing ? (
            /* 编辑表单 */
            <div className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="avatar">Avatar URL</Label>
                <Input
                  id="avatar"
                  name="avatar"
                  value={formData.avatar}
                  onChange={handleInputChange}
                  placeholder="https://example.com/avatar.jpg"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Email (Read-only)</Label>
                <Input value={selectedUser.email} disabled className="mt-1 bg-gray-50" />
              </div>
            </div>
          ) : (
            /* 信息展示 */
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </dt>
                <dd className="mt-1 text-sm text-gray-900">{selectedUser.email}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Building2 className="h-4 w-4 mr-2" />
                  Tenant
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {selectedUser.tenant?.companyName || 'Platform Admin'}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Created At
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(selectedUser.createdAt).toLocaleDateString()}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Last Updated
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(selectedUser.updatedAt).toLocaleDateString()}
                </dd>
              </div>

              {selectedUser.languagePreference && (
                <>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Language</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {selectedUser.languagePreference.preferredLanguage}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-sm font-medium text-gray-500">Timezone</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {selectedUser.languagePreference.timezone}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          )}
        </div>
      </div>

      {/* 操作区域 */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Actions</h3>
        </div>
        <div className="px-6 py-4">
          <div className="flex flex-wrap gap-3">
            {/* 启用/停用按钮 */}
            <Button
              variant={selectedUser.isActive ? 'outline' : 'default'}
              onClick={handleToggleStatus}
              disabled={!canToggleStatus || isUpdating}
              title={!canToggleStatus ? 'Cannot change status: Tenant is not active' : ''}
            >
              {selectedUser.isActive ? (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Deactivate User
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Activate User
                </>
              )}
            </Button>
            {!canToggleStatus && (
              <span className="text-sm text-orange-600 self-center">
                (Tenant is {selectedUser.tenant?.status})
              </span>
            )}

            {/* 删除按钮 */}
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete User
            </Button>
          </div>
        </div>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete user "{selectedUser.username}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="deleteReason">Reason (Optional)</Label>
              <Input
                id="deleteReason"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Enter reason for deletion..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
