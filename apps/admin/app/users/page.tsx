/**
 * Users Management Page - Super Admin
 *
 * 列表只做入口：搜索/筛选、统计卡片、进入详情页
 * 所有操作（编辑、状态切换、删除）统一在详情页 /users/[id] 进行
 *
 * 只展示普通终端用户（role === 'USER'）
 * 不展示 TENANT_ADMIN、SUPER_ADMIN
 */
'use client'

import { User, Users, ChevronLeft, ChevronRight, Eye, XCircle, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useUsersStore } from '@/store/users'
import { getUserStatusConfig, getStatusBadgeClass } from '@/lib/status-utils'

// ============ Main Page Component ============
export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState('')
  // 状态筛选：ACTIVE/INACTIVE（基于 effectiveStatus）
  const [statusFilter, setStatusFilter] = useState('all')

  // 使用 Zustand store 获取用户数据
  const {
    users,
    isLoading: loading,
    stats,
    pagination,
    setFilters,
    setPage,
    setLimit,
    fetchUsers,
    fetchUserStats
  } = useUsersStore()

  useEffect(() => {
    fetchUsers()
    fetchUserStats()
  }, [])

  useEffect(() => {
    // 后端已强制 role='USER'，前端只需传 search 和 isActive
    setFilters({
      search: searchTerm,
      isActive: statusFilter !== 'all' ? statusFilter === 'ACTIVE' : undefined
    })
  }, [searchTerm, statusFilter, setFilters])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage end users across all tenants (role: USER only)
          </p>
        </div>
        <Button onClick={() => { fetchUsers(); fetchUserStats() }} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || users.length}</div>
            <p className="text-xs text-muted-foreground">All tenants</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeUsers || users.filter(u => u.effectiveStatus === 'ACTIVE').length}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Users</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.inactiveUsers || users.filter(u => u.effectiveStatus === 'INACTIVE').length}</div>
            <p className="text-xs text-muted-foreground">Currently inactive</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tenants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.uniqueTenants || new Set(users.map(u => u.tenantId)).size}</div>
            <p className="text-xs text-muted-foreground">Unique tenants</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {/* 状态筛选：基于 effectiveStatus (ACTIVE/INACTIVE) */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Users</CardTitle>
            <div className="text-sm text-muted-foreground">
              {pagination.total > 0 ? (
                <>
                  Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </>
              ) : (
                'No users'
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">No users found</div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => {
                const statusConfig = getUserStatusConfig(user.effectiveStatus);
                return (
                  <Link key={user.id} href={`/users/${user.id}`}>
                    <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{user.firstName || user.username} {user.lastName || ''}</h3>
                            {/* 用户有效状态徽章 */}
                            <span className={getStatusBadgeClass(statusConfig)}>
                              {statusConfig.label}
                            </span>
                            {/* 租户状态提示（如果租户非 ACTIVE） */}
                            {user.tenant?.status && user.tenant.status !== 'ACTIVE' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                Tenant: {user.tenant.status}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <p className="text-sm text-muted-foreground">
                            Tenant: {user.tenant?.companyName || user.tenantId || 'N/A'}
                            {user.lastLoginAt && ` • Last login: ${new Date(user.lastLoginAt).toLocaleDateString()}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" title="View Details">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">Per page:</span>
                    <select
                      value={pagination.limit}
                      onChange={(e) => setLimit(parseInt(e.target.value))}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(pagination.page - 1)}
                      disabled={pagination.page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <span className="text-sm text-muted-foreground">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
