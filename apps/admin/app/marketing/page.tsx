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
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  TagIcon,
  EnvelopeIcon,
  MegaphoneIcon,
  GiftIcon,
  ChartBarIcon,
  CalendarIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

// Mock marketing data
const campaigns = [
  {
    id: 1,
    name: 'Spring Sale 2024',
    type: 'Promotion',
    status: 'Active',
    startDate: '2024-03-01',
    endDate: '2024-03-31',
    discount: '20%',
    budget: 50000,
    spent: 32000,
    clicks: 12500,
    conversions: 234,
    revenue: 156000,
  },
  {
    id: 2,
    name: 'New Customer Welcome',
    type: 'Email Campaign',
    status: 'Active',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    discount: '15%',
    budget: 20000,
    spent: 8500,
    clicks: 5600,
    conversions: 89,
    revenue: 45000,
  },
  {
    id: 3,
    name: 'Flash Sale Weekend',
    type: 'Promotion',
    status: 'Completed',
    startDate: '2024-01-13',
    endDate: '2024-01-14',
    discount: '50%',
    budget: 30000,
    spent: 28000,
    clicks: 18900,
    conversions: 456,
    revenue: 234000,
  },
  {
    id: 4,
    name: 'VIP Member Exclusive',
    type: 'Coupon',
    status: 'Scheduled',
    startDate: '2024-02-01',
    endDate: '2024-02-29',
    discount: '30%',
    budget: 40000,
    spent: 0,
    clicks: 0,
    conversions: 0,
    revenue: 0,
  },
]

const coupons = [
  {
    id: 'SPRING20',
    name: 'Spring Sale 20% Off',
    type: 'Percentage',
    value: 20,
    minOrder: 500,
    usage: 234,
    limit: 1000,
    status: 'Active',
    expires: '2024-03-31',
  },
  {
    id: 'WELCOME15',
    name: 'New Customer 15% Off',
    type: 'Percentage',
    value: 15,
    minOrder: 200,
    usage: 89,
    limit: 500,
    status: 'Active',
    expires: '2024-12-31',
  },
  {
    id: 'FLASH50',
    name: 'Flash Sale 50% Off',
    type: 'Percentage',
    value: 50,
    minOrder: 1000,
    usage: 456,
    limit: 500,
    status: 'Expired',
    expires: '2024-01-14',
  },
]

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState('campaigns')
  const [searchTerm, setSearchTerm] = useState('')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800'
      case 'Completed':
        return 'bg-blue-100 text-blue-800'
      case 'Scheduled':
        return 'bg-yellow-100 text-yellow-800'
      case 'Expired':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Promotion':
        return <TagIcon className="w-4 h-4" />
      case 'Email Campaign':
        return <EnvelopeIcon className="w-4 h-4" />
      case 'Coupon':
        return <TagIcon className="w-4 h-4" />
      default:
        return <MegaphoneIcon className="w-4 h-4" />
    }
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing</h1>
          <p className="text-gray-600 mt-1">Manage campaigns, promotions, and customer engagement</p>
        </div>
        <div className="flex space-x-3">
          <Link href="/marketing/campaigns/create">
            <Button variant="outline">
              <MegaphoneIcon className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </Link>
          <Link href="/marketing/coupons/create">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <GiftIcon className="w-4 h-4 mr-2" />
              Create Coupon
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Campaigns</p>
                <p className="text-2xl font-bold text-gray-900">8</p>
                <p className="text-sm text-green-600 mt-1">+2 this month</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <MegaphoneIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Clicks</p>
                <p className="text-2xl font-bold text-gray-900">37,000</p>
                <p className="text-sm text-green-600 mt-1">+15.3% vs last month</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <ChartBarIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Conversions</p>
                <p className="text-2xl font-bold text-gray-900">779</p>
                <p className="text-sm text-green-600 mt-1">2.1% conversion rate</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TagIcon className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Revenue</p>
                <p className="text-2xl font-bold text-gray-900">¥435K</p>
                <p className="text-sm text-green-600 mt-1">+22.5% vs last month</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <TagIcon className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Marketing Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common marketing tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/marketing/campaigns/create">
              <Button variant="outline" className="w-full justify-start">
                <MegaphoneIcon className="w-4 h-4 mr-2" />
                Create Campaign
              </Button>
            </Link>
            <Link href="/marketing/coupons/create">
              <Button variant="outline" className="w-full justify-start">
                <GiftIcon className="w-4 h-4 mr-2" />
                Create Coupon
              </Button>
            </Link>
            <Link href="/marketing/emails">
              <Button variant="outline" className="w-full justify-start">
                <EnvelopeIcon className="w-4 h-4 mr-2" />
                Email Campaign
              </Button>
            </Link>
            <Link href="/marketing/analytics">
              <Button variant="outline" className="w-full justify-start">
                <ChartBarIcon className="w-4 h-4 mr-2" />
                View Analytics
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Campaigns */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Campaigns</CardTitle>
            <CardDescription>Latest marketing activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {campaigns.slice(0, 3).map((campaign) => (
                <div key={campaign.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      {getTypeIcon(campaign.type)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{campaign.name}</p>
                      <p className="text-xs text-gray-600">{campaign.type}</p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(campaign.status)}>
                    {campaign.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Summary</CardTitle>
            <CardDescription>This month's results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Click-through Rate</span>
                <span className="font-medium text-gray-900">3.2%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Conversion Rate</span>
                <span className="font-medium text-gray-900">2.1%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">ROI</span>
                <span className="font-medium text-green-600">+245%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Customer Acquisition Cost</span>
                <span className="font-medium text-gray-900">¥45</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'campaigns'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Campaigns
            </button>
            <button
              onClick={() => setActiveTab('coupons')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'coupons'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Coupons
            </button>
            <button
              onClick={() => setActiveTab('emails')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'emails'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Email Campaigns
            </button>
          </nav>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Select defaultValue="All">
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="Expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <FunnelIcon className="w-4 h-4 mr-2" />
                More Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <CardContent className="p-6">
          {activeTab === 'campaigns' && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 font-medium text-gray-900">Campaign</th>
                        <th className="text-left py-3 font-medium text-gray-900">Type</th>
                        <th className="text-left py-3 font-medium text-gray-900">Status</th>
                        <th className="text-left py-3 font-medium text-gray-900">Period</th>
                        <th className="text-left py-3 font-medium text-gray-900">Budget</th>
                        <th className="text-left py-3 font-medium text-gray-900">Performance</th>
                        <th className="text-left py-3 font-medium text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {campaigns.map((campaign) => (
                        <tr key={campaign.id} className="hover:bg-gray-50">
                          <td className="py-4">
                            <div>
                              <div className="font-medium text-gray-900">{campaign.name}</div>
                              <div className="text-sm text-gray-500">{campaign.discount} discount</div>
                            </div>
                          </td>
                          <td className="py-4">
                            <div className="flex items-center">
                              {getTypeIcon(campaign.type)}
                              <span className="ml-2 text-gray-600">{campaign.type}</span>
                            </div>
                          </td>
                          <td className="py-4">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(campaign.status)}`}>
                              {campaign.status}
                            </span>
                          </td>
                          <td className="py-4 text-gray-600">
                            <div className="text-sm">
                              <div>{campaign.startDate}</div>
                              <div>to {campaign.endDate}</div>
                            </div>
                          </td>
                          <td className="py-4">
                            <div className="text-sm">
                              <div className="text-gray-900">¥{campaign.spent.toLocaleString()} / ¥{campaign.budget.toLocaleString()}</div>
                              <div className="text-gray-500">{Math.round((campaign.spent / campaign.budget) * 100)}% used</div>
                            </div>
                          </td>
                          <td className="py-4">
                            <div className="text-sm">
                              <div className="text-gray-900">{campaign.clicks.toLocaleString()} clicks</div>
                              <div className="text-gray-500">{campaign.conversions} conversions</div>
                            </div>
                          </td>
                          <td className="py-4">
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
              )}

              {activeTab === 'coupons' && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 font-medium text-gray-900">Coupon Code</th>
                        <th className="text-left py-3 font-medium text-gray-900">Name</th>
                        <th className="text-left py-3 font-medium text-gray-900">Discount</th>
                        <th className="text-left py-3 font-medium text-gray-900">Min Order</th>
                        <th className="text-left py-3 font-medium text-gray-900">Usage</th>
                        <th className="text-left py-3 font-medium text-gray-900">Status</th>
                        <th className="text-left py-3 font-medium text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {coupons.map((coupon) => (
                        <tr key={coupon.id} className="hover:bg-gray-50">
                          <td className="py-4">
                            <div className="font-mono text-blue-600 font-medium">{coupon.id}</div>
                          </td>
                          <td className="py-4">
                            <div className="font-medium text-gray-900">{coupon.name}</div>
                            <div className="text-sm text-gray-500">Expires: {coupon.expires}</div>
                          </td>
                          <td className="py-4 text-gray-900">{coupon.value}%</td>
                          <td className="py-4 text-gray-600">¥{coupon.minOrder}</td>
                          <td className="py-4">
                            <div className="text-sm">
                              <div className="text-gray-900">{coupon.usage} / {coupon.limit}</div>
                              <div className="text-gray-500">{Math.round((coupon.usage / coupon.limit) * 100)}% used</div>
                            </div>
                          </td>
                          <td className="py-4">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(coupon.status)}`}>
                              {coupon.status}
                            </span>
                          </td>
                          <td className="py-4">
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
              )}

              {activeTab === 'emails' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Email Templates */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Email Templates</CardTitle>
                        <CardDescription>Pre-designed email templates</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {[
                            { name: 'Welcome Email', usage: 234, type: 'Automated' },
                            { name: 'Order Confirmation', usage: 1567, type: 'Transactional' },
                            { name: 'Newsletter', usage: 89, type: 'Marketing' },
                            { name: 'Abandoned Cart', usage: 156, type: 'Automated' },
                          ].map((template, index) => (
                            <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{template.name}</p>
                                <p className="text-xs text-gray-600">{template.type} • {template.usage} sent</p>
                              </div>
                              <Button variant="outline" size="sm">Edit</Button>
                            </div>
                          ))}
                        </div>
                        <Button className="w-full mt-4" variant="outline">
                          <PlusIcon className="w-4 h-4 mr-2" />
                          Create Template
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Email Campaigns */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Active Campaigns</CardTitle>
                        <CardDescription>Running email campaigns</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {[
                            { name: 'Spring Sale Newsletter', sent: 5600, opened: 1680, clicked: 234 },
                            { name: 'Product Launch', sent: 3200, opened: 1280, clicked: 156 },
                            { name: 'Customer Survey', sent: 1200, opened: 480, clicked: 89 },
                          ].map((campaign, index) => (
                            <div key={index} className="p-3 border border-gray-200 rounded-lg">
                              <p className="font-medium text-gray-900 text-sm">{campaign.name}</p>
                              <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-600">Sent: {campaign.sent}</span>
                                  <span className="text-gray-600">Opened: {Math.round((campaign.opened / campaign.sent) * 100)}%</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-600">Clicked: {campaign.clicked}</span>
                                  <span className="text-gray-600">CTR: {Math.round((campaign.clicked / campaign.sent) * 100)}%</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button className="w-full mt-4">
                          <EnvelopeIcon className="w-4 h-4 mr-2" />
                          Create Campaign
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Email Analytics */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Email Analytics</CardTitle>
                        <CardDescription>Performance metrics</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-gray-900">24.5%</p>
                            <p className="text-sm text-gray-600">Average Open Rate</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-gray-900">3.2%</p>
                            <p className="text-sm text-gray-600">Average Click Rate</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-gray-900">0.8%</p>
                            <p className="text-sm text-gray-600">Unsubscribe Rate</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">¥156K</p>
                            <p className="text-sm text-gray-600">Email Revenue</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Email Subscribers */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Email Subscribers</CardTitle>
                      <CardDescription>Manage your email subscriber list</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <p className="text-2xl font-bold text-blue-600">12,456</p>
                          <p className="text-sm text-gray-600">Total Subscribers</p>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">+234</p>
                          <p className="text-sm text-gray-600">New This Month</p>
                        </div>
                        <div className="text-center p-4 bg-orange-50 rounded-lg">
                          <p className="text-2xl font-bold text-orange-600">89</p>
                          <p className="text-sm text-gray-600">Unsubscribed</p>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <p className="text-2xl font-bold text-purple-600">95.2%</p>
                          <p className="text-sm text-gray-600">Active Rate</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex space-x-3">
                          <Button variant="outline">
                            <UserGroupIcon className="w-4 h-4 mr-2" />
                            Manage Segments
                          </Button>
                          <Button variant="outline">
                            <PlusIcon className="w-4 h-4 mr-2" />
                            Import Subscribers
                          </Button>
                        </div>
                        <Button>
                          <EnvelopeIcon className="w-4 h-4 mr-2" />
                          Send Newsletter
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }
