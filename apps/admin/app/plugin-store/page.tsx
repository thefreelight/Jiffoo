'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
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
  ShoppingCartIcon,
  StarIcon,
  ArrowDownTrayIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  CogIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'

interface Plugin {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  pricing: {
    starter?: { price: number; features: string[]; usageLimit?: number };
    professional?: { price: number; features: string[]; usageLimit?: number };
    enterprise?: { price: number; features: string[]; usageLimit?: number };
  };
  features: string[];
  requirements: {
    jiffooVersion: string;
    nodeVersion: string;
  };
  documentation: string;
  support: string;
  status: 'active' | 'inactive' | 'uninstalled';
  isInstalled?: boolean;
  isLicensed?: boolean;
  currentPlan?: string;
}

export default function PluginStorePage() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedPlan, setSelectedPlan] = useState<Record<string, string>>({})

  const categories = ['All', 'Payment', 'Authentication', 'Marketing', 'Analytics', 'AI']

  useEffect(() => {
    const loadPlugins = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('http://localhost:3001/api/plugin-store/plugins', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        })
        const data = await response.json()

        if (data.plugins) {
          setPlugins(data.plugins)
        } else {
          setError('Failed to load plugins')
        }
      } catch (err) {
        console.error('Failed to load plugins:', err)
        setError('Failed to load plugins')
      } finally {
        setLoading(false)
      }
    }

    loadPlugins()
  }, [])

  const filteredPlugins = plugins.filter(plugin => {
    if (selectedCategory === 'All') return true
    return plugin.category.toLowerCase() === selectedCategory.toLowerCase()
  })

  const handlePlanSelect = (pluginId: string, plan: string) => {
    setSelectedPlan(prev => ({ ...prev, [pluginId]: plan }))
  }

  const handlePurchase = async (plugin: Plugin, plan: string) => {
    try {
      // In production, this would integrate with payment processing
      console.log(`Purchasing ${plugin.name} - ${plan} plan`)

      // Mock purchase success
      alert(`Successfully purchased ${plugin.name} (${plan} plan)!\n\nYou will receive license details via email.`)

      // Update plugin status
      setPlugins(prev => prev.map(p =>
        p.id === plugin.id
          ? { ...p, isLicensed: true, currentPlan: plan }
          : p
      ))
    } catch (error) {
      console.error('Purchase failed:', error)
      alert('Purchase failed. Please try again.')
    }
  }

  const getStatusBadge = (plugin: Plugin) => {
    switch (plugin.status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>
      case 'inactive':
        return <Badge className="bg-blue-100 text-blue-800">Installed</Badge>
      case 'uninstalled':
        return <Badge variant="outline">Available</Badge>
      default:
        return <Badge variant="outline">Available</Badge>
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'payment':
        return <CurrencyDollarIcon className="w-5 h-5" />
      case 'authentication':
        return <ShieldCheckIcon className="w-5 h-5" />
      case 'marketing':
        return <StarIcon className="w-5 h-5" />
      case 'analytics':
        return <ChartBarIcon className="w-5 h-5" />
      default:
        return <CogIcon className="w-5 h-5" />
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading plugin store...</p>
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
            <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Plugin Store</h1>
          <p className="text-gray-600 mt-2">
            Extend your Jiffoo Mall with commercial plugins and advanced features
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link href="/business-model">
            <Button variant="outline">
              View Pricing Plans
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <ShoppingCartIcon className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Available Plugins</p>
                <p className="text-2xl font-bold text-gray-900">{plugins.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircleIcon className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Licensed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {plugins.filter(p => p.isLicensed).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <ClockIcon className="w-8 h-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Demo Versions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {plugins.filter(p => p.isInstalled && !p.isLicensed).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CurrencyDollarIcon className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Categories</p>
                <p className="text-2xl font-bold text-gray-900">{categories.length - 1}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plugin Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredPlugins.map((plugin) => {
          const currentPlan = selectedPlan[plugin.id] || 'professional'
          const planDetails = plugin.pricing[currentPlan as keyof typeof plugin.pricing]

          return (
            <Card key={plugin.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      {getCategoryIcon(plugin.category)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{plugin.name}</CardTitle>
                      <CardDescription>v{plugin.version}</CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(plugin)}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm mb-4">{plugin.description}</p>

                {/* Plan Selection */}
                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Select Plan:
                  </label>
                  <Select
                    value={currentPlan}
                    onValueChange={(value) => handlePlanSelect(plugin.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(plugin.pricing).map(([plan, details]) => (
                        <SelectItem key={plan} value={plan}>
                          {plan.charAt(0).toUpperCase() + plan.slice(1)} - ${details.price}/month
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Plan Details */}
                {planDetails && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">
                        ${planDetails.price}/month
                      </span>
                      {planDetails.usageLimit && (
                        <span className="text-sm text-gray-600">
                          {planDetails.usageLimit.toLocaleString()} uses/month
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {planDetails.features.slice(0, 3).map((feature, index) => (
                        <div key={index} className="flex items-center text-sm text-gray-600">
                          <CheckCircleIcon className="w-3 h-3 text-green-500 mr-2" />
                          {feature.replace(/_/g, ' ')}
                        </div>
                      ))}
                      {planDetails.features.length > 3 && (
                        <div className="text-sm text-gray-500">
                          +{planDetails.features.length - 3} more features
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex space-x-2">
                  {plugin.isLicensed ? (
                    <Button className="flex-1" variant="outline" disabled>
                      Licensed ({plugin.currentPlan})
                    </Button>
                  ) : (
                    <Button
                      className="flex-1"
                      onClick={() => handlePurchase(plugin, currentPlan)}
                    >
                      Purchase ${planDetails?.price}/month
                    </Button>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <a href={plugin.documentation} target="_blank" rel="noopener noreferrer">
                      Docs
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredPlugins.length === 0 && (
        <div className="text-center py-12">
          <ShoppingCartIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No plugins found in this category</p>
          <p className="text-sm text-gray-500 mt-2">
            Try selecting a different category or check back later for new plugins
          </p>
        </div>
      )}
    </div>
  )
}
