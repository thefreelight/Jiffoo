/**
 * Customer Detail Page
 *
 * Displays detailed information about a specific customer including
 * contact info, account details, timeline, and recent activity.
 */
'use client'

import { AlertTriangle, ArrowLeft, Calendar, Mail, Pencil, ShieldCheck, Trash2, User } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useUser, useDeleteUser } from '@/lib/hooks/use-api'
import { useT } from 'shared/src/i18n'


export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const { data: user, isLoading, error, refetch } = useUser(userId)
  const deleteUserMutation = useDeleteUser()

  const handleDelete = async () => {
    if (window.confirm(getText('tenant.customers.detail.deleteConfirm', 'Are you sure you want to delete this user? This action cannot be undone.'))) {
      try {
        await deleteUserMutation.mutateAsync(userId)
        router.push('/customers')
      } catch (error) {
        console.error('Failed to delete user:', error)
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{getText('tenant.customers.detail.loading', 'Loading customer details...')}</p>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{getText('tenant.customers.detail.customerNotFound', 'Customer Not Found')}</h2>
          <p className="text-gray-600 mb-6">{getText('tenant.customers.detail.customerNotFoundDesc', "The customer you're looking for doesn't exist or has been deleted.")}</p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {getText('tenant.customers.detail.goBack', 'Go Back')}
            </Button>
            <Button onClick={() => refetch()}>
              {getText('tenant.customers.detail.retry', 'Retry')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const getRoleBadge = (role: string) => {
    const roleColors: Record<string, string> = {
      SUPER_ADMIN: 'bg-purple-100 text-purple-800',
      TENANT_ADMIN: 'bg-blue-100 text-blue-800',
      USER: 'bg-gray-100 text-gray-800',
    }
    return roleColors[role] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {getText('tenant.customers.detail.back', 'Back')}
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{user.username}</h1>
            <p className="text-sm text-gray-500 mt-1">{getText('tenant.customers.detail.customerId', 'Customer ID')}: {user.id}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Pencil className="w-4 h-4 mr-2" />
            {getText('tenant.customers.detail.edit', 'Edit')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteUserMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {deleteUserMutation.isPending ? getText('tenant.customers.detail.deleting', 'Deleting...') : getText('tenant.customers.detail.delete', 'Delete')}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col items-center">
              {/* Avatar */}
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold mb-4">
                {user.username.charAt(0).toUpperCase()}
              </div>

              {/* Name and Role */}
              <h2 className="text-2xl font-bold text-gray-900 text-center">{user.username}</h2>
              <span className={`mt-2 px-3 py-1 text-sm font-medium rounded-full ${getRoleBadge(user.role)}`}>
                {user.role}
              </span>

              {/* Stats */}
              <div className="w-full mt-6 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">0</p>
                    <p className="text-sm text-gray-500">{getText('tenant.customers.orders', 'Orders')}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">¥0</p>
                    <p className="text-sm text-gray-500">{getText('tenant.customers.totalSpent', 'Total Spent')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Details Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              {getText('tenant.customers.detail.contactInfo', 'Contact Information')}
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">{getText('tenant.customers.detail.emailAddress', 'Email Address')}</p>
                  <p className="text-base font-medium text-gray-900 mt-1">{user.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">{getText('tenant.customers.username', 'Username')}</p>
                  <p className="text-base font-medium text-gray-900 mt-1">{user.username}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              {getText('tenant.customers.detail.accountInfo', 'Account Information')}
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">{getText('tenant.customers.detail.userId', 'User ID')}</span>
                <span className="text-sm font-medium text-gray-900 break-all">{user.id}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">{getText('tenant.customers.role', 'Role')}</span>
                <span className={`text-sm font-medium px-2 py-1 rounded ${getRoleBadge(user.role)}`}>
                  {user.role}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">{getText('tenant.customers.status', 'Status')}</span>
                <span className="text-sm font-medium text-green-600">{getText('tenant.customers.active', 'Active')}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {getText('tenant.customers.detail.timeline', 'Timeline')}
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">{getText('tenant.customers.detail.accountCreated', 'Account Created')}</span>
                <span className="text-sm font-medium text-gray-900">
                  {new Date(user.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">{getText('tenant.customers.detail.lastUpdated', 'Last Updated')}</span>
                <span className="text-sm font-medium text-gray-900">
                  {new Date(user.updatedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-500">{getText('tenant.customers.detail.lastLogin', 'Last Login')}</span>
                <span className="text-sm font-medium text-gray-900">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : getText('tenant.customers.detail.never', 'Never')}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{getText('tenant.customers.detail.recentActivity', 'Recent Activity')}</h2>
            <div className="text-center py-8">
              <p className="text-gray-500">{getText('tenant.customers.detail.noRecentActivity', 'No recent activity')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

