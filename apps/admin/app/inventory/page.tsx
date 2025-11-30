'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle, Package, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { inventoryManagementApi } from '@/lib/api'

/**
 * Inventory Management Page
 * 库存管理页面
 * 使用 productManagementApi 获取产品库存数据
 */

interface Product {
  id: string
  name: string
  stock: number
  price: number
  category: string
  tenant?: { companyName: string }
}

interface InventoryStats {
  totalProducts: number
  inStock: number
  lowStock: number
  outOfStock: number
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [stats, setStats] = useState<InventoryStats>({
    totalProducts: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<'all' | 'inStock' | 'lowStock' | 'outOfStock'>('all')

  useEffect(() => {
    loadInventoryData()
  }, [])

  const loadInventoryData = async () => {
    try {
      setLoading(true)
      const response = await inventoryManagementApi.getAllProducts({ limit: 100 })
      if (response.success && response.data) {
        const productList = Array.isArray(response.data) ? response.data : response.data.products || []
        setProducts(productList)

        // Calculate stats
        const inStock = productList.filter((p: Product) => p.stock > 10).length
        const lowStock = productList.filter((p: Product) => p.stock > 0 && p.stock <= 10).length
        const outOfStock = productList.filter((p: Product) => p.stock === 0).length

        setStats({
          totalProducts: productList.length,
          inStock,
          lowStock,
          outOfStock
        })
      }
    } catch (error) {
      console.error('Failed to load inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-800', icon: AlertCircle }
    if (stock <= 10) return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle }
    return { label: 'In Stock', color: 'bg-green-100 text-green-800', icon: CheckCircle }
  }

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase())
    if (!matchesSearch) return false

    switch (filter) {
      case 'inStock': return product.stock > 10
      case 'lowStock': return product.stock > 0 && product.stock <= 10
      case 'outOfStock': return product.stock === 0
      default: return true
    }
  })

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600 mt-2">
            Manage product inventory, stock levels, and track inventory changes
          </p>
        </div>
        <Button onClick={loadInventoryData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setFilter('all')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalProducts}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setFilter('inStock')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Stock</p>
                <p className="text-2xl font-bold text-green-600 mt-2">{stats.inStock}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setFilter('lowStock')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock</p>
                <p className="text-2xl font-bold text-yellow-600 mt-2">{stats.lowStock}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md" onClick={() => setFilter('outOfStock')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600 mt-2">{stats.outOfStock}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {filter !== 'all' && (
          <Button variant="outline" onClick={() => setFilter('all')}>
            Clear Filter
          </Button>
        )}
      </div>


      {/* Inventory List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Product Inventory
            {filter !== 'all' && (
              <Badge variant="secondary" className="ml-2">
                {filter === 'inStock' ? 'In Stock' : filter === 'lowStock' ? 'Low Stock' : 'Out of Stock'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Loading inventory...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No products found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProducts.map((product) => {
                const status = getStockStatus(product.stock)
                const StatusIcon = status.icon
                return (
                  <div key={product.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{product.name}</h3>
                          <Badge className={status.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Category: {product.category || 'N/A'} •
                          Price: ${product.price?.toFixed(2) || '0.00'} •
                          Tenant: {product.tenant?.companyName || 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">{product.stock}</p>
                        <p className="text-sm text-gray-500">units</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
