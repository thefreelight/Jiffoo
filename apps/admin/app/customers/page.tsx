'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '../../components/ui/button'
import { useUsers } from '../../lib/hooks/use-api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  EnvelopeIcon,
  PhoneIcon,
  UserPlusIcon,
  ExclamationTriangleIcon,
  UsersIcon,
  CurrencyDollarIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline'

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // API hooks - 调用真实的后端API
  const {
    data: usersResponse,
    isLoading,
    error,
    refetch
  } = useUsers({
    page: currentPage,
    limit: pageSize,
    search: searchTerm
  })

  console.log('Users API Response:', usersResponse); // 调试日志

  // 从API响应中提取数据
  const users = usersResponse?.data || []
  const pagination = usersResponse?.pagination || {
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 0
  }

  // Filter users locally for immediate feedback
  const filteredCustomers = users.filter((user: any) => {
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

  const getCustomerStatus = (user: any) => {
    if (user.role === 'VIP') return 'VIP'
    return 'Active' // 默认所有用户都是活跃的
  }

  // Calculate stats from users data
  const customerStats = {
    total: pagination.total,
    active: users.length, // 所有用户都被认为是活跃的
    vip: users.filter((user: any) => user.role === 'VIP').length,
    newThisMonth: users.filter((user: any) => {
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
              <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load customers</h3>
              <p className="text-gray-600 mb-4">
                Error: {error instanceof Error ? error.message : 'Unknown error'}
              </p>
              <Button onClick={() => refetch()}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            <p className="text-gray-600 mt-1">Manage your customer relationships</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <UserPlusIcon className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Total Customers</p>
                    <p className="text-2xl font-bold text-gray-900">{customerStats.total.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <UsersIcon className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Active</p>
                    <p className="text-2xl font-bold text-green-600">{customerStats.active}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <UsersIcon className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">VIP</p>
                    <p className="text-2xl font-bold text-purple-600">{customerStats.vip}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <UsersIcon className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">New This Month</p>
                    <p className="text-2xl font-bold text-blue-600">{customerStats.newThisMonth}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <UserPlusIcon className="w-6 h-6 text-blue-600" />
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
                    <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search customers by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Status</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="VIP">VIP</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline">
                    <FunnelIcon className="w-4 h-4 mr-2" />
                    More Filters
                  </Button>
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
                      <th className="text-left py-3 px-6 font-medium text-gray-900">Customer</th>
                      <th className="text-left py-3 px-6 font-medium text-gray-900">Contact</th>
                      <th className="text-left py-3 px-6 font-medium text-gray-900">Join Date</th>
                      <th className="text-left py-3 px-6 font-medium text-gray-900">Role</th>
                      <th className="text-left py-3 px-6 font-medium text-gray-900">Status</th>
                      <th className="text-left py-3 px-6 font-medium text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <div className="text-gray-500">
                            {searchTerm ? 'No customers found matching your search.' : 'No customers found.'}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((customer: any) => (
                        <tr key={customer.id} className="hover:bg-gray-50">
                          <td className="py-4 px-6">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-gray-200 rounded-full mr-4 flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-600">
                                  {customer.username?.charAt(0)?.toUpperCase() || 'U'}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{customer.username || 'Unknown'}</div>
                                <div className="text-sm text-gray-500">ID: {customer.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="text-sm">
                              <div className="text-gray-900">{customer.email || 'No email'}</div>
                              <div className="text-gray-500">{customer.phone || 'No phone'}</div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-gray-600">
                            {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : 'Unknown'}
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
                              <Link href={`/customers/${customer.id}`}>
                                <Button variant="ghost" size="sm">
                                  <EyeIcon className="w-4 h-4" />
                                </Button>
                              </Link>
                              <Button variant="ghost" size="sm">
                                <EnvelopeIcon className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <PhoneIcon className="w-4 h-4" />
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
                Showing <span className="font-medium">{((currentPage - 1) * pageSize) + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(currentPage * pageSize, pagination.total)}
                </span> of{' '}
                <span className="font-medium">{pagination.total}</span> results
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
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
                  Next
                </Button>
              </div>
            </div>
          )}
    </div>
  )
}
