/**
 * Plugin Marketplace Page
 *
 * Browse and discover plugins available for installation with
 * filtering, sorting, and search capabilities.
 * Uses in-page navigation (Shopify style).
 */
'use client'

import { AlertTriangle, Filter, Search } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PluginCard } from '@/components/plugins/PluginCard'
import { PageNav } from '@/components/layout/page-nav'
import { useMarketplacePlugins, usePluginCategories, useInstalledPlugins } from '@/lib/hooks/use-api'
import { useT } from 'shared/src/i18n'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function PluginMarketplacePage() {
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    // If translation returns the key itself, use fallback
    return translated === key ? fallback : translated
  }

  // Page navigation items for Plugins module
  const navItems = [
    { label: getText('tenant.plugins.overview', 'Overview'), href: '/plugins', exact: true },
    { label: getText('tenant.plugins.marketplace', 'Marketplace'), href: '/plugins/marketplace' },
    { label: getText('tenant.plugins.installed', 'Installed'), href: '/plugins/installed' },
  ]
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedBusinessModel, setSelectedBusinessModel] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'installCount' | 'createdAt'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const { data: marketplaceData, isLoading, error } = useMarketplacePlugins({
    category: selectedCategory !== 'all' ? selectedCategory : undefined,
    businessModel: selectedBusinessModel !== 'all' ? selectedBusinessModel as any : undefined,
    sortBy,
    sortOrder,
  })

  const { data: categoriesData } = usePluginCategories()
  const { data: installedData } = useInstalledPlugins()

  const plugins = marketplaceData?.plugins || []
  const categories = categoriesData?.categories || []
  const installedPluginSlugs = new Set(
    (installedData?.plugins || []).map((p: any) => p.plugin.slug)
  )

  const filteredPlugins = plugins.filter((plugin: any) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        plugin.name.toLowerCase().includes(search) ||
        plugin.description.toLowerCase().includes(search) ||
        plugin.category.toLowerCase().includes(search)
      )
    }
    return true
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">{getText('tenant.plugins.marketplacePage.loading', 'Loading marketplace...')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{getText('tenant.plugins.marketplacePage.loadFailed', 'Failed to load marketplace')}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            {getText('tenant.plugins.marketplacePage.retry', 'Retry')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">{getText('tenant.plugins.marketplacePage.title', 'Plugin Marketplace')}</h1>
          <p className="text-gray-600 mt-1">
            {getText('tenant.plugins.marketplacePage.subtitle', "Discover and install plugins to extend your store's functionality")}
          </p>
        </div>
        {/* In-page Navigation */}
        <PageNav items={navItems} />
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder={getText('tenant.plugins.marketplacePage.searchPlaceholder', 'Search plugins...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filter Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Category Filter */}
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder={getText('tenant.plugins.marketplacePage.allCategories', 'All Categories')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{getText('tenant.plugins.marketplacePage.allCategories', 'All Categories')}</SelectItem>
              {categories.map((cat: any) => (
                <SelectItem key={cat.name} value={cat.name}>
                  {cat.name} ({cat.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Business Model Filter */}
          <Select value={selectedBusinessModel} onValueChange={setSelectedBusinessModel}>
            <SelectTrigger>
              <SelectValue placeholder={getText('tenant.plugins.marketplacePage.allModels', 'All Models')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{getText('tenant.plugins.marketplacePage.allModels', 'All Models')}</SelectItem>
              <SelectItem value="free">{getText('tenant.plugins.marketplacePage.free', 'Free')}</SelectItem>
              <SelectItem value="freemium">{getText('tenant.plugins.marketplacePage.freemium', 'Freemium')}</SelectItem>
              <SelectItem value="subscription">{getText('tenant.plugins.marketplacePage.subscription', 'Subscription')}</SelectItem>
              <SelectItem value="usage_based">{getText('tenant.plugins.marketplacePage.usageBased', 'Usage Based')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort By */}
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger>
              <SelectValue placeholder={getText('tenant.plugins.marketplacePage.sortBy', 'Sort By')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">{getText('tenant.plugins.marketplacePage.sortName', 'Name')}</SelectItem>
              <SelectItem value="rating">{getText('tenant.plugins.marketplacePage.sortRating', 'Rating')}</SelectItem>
              <SelectItem value="installCount">{getText('tenant.plugins.marketplacePage.sortInstallCount', 'Install Count')}</SelectItem>
              <SelectItem value="createdAt">{getText('tenant.plugins.marketplacePage.sortDateAdded', 'Date Added')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort Order */}
          <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
            <SelectTrigger>
              <SelectValue placeholder={getText('tenant.plugins.marketplacePage.order', 'Order')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">{getText('tenant.plugins.marketplacePage.ascending', 'Ascending')}</SelectItem>
              <SelectItem value="desc">{getText('tenant.plugins.marketplacePage.descending', 'Descending')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600">{getText('tenant.plugins.marketplacePage.activeFilters', 'Active filters')}:</span>
          {selectedCategory !== 'all' && (
            <Badge variant="outline" className="cursor-pointer" onClick={() => setSelectedCategory('all')}>
              {selectedCategory} ×
            </Badge>
          )}
          {selectedBusinessModel !== 'all' && (
            <Badge variant="outline" className="cursor-pointer" onClick={() => setSelectedBusinessModel('all')}>
              {selectedBusinessModel} ×
            </Badge>
          )}
          {(selectedCategory !== 'all' || selectedBusinessModel !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedCategory('all')
                setSelectedBusinessModel('all')
              }}
            >
              {getText('tenant.plugins.marketplacePage.clearAll', 'Clear all')}
            </Button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-gray-600">
          {getText('tenant.plugins.marketplacePage.showing', 'Showing')} <span className="font-semibold">{filteredPlugins.length}</span> {getText('tenant.plugins.marketplacePage.plugins', 'plugins')}
        </p>
      </div>

      {/* Plugin Grid */}
      {filteredPlugins.length === 0 ? (
        <div className="text-center py-12">
          <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">{getText('tenant.plugins.marketplacePage.noPlugins', 'No plugins found matching your criteria')}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setSearchTerm('')
              setSelectedCategory('all')
              setSelectedBusinessModel('all')
            }}
          >
            {getText('tenant.plugins.marketplacePage.clearFilters', 'Clear Filters')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlugins.map((plugin: any) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              isInstalled={installedPluginSlugs.has(plugin.slug)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

