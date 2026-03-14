'use client'

import { AlertTriangle, Search, Users, Filter, Edit, Trash2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useUsers, useUserStats, useDeleteUser, useUpdateUser, type User } from '@/lib/hooks/use-api'
import { Badge } from '@/components/ui/badge'
import { PageNav } from '@/components/layout/page-nav'
import { StatsCard } from '@/components/dashboard/stats-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useT, useLocale } from 'shared/src/i18n/react'
import { useToast } from '@/hooks/use-toast'


export default function CustomersPage() {
  const t = useT()
  const locale = useLocale()
  const { toast } = useToast()
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
  const deleteUserMutation = useDeleteUser()
  const updateUserMutation = useUpdateUser()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  // Page navigation items for Customers module
  const navItems = [
    { label: getText('merchant.customers.allCustomers', 'All Customers'), href: '/customers', exact: true },
  ]
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // API hooks - Call real backend API, fetch all users
  const {
    data: usersResponse,
    isLoading,
    error,
  } = useUsers({
    page: currentPage,
    limit: pageSize,
    search: searchTerm,
  })
  const { data: userStats } = useUserStats()

  // Extract data from API response
  const users = usersResponse?.data || []
  const pagination = usersResponse?.pagination || {
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 0
  }

  // Filter users locally for immediate feedback
  const filteredCustomers = users.filter((user: User) => {
    if (!user) return false

    // Alpha Gate: Only show users with 'user' role in the Customers list
    const isUser = (user.role || '').toLowerCase() === 'user'

    const matchesSearch = searchTerm === '' ||
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())

    const customerStatus = getCustomerStatus(user)
    const matchesStatus = selectedStatus === 'All' || customerStatus === selectedStatus

    return isUser && matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800'
      case 'Inactive':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  function getCustomerStatus(user: User) {
    return user.isActive ? 'Active' : 'Inactive'
  }

  const handleDeleteUser = async () => {
    if (!deleteUserId) return
    
    try {
      await deleteUserMutation.mutateAsync(deleteUserId)
      setDeleteUserId(null)
    } catch (error) {
      console.error('Failed to delete user:', error)
    }
  }

  const handleStatusUpdate = async (customerId: string, newStatus: string) => {
    try {
      await updateUserMutation.mutateAsync({
        id: customerId,
        data: { isActive: newStatus === 'Active' },
      })
      toast({
        title: getText('merchant.customers.success', 'Success'),
        description: newStatus === 'Active'
          ? getText('merchant.customers.statusActivated', 'User activated')
          : getText('merchant.customers.statusDeactivated', 'User deactivated'),
      })
    } catch (error) {
      console.error('Failed to update user status:', error)
    }
  }

  // Global stats from dedicated stats endpoint
  const customerStats = {
    total: userStats?.metrics.totalUsers ?? 0,
    active: userStats?.metrics.activeUsers ?? 0,
    inactive: userStats?.metrics.inactiveUsers ?? 0,
    newThisMonth: userStats?.metrics.newThisMonth ?? 0,
    totalTrend: userStats?.metrics.totalUsersTrend,
    activeTrend: userStats?.metrics.activeUsersTrend,
    inactiveTrend: userStats?.metrics.inactiveUsersTrend,
    newUsersTrend: userStats?.metrics.newUsersTrend,
  }

  const toTrendDisplay = (value: number | undefined) => {
    const trendValue = value ?? 0
    return {
      change: `${Math.abs(trendValue).toFixed(2)}%`,
      changeType: trendValue >= 0 ? 'increase' as const : 'decrease' as const,
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fcfdfe]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-400 font-bold text-[10px] uppercase tracking-widest">{getText('merchant.customers.loading', 'Syncing Identity Nodes...')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#fcfdfe]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-gray-900 font-bold">{getText('merchant.customers.loadFailed', 'Signal Interference Detected')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full bg-[#fcfdfe] min-h-screen">
      {/* Header Bar */}
      <div className="border-b border-gray-100 pl-20 pr-8 lg:px-8 py-4 sticky top-0 bg-white/80 backdrop-blur-md z-40 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">
            {getText('merchant.customers.title', 'Customers')}
          </h1>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">
            {getText('merchant.customers.subtitle', 'Identity & Access Management')}
          </span>
        </div>
      </div>

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
        {/* In-page Navigation */}
        <PageNav items={navItems} />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title={getText('merchant.customers.totalCustomers', 'Total Customers')}
            value={customerStats.total.toLocaleString()}
            change={toTrendDisplay(customerStats.totalTrend).change}
            changeType={toTrendDisplay(customerStats.totalTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="blue"
            icon={<Users className="w-5 h-5" />}
          />
          <StatsCard
            title={getText('merchant.customers.active', 'Active')}
            value={customerStats.active.toLocaleString()}
            change={toTrendDisplay(customerStats.activeTrend).change}
            changeType={toTrendDisplay(customerStats.activeTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="green"
            icon={<Users className="w-5 h-5" />}
          />
          <StatsCard
            title={getText('merchant.customers.inactive', 'Inactive')}
            value={customerStats.inactive.toLocaleString()}
            change={toTrendDisplay(customerStats.inactiveTrend).change}
            changeType={toTrendDisplay(customerStats.inactiveTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="red"
            icon={<Users className="w-5 h-5" />}
          />
          <StatsCard
            title={getText('merchant.customers.newThisMonth', 'New This Month')}
            value={customerStats.newThisMonth.toLocaleString()}
            change={toTrendDisplay(customerStats.newUsersTrend).change}
            changeType={toTrendDisplay(customerStats.newUsersTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="orange"
            icon={<Users className="w-5 h-5" />}
          />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1">
              <div className="relative group">
                <Search className="w-4 h-4 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  placeholder={getText('merchant.customers.searchPlaceholder', 'Search customers by name or email...')}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full pl-11 pr-4 h-12 bg-gray-50 border-gray-50 rounded-2xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all text-sm font-medium"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-12 min-w-[180px] bg-gray-50 border-gray-50 rounded-2xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 flex items-center px-6 text-sm font-bold text-gray-700">
                  <SelectValue placeholder={getText('merchant.customers.allStatus', 'All Status')} />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-gray-100 shadow-2xl p-2 bg-white">
                  <SelectItem value="All" className="rounded-xl py-2.5 font-semibold">{getText('merchant.customers.allStatus', 'All Status')}</SelectItem>
                  <SelectItem value="Active" className="rounded-xl py-2.5 font-semibold">{getText('merchant.customers.active', 'Active')}</SelectItem>
                  <SelectItem value="Inactive" className="rounded-xl py-2.5 font-semibold">{getText('merchant.customers.inactive', 'Inactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/30">
                  <th className="py-5 px-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.customers.name', 'Customer')}</th>
                  <th className="py-5 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.customers.contact', 'Contact')}</th>
                  <th className="py-5 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.customers.joinDate', 'Join Date')}</th>
                  <th className="py-5 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.customers.role', 'Role')}</th>
                  <th className="py-5 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.customers.status', 'Status')}</th>
                  <th className="py-5 px-8 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.customers.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="text-gray-400 font-medium">
                        {searchTerm ? getText('merchant.customers.noCustomersMatching', 'No customers found matching your search.') : getText('merchant.customers.noCustomersFound', 'No customers found.')}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer: User) => (
                    <tr key={customer.id} className="group hover:bg-blue-50/30 transition-colors">
                      <td className="py-5 px-8">
                        <div className="flex items-center gap-4">
                          <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-gray-100 border border-gray-100 flex-shrink-0 flex items-center justify-center font-bold text-gray-500">
                            {customer.username?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate block">
                              {customer.username || getText('merchant.customers.unknown', 'Unknown')}
                            </span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter truncate opacity-70">
                              ID: {customer.id.substring(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex flex-col">
                          <div className="text-sm font-bold text-gray-900">{customer.email || getText('merchant.customers.noPhone', 'No email')}</div>
                          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{getText('merchant.customers.noPhone', 'No phone')}</div>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="text-sm font-medium text-gray-600">
                          {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : getText('merchant.customers.unknown', 'Unknown')}
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-0 font-bold">
                          {customer.role || 'user'}
                        </Badge>
                      </td>
                      <td className="py-5 px-6">
                        <Select
                          value={getCustomerStatus(customer)}
                          onValueChange={(newStatus) => handleStatusUpdate(customer.id, newStatus)}
                          disabled={updateUserMutation.isPending}
                        >
                          <SelectTrigger
                            className={`h-10 min-w-[130px] bg-gray-50 border-gray-50 rounded-2xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 flex items-center px-4 text-[10px] font-bold uppercase tracking-widest transition-all ${getStatusColor(getCustomerStatus(customer))}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-gray-100 shadow-2xl p-2 bg-white">
                            <SelectItem value="Active" className="rounded-xl py-2.5 font-semibold text-[10px] uppercase tracking-widest">
                              {getText('merchant.customers.active', 'Active')}
                            </SelectItem>
                            <SelectItem value="Inactive" className="rounded-xl py-2.5 font-semibold text-[10px] uppercase tracking-widest">
                              {getText('merchant.customers.inactive', 'Inactive')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-5 px-8 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/${locale}/customers/${customer.id}`}>
                            <Button variant="ghost" size="icon" className="w-9 h-9 rounded-xl hover:bg-white hover:shadow-md transition-all text-gray-400 hover:text-blue-600">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="w-9 h-9 rounded-xl hover:bg-white hover:shadow-md transition-all text-gray-400 hover:text-red-600"
                            onClick={() => setDeleteUserId(customer.id)}
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
        </div>

        {/* Pagination */}
        {pagination && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-12">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] bg-gray-100/50 px-4 py-2 rounded-full border border-gray-100">
              {getText('merchant.customers.showingResults', 'Viewing {from}-{to} of {total} Identities')
                .replace('{from}', String((currentPage - 1) * pageSize + 1))
                .replace('{to}', String(Math.min(currentPage * pageSize, pagination.total)))
                .replace('{total}', String(pagination.total))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-10 rounded-xl border-gray-100 font-bold text-xs hover:bg-gray-50 disabled:opacity-30"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                {getText('merchant.customers.previous', 'Previous')}
              </Button>

              <div className="flex gap-1.5 px-2">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const page = i + 1
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-xl text-xs font-bold transition-all ${currentPage === page ? 'bg-gray-900 text-white shadow-xl scale-110' : 'bg-white text-gray-400 border border-gray-50 hover:border-gray-200'}`}
                    >
                      {page}
                    </button>
                  )
                })}
              </div>

              <Button
                variant="outline"
                className="h-10 rounded-xl border-gray-100 font-bold text-xs hover:bg-gray-50 disabled:opacity-30"
                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                disabled={currentPage === pagination.totalPages}
              >
                {getText('merchant.customers.next', 'Next')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getText('merchant.customers.deleteUserTitle', 'Delete User')}</AlertDialogTitle>
            <AlertDialogDescription>
              {getText('merchant.customers.deleteUserConfirm', 'Are you sure you want to permanently delete this user and related records? This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{getText('merchant.customers.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? getText('merchant.customers.deleting', 'Deleting...') : getText('merchant.customers.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  )
}
