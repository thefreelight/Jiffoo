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
import { useProducts, useDeleteProduct, useAdjustStock, useProductBatchOperations, type Product as ApiProduct } from '@/lib/hooks/use-api'
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
import { useT, useLocale } from 'shared/src/i18n'

export default function ProductsPage() {
  const t = useT()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Page navigation items for Products module
  const navItems = [
    { label: getText('tenant.products.allProducts', 'All Products'), href: '/products', exact: true },
    { label: getText('tenant.products.addProduct', 'Add Product'), href: '/products/create' },
    { label: getText('tenant.products.inventory', 'Inventory'), href: '/products/inventory' },
  ]
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  const [adjustingProduct, setAdjustingProduct] = useState<ApiProduct | null>(null)
  const [operation, setOperation] = useState<'increase' | 'decrease'>('increase')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [showBatchDialog, setShowBatchDialog] = useState(false)
  const [batchAction, setBatchAction] = useState<'delete' | 'increaseStock' | 'decreaseStock'>('delete')
  const [batchStockQuantity, setBatchStockQuantity] = useState('')

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

  const deleteProductMutation = useDeleteProduct()
  const adjustStockMutation = useAdjustStock()
  const batchOperationsMutation = useProductBatchOperations()

  const products = Array.isArray(productsData?.data) ? productsData.data : (productsData?.data?.data || [])
  const pagination = productsData?.pagination

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProductMutation.mutateAsync(id)
        // 强制重新获取数据
        await refetch()
      } catch (error) {
        console.error('Failed to delete product:', error)
      }
    }
  }

  const handleAdjustStock = async () => {
    if (!adjustingProduct || !quantity || !reason) return

    try {
      await adjustStockMutation.mutateAsync({
        id: adjustingProduct.id,
        data: {
          operation,
          quantity: parseInt(quantity),
          reason
        }
      })

      setAdjustingProduct(null)
      setQuantity('')
      setReason('')
      refetch()
    } catch (error) {
      console.error('Failed to adjust stock:', error)
    }
  }

  const handleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([])
    } else {
      setSelectedProducts(products.map(p => p.id))
    }
  }

  const handleSelectProduct = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  const handleBatchOperation = async () => {
    if (selectedProducts.length === 0) return

    try {
      const data: {
        operation: 'increaseStock' | 'decreaseStock' | 'delete'
        productIds: string[]
        stockQuantity?: number
      } = {
        operation: batchAction,
        productIds: selectedProducts
      }

      if (batchAction === 'increaseStock' || batchAction === 'decreaseStock') {
        if (!batchStockQuantity) {
          alert('Please enter stock quantity')
          return
        }
        data.stockQuantity = parseInt(batchStockQuantity)
      }

      await batchOperationsMutation.mutateAsync(data)

      setShowBatchDialog(false)
      setSelectedProducts([])
      setBatchStockQuantity('')
      refetch()
    } catch (error) {
      console.error('Failed to perform batch operation:', error)
    }
  }

  const filteredProducts = products.filter((product) => {
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
      return getText('tenant.products.outOfStock', 'Out of Stock')
    } else if (stock < 10) {
      return getText('tenant.products.lowStock', 'Low Stock')
    } else {
      return getText('tenant.products.inStock', 'In Stock')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">{getText('tenant.products.loading', 'Loading products...')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{getText('tenant.products.loadFailed', 'Failed to load products')}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => refetch()}
          >
            {getText('tenant.products.retry', 'Retry')}
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
            <h1 className="text-2xl font-bold text-gray-900">{getText('tenant.products.title', 'Products')}</h1>
            <p className="text-gray-600 mt-1">{getText('tenant.products.subtitle', 'Manage your product inventory')}</p>
          </div>
          <Link href={`/${locale}/products/create`}>
            <Button className="bg-gray-900 hover:bg-gray-800">
              <Plus className="w-4 h-4 mr-2" />
              {getText('tenant.products.addProduct', 'Add Product')}
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
                placeholder={getText('tenant.products.searchPlaceholder', 'Search products...')}
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
              <option value="All">{getText('tenant.products.allCategories', 'All Categories')}</option>
              <option value="Electronics">Electronics</option>
              <option value="Fashion">Fashion</option>
              <option value="Home">Home</option>
              <option value="Sports">Sports</option>
            </select>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              {getText('tenant.products.filters', 'Filters')}
            </Button>
          </div>
        </div>
      </div>

      {/* Batch Operations */}
      {selectedProducts.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedProducts.length} {getText('tenant.products.productsSelected', 'product(s) selected')}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBatchAction('increaseStock')
                  setShowBatchDialog(true)
                }}
              >
                {getText('tenant.products.increaseStock', 'Increase Stock')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBatchAction('decreaseStock')
                  setShowBatchDialog(true)
                }}
              >
                {getText('tenant.products.decreaseStock', 'Decrease Stock')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBatchAction('delete')
                  setShowBatchDialog(true)
                }}
                className="text-red-600 hover:text-red-700"
              >
                {getText('tenant.products.deleteSelected', 'Delete Selected')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-900">
                  <input
                    type="checkbox"
                    checked={selectedProducts.length === products.length && products.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.products.product', 'Product')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.products.sku', 'SKU')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.products.category', 'Category')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.products.price', 'Price')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.products.stock', 'Stock')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.products.sales', 'Sales')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.products.status', 'Status')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('tenant.products.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(product.id)}
                      onChange={() => handleSelectProduct(product.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </td>
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
                  <td className="py-4 px-6 text-gray-600">{product.sku || getText('tenant.products.na', 'N/A')}</td>
                  <td className="py-4 px-6 text-gray-600">{typeof product.category === 'string' ? product.category : product.category?.name || getText('tenant.products.uncategorized', 'Uncategorized')}</td>
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
                        <button className="p-1 text-gray-400 hover:text-blue-600" title={getText('tenant.products.view', 'View')}>
                          <Eye className="w-4 h-4" />
                        </button>
                      </Link>
                      <Link href={`/${locale}/products/${product.id}/edit`}>
                        <button className="p-1 text-gray-400 hover:text-blue-600" title={getText('tenant.products.editAction', 'Edit')}>
                          <Pencil className="w-4 h-4" />
                        </button>
                      </Link>
                      <button
                        className="p-1 text-gray-400 hover:text-green-600"
                        onClick={() => {
                          setAdjustingProduct(product as unknown as ApiProduct)
                          setOperation('increase')
                          setQuantity('')
                          setReason('')
                        }}
                        title={getText('tenant.products.adjustStock', 'Adjust Stock')}
                      >
                        <TrendingUp className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1 text-gray-400 hover:text-red-600"
                        onClick={() => handleDeleteProduct(product.id)}
                        disabled={deleteProductMutation.isPending}
                        title={getText('tenant.products.delete', 'Delete')}
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
            {getText('tenant.products.showingResults', 'Showing {from} to {to} of {total} results')
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
              {getText('tenant.products.previous', 'Previous')}
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
              {getText('tenant.products.next', 'Next')}
            </Button>
          </div>
        </div>
      )}

      {/* Adjust Stock Dialog */}
      <Dialog open={!!adjustingProduct} onOpenChange={(open) => !open && setAdjustingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getText('tenant.products.adjustStock', 'Adjust Stock')}</DialogTitle>
            <DialogDescription>
              {getText('tenant.products.adjustStockFor', 'Adjust stock level for')} {adjustingProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="operation" className="text-right">
                {getText('tenant.products.operation', 'Operation')}
              </Label>
              <Select value={operation} onValueChange={(value) => setOperation(value as 'increase' | 'decrease')}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder={getText('tenant.products.selectOperation', 'Select operation')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="increase">{getText('tenant.products.increaseStock', 'Increase Stock')}</SelectItem>
                  <SelectItem value="decrease">{getText('tenant.products.decreaseStock', 'Decrease Stock')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                {getText('tenant.products.quantity', 'Quantity')}
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="col-span-3"
                placeholder={getText('tenant.products.enterQuantity', 'Enter quantity')}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="reason" className="text-right">
                {getText('tenant.products.reason', 'Reason')}
              </Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="col-span-3"
                placeholder={getText('tenant.products.enterReason', 'Enter reason for adjustment')}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">{getText('tenant.products.currentStock', 'Current Stock')}</Label>
              <div className="col-span-3 font-semibold text-lg">
                {adjustingProduct?.stock || 0}
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setAdjustingProduct(null)}>
              {getText('tenant.products.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleAdjustStock}
              disabled={!quantity || !reason || adjustStockMutation.isPending}
            >
              {adjustStockMutation.isPending ? getText('tenant.products.adjusting', 'Adjusting...') : getText('tenant.products.adjustStock', 'Adjust Stock')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Operations Dialog */}
      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getText('tenant.products.batchOperation', 'Batch Operation')}</DialogTitle>
            <DialogDescription>
              {batchAction === 'delete' && getText('tenant.products.deleteConfirm', 'Are you sure you want to delete this product?')}
              {batchAction === 'increaseStock' && `${getText('tenant.products.increaseStock', 'Increase Stock')} - ${selectedProducts.length} ${getText('tenant.products.productsSelected', 'product(s) selected')}`}
              {batchAction === 'decreaseStock' && `${getText('tenant.products.decreaseStock', 'Decrease Stock')} - ${selectedProducts.length} ${getText('tenant.products.productsSelected', 'product(s) selected')}`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {(batchAction === 'increaseStock' || batchAction === 'decreaseStock') && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="batchStockQuantity" className="text-right">
                  {getText('tenant.products.quantity', 'Quantity')}
                </Label>
                <Input
                  id="batchStockQuantity"
                  type="number"
                  min="1"
                  value={batchStockQuantity}
                  onChange={(e) => setBatchStockQuantity(e.target.value)}
                  className="col-span-3"
                  placeholder={getText('tenant.products.enterStockQuantity', 'Please enter stock quantity')}
                />
              </div>
            )}
            {batchAction === 'delete' && (
              <div className="text-sm text-red-600">
                {getText('tenant.products.deleteWarning', 'Warning: This action cannot be undone. All selected products will be permanently deleted.')}
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowBatchDialog(false)}>
              {getText('tenant.products.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleBatchOperation}
              disabled={batchOperationsMutation.isPending}
              className={batchAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {batchOperationsMutation.isPending ? getText('tenant.products.processing', 'Processing...') : getText('tenant.products.confirm', 'Confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
