'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  StarIcon,
  ArrowDownTrayIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  CogIcon,
  UserGroupIcon,
  ChartBarIcon,
  BoltIcon,
  DevicePhoneMobileIcon,
} from '@heroicons/react/24/outline'

// Mock data for SaaS applications
const saasApps = [
  {
    id: 'analytics-pro',
    name: 'Analytics Pro',
    description: 'Advanced analytics and reporting for your e-commerce business',
    author: 'Your Company',
    category: 'Analytics',
    price: 49.99,
    currency: 'USD',
    billing: 'monthly',
    rating: 4.8,
    reviews: 234,
    installs: 1567,
    logo: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=64&h=64&fit=crop',
    features: ['Real-time analytics', 'Custom dashboards', 'Export reports', 'API access'],
    isInstalled: false,
  },
  {
    id: 'crm-suite',
    name: 'CRM Suite',
    description: 'Complete customer relationship management solution',
    author: 'Your Company',
    category: 'Productivity',
    price: 79.99,
    currency: 'USD',
    billing: 'monthly',
    rating: 4.6,
    reviews: 189,
    installs: 892,
    logo: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=64&h=64&fit=crop',
    features: ['Contact management', 'Sales pipeline', 'Email integration', 'Mobile app'],
    isInstalled: true,
  },
  {
    id: 'inventory-manager',
    name: 'Inventory Manager',
    description: 'Smart inventory management with predictive analytics',
    author: 'Your Company',
    category: 'Operations',
    price: 39.99,
    currency: 'USD',
    billing: 'monthly',
    rating: 4.7,
    reviews: 156,
    installs: 743,
    logo: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=64&h=64&fit=crop',
    features: ['Stock tracking', 'Low stock alerts', 'Demand forecasting', 'Supplier management'],
    isInstalled: false,
  },
]

// Mock data for authentication plugins
const authPlugins = [
  {
    id: 'wechat-login',
    name: 'WeChat Login',
    description: 'Enable WeChat social login for Chinese customers',
    price: 29.99,
    currency: 'USD',
    billing: 'monthly',
    rating: 4.9,
    reviews: 89,
    installs: 456,
    logo: 'https://images.unsplash.com/photo-1611262588024-d12430b98920?w=64&h=64&fit=crop',
    features: ['WeChat OAuth 2.0', 'Mobile optimized', 'User profile sync', 'Secure authentication'],
    isInstalled: false,
    isLicensed: false,
  },
  {
    id: 'google-login',
    name: 'Google Login',
    description: 'Google OAuth 2.0 authentication integration',
    price: 19.99,
    currency: 'USD',
    billing: 'monthly',
    rating: 4.8,
    reviews: 234,
    installs: 1234,
    logo: 'https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=64&h=64&fit=crop',
    features: ['Google OAuth 2.0', 'One-click login', 'Profile import', 'Multi-language'],
    isInstalled: true,
    isLicensed: true,
  },
  {
    id: 'github-login',
    name: 'GitHub Login',
    description: 'GitHub OAuth authentication for developers',
    price: 15.99,
    currency: 'USD',
    billing: 'monthly',
    rating: 4.7,
    reviews: 67,
    installs: 234,
    logo: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=64&h=64&fit=crop',
    features: ['GitHub OAuth', 'Developer profiles', 'Repository access', 'Team integration'],
    isInstalled: false,
    isLicensed: false,
  },
]

export default function MarketplacePage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [activeTab, setActiveTab] = useState('saas-apps')

  const categories = ['All', 'Analytics', 'Productivity', 'Operations', 'Marketing', 'Finance']

  const filteredSaasApps = saasApps.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         app.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || app.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const filteredAuthPlugins = authPlugins.filter(plugin => {
    const matchesSearch = plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         plugin.description.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const getStatusBadge = (app: any) => {
    if (app.isInstalled) {
      return <Badge className="bg-green-100 text-green-800">Installed</Badge>
    }
    if (app.isLicensed) {
      return <Badge className="bg-blue-100 text-blue-800">Licensed</Badge>
    }
    return <Badge variant="outline">Available</Badge>
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketplace</h1>
          <p className="text-gray-600 mt-1">Discover and install SaaS applications and authentication plugins</p>
        </div>
        <div className="flex space-x-3">
          <Link href="/marketplace/developer">
            <Button variant="outline">
              <PlusIcon className="w-4 h-4 mr-2" />
              Publish App
            </Button>
          </Link>
          <Link href="/marketplace/my-apps">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <CogIcon className="w-4 h-4 mr-2" />
              My Apps
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
                <p className="text-sm font-medium text-gray-600">Installed Apps</p>
                <p className="text-2xl font-bold text-gray-900">12</p>
                <p className="text-sm text-green-600 mt-1">+2 this month</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <ArrowDownTrayIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Monthly Spend</p>
                <p className="text-2xl font-bold text-gray-900">$289</p>
                <p className="text-sm text-gray-600 mt-1">Across all apps</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Auth Plugins</p>
                <p className="text-2xl font-bold text-gray-900">3</p>
                <p className="text-sm text-blue-600 mt-1">2 active</p>
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
                <p className="text-sm font-medium text-gray-600">Available Apps</p>
                <p className="text-2xl font-bold text-gray-900">156</p>
                <p className="text-sm text-gray-600 mt-1">In marketplace</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <GlobeAltIcon className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search apps and plugins..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="saas-apps">SaaS Applications</TabsTrigger>
          <TabsTrigger value="auth-plugins">Authentication Plugins</TabsTrigger>
        </TabsList>

        <TabsContent value="saas-apps" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSaasApps.map((app) => (
              <Card key={app.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <img
                        src={app.logo}
                        alt={app.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div>
                        <CardTitle className="text-lg">{app.name}</CardTitle>
                        <CardDescription>{app.author}</CardDescription>
                      </div>
                    </div>
                    {getStatusBadge(app)}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm mb-4">{app.description}</p>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <StarIcon className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-sm font-medium">{app.rating}</span>
                        <span className="text-sm text-gray-500">({app.reviews})</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <ArrowDownTrayIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500">{app.installs}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">${app.price}</p>
                      <p className="text-xs text-gray-500">/{app.billing}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {app.features.slice(0, 2).map((feature, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                      {app.features.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{app.features.length - 2} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      className="flex-1"
                      variant={app.isInstalled ? "outline" : "default"}
                      disabled={app.isInstalled}
                    >
                      {app.isInstalled ? 'Installed' : 'Install'}
                    </Button>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="auth-plugins" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAuthPlugins.map((plugin) => (
              <Card key={plugin.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <img
                        src={plugin.logo}
                        alt={plugin.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div>
                        <CardTitle className="text-lg">{plugin.name}</CardTitle>
                        <CardDescription>Authentication Plugin</CardDescription>
                      </div>
                    </div>
                    {getStatusBadge(plugin)}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm mb-4">{plugin.description}</p>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <StarIcon className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-sm font-medium">{plugin.rating}</span>
                        <span className="text-sm text-gray-500">({plugin.reviews})</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <ArrowDownTrayIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500">{plugin.installs}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">${plugin.price}</p>
                      <p className="text-xs text-gray-500">/{plugin.billing}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {plugin.features.slice(0, 2).map((feature, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                      {plugin.features.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{plugin.features.length - 2} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      className="flex-1"
                      variant={plugin.isInstalled ? "outline" : "default"}
                      disabled={plugin.isInstalled}
                    >
                      {plugin.isInstalled ? 'Installed' : 'Purchase'}
                    </Button>
                    <Button variant="outline" size="sm">
                      Configure
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
