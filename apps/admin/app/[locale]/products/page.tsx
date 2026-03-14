/**
 * Products Page for Tenant Application
 *
 * Displays product list with search, filter, batch operations and pagination.
 * Supports i18n through the translation function.
 * Uses in-page navigation instead of sidebar submenu (Shopify style).
 */

'use client'

import { usePathname } from 'next/navigation'
import { AlertTriangle, Box, CheckCircle, Eye, Filter, Pencil, Plus, Search, Trash2, TrendingUp, Settings } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { useProducts, useDeleteProduct, useProductStats, useAdminDashboard, type Product as ApiProduct } from '@/lib/hooks/use-api'
import { PageNav } from '@/components/layout/page-nav'
import { formatCurrency, cn } from '@/lib/utils'
import { StatsCard } from '@/components/dashboard/stats-card'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useT, useLocale } from 'shared/src/i18n/react'

export default function ProductsPage() {
  const t = useT()
  const locale = useLocale()
  const pathname = usePathname()
  const { data: dashboardData } = useAdminDashboard()
  const currency = dashboardData?.metrics?.currency

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  // Page navigation items for Products module
  const navItems = [
    { label: getText('merchant.products.allProducts', 'All Products'), href: '/products', exact: true },
  ]
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // API hooks
  const {
    data: productsData,
    isLoading,
    error,
    refetch
  } = useProducts({
    page: currentPage,
    limit: pageSize,
    search: searchTerm
  })
  const { data: productStats } = useProductStats()

  // useDeleteProduct hook
  const deleteProductMutation = useDeleteProduct()

  const products = productsData?.data || []
  const pagination = productsData?.pagination

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm(getText('merchant.products.deleteConfirm', 'Are you sure you want to delete this product?'))) {
      try {
        await deleteProductMutation.mutateAsync(id)
        await refetch()
      } catch (error) {
        console.error('Failed to delete product:', error)
      }
    }
  }

  const filteredProducts = products.filter((product: ApiProduct) => {
    const categoryName = product.categoryName || 'Uncategorized'
    const matchesCategory = selectedCategory === 'All' || categoryName === selectedCategory
    return matchesCategory
  })

  const getStatusStyle = (stock: number) => {
    if (stock === 0) {
      return { text: getText('merchant.products.outOfStock', 'Out of Stock'), class: 'text-red-600 bg-red-50 border-red-100' }
    } else if (stock < 10) {
      return { text: getText('merchant.products.lowStock', 'Low Stock'), class: 'text-yellow-600 bg-yellow-50 border-yellow-100' }
    } else {
      return { text: getText('merchant.products.inStock', 'In Stock'), class: 'text-green-600 bg-green-50 border-green-100' }
    }
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.products.loading', 'Syncing Assets...')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center bg-red-50 p-10 rounded-[3rem] border border-red-100 max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-red-900 mb-2">{getText('merchant.products.loadFailed', 'System Communication Failure')}</h3>
          <p className="text-sm text-red-600/70 mb-8 leading-relaxed">We encountered an issue while retrieving the asset inventory from the master synchronization node.</p>
          <Button
            variant="outline"
            className="rounded-2xl border-red-200 text-red-600 hover:bg-red-100"
            onClick={() => refetch()}
          >
            {getText('merchant.products.retry', 'Retry Sync')}
          </Button>
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
            {getText('merchant.products.title', 'Products')}
          </h1>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">
            {getText('merchant.products.subtitle', 'Inventory Management')}
          </span>
        </div>

        <div className="flex gap-3">
          <Link href={`/${locale}/products/create`}>
            <Button className="h-10 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold text-sm shadow-lg shadow-blue-500/20 transition-all">
              <Plus className="w-4 h-4 mr-2" />
              {getText('merchant.products.addProduct', 'Add Product')}
            </Button>
          </Link>
        </div>
      </div>

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title={getText('merchant.products.totalProducts', 'Total Products')}
            value={(productStats?.metrics.totalProducts ?? 0).toLocaleString()}
            change={toTrendDisplay(productStats?.metrics.totalProductsTrend).change}
            changeType={toTrendDisplay(productStats?.metrics.totalProductsTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="blue"
            icon={<Box className="w-5 h-5" />}
          />
          <StatsCard
            title={getText('merchant.products.activeProducts', 'Active Products')}
            value={(productStats?.metrics.activeProducts ?? 0).toLocaleString()}
            change={toTrendDisplay(productStats?.metrics.activeProductsTrend).change}
            changeType={toTrendDisplay(productStats?.metrics.activeProductsTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="green"
            icon={<CheckCircle className="w-5 h-5" />}
          />
          <StatsCard
            title={getText('merchant.products.lowStock', 'Low Stock')}
            value={(productStats?.metrics.lowStockProducts ?? 0).toLocaleString()}
            change={toTrendDisplay(productStats?.metrics.lowStockProductsTrend).change}
            changeType={toTrendDisplay(productStats?.metrics.lowStockProductsTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="orange"
            icon={<AlertTriangle className="w-5 h-5" />}
          />
          <StatsCard
            title={getText('merchant.products.outOfStock', 'Out of Stock')}
            value={(productStats?.metrics.outOfStockProducts ?? 0).toLocaleString()}
            change={toTrendDisplay(productStats?.metrics.outOfStockProductsTrend).change}
            changeType={toTrendDisplay(productStats?.metrics.outOfStockProductsTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="red"
            icon={<AlertTriangle className="w-5 h-5" />}
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
                  placeholder={getText('merchant.products.searchPlaceholder', 'Quick Search through assets...')}
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
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-12 w-[220px] bg-gray-50 border-gray-50 rounded-2xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 flex items-center px-6 text-sm font-bold text-gray-700">
                  <SelectValue placeholder="Category Mapping" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-gray-100 shadow-2xl p-2">
                  <SelectItem value="All" className="rounded-xl py-2.5 font-semibold">{getText('merchant.products.allCategories', 'All Categories')}</SelectItem>
                  <SelectItem value="Electronics" className="rounded-xl py-2.5 font-semibold">Electronics</SelectItem>
                  <SelectItem value="Fashion" className="rounded-xl py-2.5 font-semibold">Fashion</SelectItem>
                  <SelectItem value="Home" className="rounded-xl py-2.5 font-semibold">Home</SelectItem>
                  <SelectItem value="Sports" className="rounded-xl py-2.5 font-semibold">Sports</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/30">
                  <th className="py-5 px-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.products.product', 'Product Identity')}</th>
                  <th className="py-5 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.products.sku', 'SKU Segment')}</th>
                  <th className="py-5 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.products.price', 'Valuation')}</th>
                  <th className="py-5 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.products.stock', 'Node Inventory')}</th>
                  <th className="py-5 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.products.status', 'Health Status')}</th>
                  <th className="py-5 px-8 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.products.actions', 'Matrix Control')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredProducts.map((product: ApiProduct) => {
                  const status = getStatusStyle(product.stock || 0)
                  return (
                    <tr key={product.id} className="group hover:bg-blue-50/30 transition-colors">
                      <td className="py-5 px-8">
                        <div className="flex items-center gap-4">
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-gray-100 flex-shrink-0 shadow-sm transition-transform group-hover:scale-105">
                            <Image
                              src={product.images?.[0] || 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=100&h=100&fit=crop'}
                              alt={product.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <Link href={`/${locale}/products/${product.id}/edit`}>
                              <span className="font-bold text-gray-900 hover:text-blue-600 transition-colors truncate block">
                                {product.name}
                              </span>
                            </Link>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter truncate opacity-70">
                              {product.categoryName || 'General Mapping'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="text-xs font-mono font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded inline-block">
                          {product.skuCode || 'NO-REF'}
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="text-sm font-bold text-gray-900">
                          {currency ? formatCurrency(product.price || 0, currency) : '--'}
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{product.stock ?? 0}</span>
                          <span className="text-[10px] font-medium text-gray-400">units</span>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className={cn("inline-flex px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border", status.class)}>
                          {status.text}
                        </div>
                      </td>
                      <td className="py-5 px-8 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/${locale}/products/${product.id}/edit`}>
                            <Button variant="ghost" size="icon" className="w-9 h-9 rounded-xl hover:bg-white hover:shadow-md transition-all text-gray-400 hover:text-blue-600">
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteProduct(product.id)}
                            disabled={deleteProductMutation.isPending}
                            className="w-9 h-9 rounded-xl hover:bg-white hover:shadow-md transition-all text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination bar */}
        {pagination && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-12">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] bg-gray-100/50 px-4 py-2 rounded-full border border-gray-100">
              Sync: {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} TOTAL_ASSETS
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-10 rounded-xl border-gray-100 font-bold text-xs hover:bg-gray-50 disabled:opacity-30"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous Scale
              </Button>

              <div className="flex gap-1.5 px-2">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(pagination.totalPages - 4, currentPage - 2)) + i
                  if (pageNum <= pagination.totalPages) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 rounded-xl text-xs font-bold transition-all ${pageNum === currentPage ? 'bg-gray-900 text-white shadow-xl scale-110' : 'bg-white text-gray-400 border border-gray-50 hover:border-gray-200'}`}
                      >
                        {pageNum}
                      </button>
                    )
                  }
                  return null
                })}
              </div>

              <Button
                variant="outline"
                className="h-10 rounded-xl border-gray-100 font-bold text-xs hover:bg-gray-50 disabled:opacity-30"
                onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
                disabled={currentPage === pagination.totalPages}
              >
                Next Segment
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
