/**
 * Products Page for Tenant Application
 *
 * Displays product list with search, filter, batch operations and pagination.
 * Supports i18n through the translation function.
 * Uses in-page navigation instead of sidebar submenu (Shopify style).
 */

'use client'

import { AlertTriangle, Eye, Filter, Pencil, Plus, Search, Trash2, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { useProducts, useDeleteProduct, type Product as ApiProduct } from '@/lib/hooks/use-api'
import { PageNav } from '@/components/layout/page-nav'

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

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Page navigation items for Products module
  const navItems = [
    { label: getText('merchant.products.allProducts', 'All Products'), href: '/products', exact: true },
    { label: getText('merchant.products.addProduct', 'Add Product'), href: '/products/create' },
  ]
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // Adjusted: Removed stock adjustment state

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

  // Removed: useAdjustStock hook
  const deleteProductMutation = useDeleteProduct()

  const products = productsData?.data || []
  const pagination = productsData?.pagination

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProductMutation.mutateAsync(id)
        // Force refetch data
        await refetch()
      } catch (error) {
        console.error('Failed to delete product:', error)
      }
    }
  }

  // Removed: handleAdjustStock function

  const filteredProducts = products.filter((product: ApiProduct) => {
    const categoryName = typeof product.category === 'string' ? product.category : product.category?.name
    const matchesCategory = selectedCategory === 'All' || categoryName === selectedCategory
    return matchesCategory
  })

  const getStatusColor = (stock: number) => {
    if (stock === 0) {
      return 'bg-red-100 text-red-800'
    } else if (stock < 10) {
      return 'bg-yellow-100 text-yellow-800'
    } else {
      return 'bg-green-100 text-green-800'
    }
  }

  const getStatusText = (stock: number) => {
    if (stock === 0) {
      return getText('merchant.products.outOfStock', 'Out of Stock')
    } else if (stock < 10) {
      return getText('merchant.products.lowStock', 'Low Stock')
    } else {
      return getText('merchant.products.inStock', 'In Stock')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">{getText('merchant.products.loading', 'Loading products...')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{getText('merchant.products.loadFailed', 'Failed to load products')}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => refetch()}
          >
            {getText('merchant.products.retry', 'Retry')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getText('merchant.products.title', 'Products')}</h1>
            <p className="text-gray-600 mt-1">{getText('merchant.products.subtitle', 'Manage your product inventory')}</p>
          </div>
          <Link href={`/${locale}/products/create`}>
            <Button className="bg-gray-900 hover:bg-gray-800">
              <Plus className="w-4 h-4 mr-2" />
              {getText('merchant.products.addProduct', 'Add Product')}
            </Button>
          </Link>
        </div>
        {/* In-page Navigation */}
        <PageNav items={navItems} />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={getText('merchant.products.searchPlaceholder', 'Search products...')}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1) // Reset to first page when searching
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="All">{getText('merchant.products.allCategories', 'All Categories')}</option>
              <option value="Electronics">Electronics</option>
              <option value="Fashion">Fashion</option>
              <option value="Home">Home</option>
              <option value="Sports">Sports</option>
            </select>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              {getText('merchant.products.filters', 'Filters')}
            </Button>
          </div>
        </div>
      </div>



      {/* Products Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.products.product', 'Product')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.products.sku', 'SKU')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.products.category', 'Category')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.products.price', 'Price')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.products.stock', 'Stock')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.products.sales', 'Sales')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.products.status', 'Status')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.products.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((product: ApiProduct) => (
                <tr key={product.id} className="hover:bg-gray-50">

                  <td className="py-4 px-6">
                    <div className="flex items-center">
                      <Image
                        src={'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=100&h=100&fit=crop'}
                        alt={product.name}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-lg object-cover mr-4"
                      />
                      <div>
                        <Link href={`/${locale}/products/${product.id}/edit`}>
                          <div className="font-medium text-gray-900 hover:text-blue-600 cursor-pointer">{product.name}</div>
                        </Link>
                        <div className="text-sm text-gray-500">{product.description?.substring(0, 50)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-gray-600">{product.sku || getText('merchant.products.na', 'N/A')}</td>
                  <td className="py-4 px-6 text-gray-600">{typeof product.category === 'string' ? product.category : product.category?.name || getText('merchant.products.uncategorized', 'Uncategorized')}</td>
                  <td className="py-4 px-6 font-medium text-gray-900">¥{product.price?.toLocaleString() || '0'}</td>
                  <td className="py-4 px-6">
                    <span className={`${product.stock === 0 ? 'text-red-600' : product.stock < 10 ? 'text-yellow-600' : 'text-gray-900'}`}>
                      {product.stock || 0}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-gray-600">{0}</td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(product.stock || 0)}`}>
                      {getStatusText(product.stock || 0)}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      <Link href={`/${locale}/products/${product.id}`}>
                        <button className="p-1 text-gray-400 hover:text-blue-600" title={getText('merchant.products.view', 'View')}>
                          <Eye className="w-4 h-4" />
                        </button>
                      </Link>
                      <Link href={`/${locale}/products/${product.id}/edit`}>
                        <button className="p-1 text-gray-400 hover:text-blue-600" title={getText('merchant.products.editAction', 'Edit')}>
                          <Pencil className="w-4 h-4" />
                        </button>
                      </Link>
                      {/* Adjust Stock Button Removed */}
                      <button
                        className="p-1 text-gray-400 hover:text-red-600"
                        onClick={() => handleDeleteProduct(product.id)}
                        disabled={deleteProductMutation.isPending}
                        title={getText('merchant.products.delete', 'Delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {getText('merchant.products.showingResults', 'Showing {from} to {to} of {total} results')
              .replace('{from}', String((pagination.page - 1) * pagination.limit + 1))
              .replace('{to}', String(Math.min(pagination.page * pagination.limit, pagination.total)))
              .replace('{total}', String(pagination.total))}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              {getText('merchant.products.previous', 'Previous')}
            </Button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const pageNum = Math.max(1, Math.min(pagination.totalPages - 4, currentPage - 2)) + i
              if (pageNum <= pagination.totalPages) {
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                )
              }
              return null
            })}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
              disabled={currentPage === pagination.totalPages}
            >
              {getText('merchant.products.next', 'Next')}
            </Button>
          </div>
        </div>
      )}

      {/* Adjust Stock Dialog Removed */}
    </div>
  )
}
