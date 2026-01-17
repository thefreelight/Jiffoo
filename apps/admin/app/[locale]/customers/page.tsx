/**
 * Customers Page for Tenant Application
 *
 * Displays customer list with search, filter, batch operations and pagination.
 * Supports i18n through the translation function.
 * Uses in-page navigation instead of sidebar submenu (Shopify style).
 */

'use client'

import { AlertTriangle, Eye, Search, UserPlus, Users, Filter } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useUsers, type User } from '@/lib/hooks/use-api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageNav } from '@/components/layout/page-nav'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useT, useLocale } from 'shared/src/i18n/react'


export default function CustomersPage() {
  const t = useT()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
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
    refetch
  } = useUsers({
    page: currentPage,
    limit: pageSize,
    search: searchTerm,
  })

  // Debug log
  console.log('Users API Response:', usersResponse);

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

    // Map user status to customer status - All users default to Active
    const customerStatus = 'Active' // Simplified for Alpha
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

  const getCustomerStatus = (user: User) => {
    return 'Active' // Default all users are active
  }

  // Calculate stats from users data
  const customerStats = {
    total: pagination.total,
    active: users.length, // All users are considered active
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">{getText('merchant.customers.loadFailed', 'Failed to load customers')}</h3>
              <p className="text-gray-600 mb-4">
                {getText('merchant.customers.loadError', 'Error: {message}').replace('{message}', error instanceof Error ? error.message : getText('merchant.customers.unknown', 'Unknown'))}
              </p>
              <Button onClick={() => refetch()}>{getText('merchant.customers.tryAgain', 'Try Again')}</Button>
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
            <h1 className="text-2xl font-bold text-gray-900">{getText('merchant.customers.title', 'Customers')}</h1>
            <p className="text-gray-600 mt-1">{getText('merchant.customers.subtitle', 'Manage your customer relationships')}</p>
          </div>
          {/* Add Customer Removed - Read Only */}
        </div>
        {/* In-page Navigation */}
        <PageNav items={navItems} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.customers.totalCustomers', 'Total Customers')}</p>
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
                <p className="text-sm font-medium text-gray-600">{getText('merchant.customers.active', 'Active')}</p>
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
                <p className="text-sm font-medium text-gray-600">{getText('merchant.customers.newThisMonth', 'New This Month')}</p>
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
                  placeholder={getText('merchant.customers.searchPlaceholder', 'Search customers by name or email...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={getText('merchant.customers.allStatus', 'All Status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">{getText('merchant.customers.allStatus', 'All Status')}</SelectItem>
                  <SelectItem value="Active">{getText('merchant.customers.active', 'Active')}</SelectItem>
                  <SelectItem value="Inactive">{getText('merchant.customers.inactive', 'Inactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.customers.name', 'Customer')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.customers.contact', 'Contact')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.customers.joinDate', 'Join Date')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.customers.role', 'Role')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.customers.status', 'Status')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.customers.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <div className="text-gray-500">
                        {searchTerm ? getText('merchant.customers.noCustomersMatching', 'No customers found matching your search.') : getText('merchant.customers.noCustomersFound', 'No customers found.')}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer: User) => (
                    <tr key={customer.id} className="hover:bg-gray-50">

                      <td className="py-4 px-6">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gray-200 rounded-full mr-4 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600">
                              {customer.username?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{customer.username || getText('merchant.customers.unknown', 'Unknown')}</div>
                            <div className="text-sm text-gray-500">ID: {customer.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm">
                          <div className="text-gray-900">{customer.email || getText('merchant.customers.noPhone', 'No email')}</div>
                          <div className="text-gray-500">{getText('merchant.customers.noPhone', 'No phone')}</div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-gray-600">
                        {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : getText('merchant.customers.unknown', 'Unknown')}
                      </td>
                      <td className="py-4 px-6">
                        <Badge className="bg-gray-100 text-gray-800">
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
                            <Button variant="ghost" size="sm" title={getText('merchant.customers.viewDetails', 'View Details')}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          {/* Edit/Delete Actions Removed */}
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
            {getText('merchant.customers.showingResults', 'Showing {from} to {to} of {total} results')
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
              {getText('merchant.customers.previous', 'Previous')}
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
              {getText('merchant.customers.next', 'Next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
