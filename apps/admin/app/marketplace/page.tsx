'use client'

import { useState, useEffect } from 'react'
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
  CogIcon,
  UserGroupIcon,
  ChartBarIcon,
  BoltIcon,
  DevicePhoneMobileIcon,
} from '@heroicons/react/24/outline'
import { apiClient } from '@/lib/api'

// 临时类型定义，应该移到共享类型文件中
type SaaSApp = any;
type AuthProvider = any;
type MarketplaceCategory = any;



export default function MarketplacePage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [activeTab, setActiveTab] = useState('saas-apps')

  // API data states
  const [saasApps, setSaasApps] = useState<SaaSApp[]>([])
  const [authProviders, setAuthProviders] = useState<AuthProvider[]>([])
  const [categories, setCategories] = useState<MarketplaceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Load SaaS apps
        // const appsResponse = await apiClient.getMarketplaceApps({
        //   category: selectedCategory === 'All' ? undefined : selectedCategory,
        //   search: searchTerm || undefined,
        // })
        // Mock response for now
        const appsResponse = { success: true, data: [] }

        if (appsResponse.success && appsResponse.data) {
          setSaasApps((appsResponse.data as any).data || [])
        }

        // Load categories
        // const categoriesResponse = await apiClient.getMarketplaceCategories()
        // Mock response for now
        const categoriesResponse = { success: true, data: [] }
        if (categoriesResponse.success && categoriesResponse.data) {
          setCategories([
            { id: 'All', name: 'All', count: 0 },
            ...categoriesResponse.data
          ])
        }

        // Load auth providers
        // const providersResponse = await apiClient.getAuthProviders()
        // Mock response for now
        const providersResponse = { success: true, data: [] }
        if (providersResponse.success && providersResponse.data) {
          setAuthProviders(providersResponse.data)
        }

      } catch (err) {
        console.error('Failed to load marketplace data:', err)
        setError('Failed to load marketplace data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [selectedCategory, searchTerm])

  const filteredSaasApps = saasApps.filter(app => {
    const matchesSearch = searchTerm === '' ||
      app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || app.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const filteredAuthPlugins = authProviders.filter(provider => {
    const matchesSearch = searchTerm === '' ||
      provider.name.toLowerCase().includes(searchTerm.toLowerCase())
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

  const handleInstallApp = async (appId: string) => {
    try {
      // const response = await apiClient.installApp(appId)
      // Mock response for now
      const response = { success: true }
      if (response.success) {
        // Refresh the apps list
        // const appsResponse = await apiClient.getMarketplaceApps({
        //   category: selectedCategory === 'All' ? undefined : selectedCategory,
        //   search: searchTerm || undefined,
        // })
        // Mock response for now
        const appsResponse = { success: true, data: { data: [] } }
        if (appsResponse.success && appsResponse.data) {
          setSaasApps(appsResponse.data.data || [])
        }
      } else {
        setError((response as any).error || 'Failed to install app')
      }
    } catch (err) {
      console.error('Failed to install app:', err)
      setError('Failed to install app')
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading marketplace...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
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
                <ChartBarIcon className="w-6 h-6 text-orange-600" />
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
                    <SelectItem key={category.id} value={category.id}>
                      {category.name} {category.count > 0 && `(${category.count})`}
                    </SelectItem>
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
                        <span className="text-sm text-gray-500">({app.reviewCount})</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <ArrowDownTrayIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500">{app.totalInstalls}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">${app.price}</p>
                      <p className="text-xs text-gray-500">/{app.billingType}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {app.features.slice(0, 2).map((feature: any, index: number) => (
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
                      variant="default"
                      onClick={() => handleInstallApp(app.id)}
                    >
                      Install
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
            {filteredAuthPlugins.length > 0 ? (
              filteredAuthPlugins.map((provider) => (
                <Card key={provider.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <ShieldCheckIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{provider.name}</CardTitle>
                          <CardDescription>v{provider.version}</CardDescription>
                        </div>
                      </div>
                      <Badge
                        className={
                          provider.isLicensed
                            ? "bg-green-100 text-green-800"
                            : provider.isConfigured
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }
                      >
                        {provider.isLicensed ? 'Licensed' : provider.isConfigured ? 'Configured' : 'Available'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 text-sm mb-4">
                      OAuth 2.0 authentication provider for {provider.name.toLowerCase()} social login
                    </p>

                    <div className="mb-4">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-xs">OAuth 2.0</Badge>
                        <Badge variant="outline" className="text-xs">Social Login</Badge>
                        <Badge variant="outline" className="text-xs">Secure</Badge>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        className="flex-1"
                        variant={provider.isLicensed ? "outline" : "default"}
                        disabled={provider.isLicensed}
                      >
                        {provider.isLicensed ? 'Licensed' : 'Purchase'}
                      </Button>
                      <Link href={`/marketplace/auth/${provider.id}/config`}>
                        <Button variant="outline" size="sm">
                          Configure
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <ShieldCheckIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No authentication providers found</p>
                <p className="text-sm text-gray-500 mt-2">
                  {searchTerm ? 'Try adjusting your search terms' : 'Check back later for new providers'}
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
