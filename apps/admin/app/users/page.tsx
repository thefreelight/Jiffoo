'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '../../components/ui/button'
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
  UserPlusIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ShieldCheckIcon,
  UserIcon,
  EnvelopeIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline'

// Mock user data
const users = [
  {
    id: 1,
    name: 'Zhang Wei',
    email: 'zhang.wei@jiffoo.com',
    role: 'Super Admin',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face',
    lastLogin: '2024-01-20T10:30:00Z',
    createdAt: '2023-06-15T09:00:00Z',
    permissions: ['all']
  },
  {
    id: 2,
    name: 'Li Ming',
    email: 'li.ming@jiffoo.com',
    role: 'Admin',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
    lastLogin: '2024-01-19T16:45:00Z',
    createdAt: '2023-08-22T14:30:00Z',
    permissions: ['products', 'orders', 'customers']
  },
  {
    id: 3,
    name: 'Wang Fang',
    email: 'wang.fang@jiffoo.com',
    role: 'Manager',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=40&h=40&fit=crop&crop=face',
    lastLogin: '2024-01-20T08:15:00Z',
    createdAt: '2023-09-10T11:20:00Z',
    permissions: ['orders', 'customers']
  },
  {
    id: 4,
    name: 'Chen Hao',
    email: 'chen.hao@jiffoo.com',
    role: 'Editor',
    status: 'inactive',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=40&h=40&fit=crop&crop=face',
    lastLogin: '2024-01-15T12:00:00Z',
    createdAt: '2023-11-05T16:45:00Z',
    permissions: ['products']
  },
  {
    id: 5,
    name: 'Liu Yan',
    email: 'liu.yan@jiffoo.com',
    role: 'Support',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face',
    lastLogin: '2024-01-19T14:30:00Z',
    createdAt: '2023-12-01T10:15:00Z',
    permissions: ['customers']
  }
]

const roles = [
  {
    name: 'Super Admin',
    description: 'Full access to all features and settings',
    color: 'bg-red-100 text-red-800',
    users: 1
  },
  {
    name: 'Admin',
    description: 'Access to most features except system settings',
    color: 'bg-blue-100 text-blue-800',
    users: 1
  },
  {
    name: 'Manager',
    description: 'Manage orders, customers, and basic operations',
    color: 'bg-green-100 text-green-800',
    users: 1
  },
  {
    name: 'Editor',
    description: 'Manage products and content',
    color: 'bg-purple-100 text-purple-800',
    users: 1
  },
  {
    name: 'Support',
    description: 'Customer support and basic access',
    color: 'bg-orange-100 text-orange-800',
    users: 1
  }
]

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState('All')
  const [selectedStatus, setSelectedStatus] = useState('All')

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = selectedRole === 'All' || user.role === selectedRole
    const matchesStatus = selectedStatus === 'All' || user.status === selectedStatus

    return matchesSearch && matchesRole && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      case 'suspended':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleColor = (role: string) => {
    const roleData = roles.find(r => r.name === role)
    return roleData?.color || 'bg-gray-100 text-gray-800'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatLastLogin = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 24) {
      return `${diffInHours} hours ago`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
      return `${diffInDays} days ago`
    }
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage admin users and their permissions</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">
            <ShieldCheckIcon className="w-4 h-4 mr-2" />
            Manage Roles
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <UserPlusIcon className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{users.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => u.status === 'active').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Roles</p>
                <p className="text-2xl font-bold text-gray-900">{roles.length}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <ShieldCheckIcon className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Online Now</p>
                <p className="text-2xl font-bold text-gray-900">3</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-orange-600" />
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
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Roles</SelectItem>
                  {roles.map(role => (
                    <SelectItem key={role.name} value={role.name}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Users Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                Showing {filteredUsers.length} of {users.length} users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">User</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Role</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Last Login</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <div className="flex items-center">
                            <img
                              src={user.avatar}
                              alt={user.name}
                              className="w-10 h-10 rounded-full mr-3"
                            />
                            <div>
                              <div className="font-medium text-gray-900">{user.name}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <Badge className={getRoleColor(user.role)}>
                            {user.role}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <Badge className={getStatusColor(user.status)}>
                            {user.status}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-gray-600">
                          {formatLastLogin(user.lastLogin)}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-2">
                            <button className="p-1 text-gray-400 hover:text-blue-600">
                              <EyeIcon className="w-4 h-4" />
                            </button>
                            <button className="p-1 text-gray-400 hover:text-blue-600">
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button className="p-1 text-gray-400 hover:text-red-600">
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Roles Sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Roles & Permissions</CardTitle>
              <CardDescription>Manage user roles and access levels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {roles.map((role, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{role.name}</h4>
                      <Badge variant="outline">{role.users} user{role.users !== 1 ? 's' : ''}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{role.description}</p>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">Edit</Button>
                      <Button variant="outline" size="sm">Permissions</Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full mt-4">Create New Role</Button>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest user actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { user: 'Zhang Wei', action: 'Updated product pricing', time: '2 hours ago' },
                  { user: 'Li Ming', action: 'Processed 5 orders', time: '4 hours ago' },
                  { user: 'Wang Fang', action: 'Added new customer', time: '6 hours ago' },
                  { user: 'Liu Yan', action: 'Responded to support ticket', time: '8 hours ago' },
                ].map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <UserIcon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.user}</p>
                      <p className="text-sm text-gray-600">{activity.action}</p>
                      <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
