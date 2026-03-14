/**
 * Warehouses Page for Admin Application
 *
 * Displays warehouse management interface with stats, warehouse list,
 * and CRUD operations. Supports i18n through the translation function.
 * Uses in-page navigation (Shopify style).
 */

'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Building2, Package, RefreshCw, TrendingUp, Warehouse as WarehouseIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageNav } from '@/components/layout/page-nav'
import { WarehouseManager } from '@/components/inventory/WarehouseManager'
import { warehouseApi } from '@/lib/api/inventory'
import type { Warehouse, WarehouseStats } from 'shared'
import { useT, useLocale } from 'shared/src/i18n/react'

export default function WarehousesPage() {
  const t = useT()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Page navigation items for Inventory module
  const navItems = [
    { label: getText('merchant.inventory.overview', 'Overview'), href: '/inventory', exact: true },
    { label: getText('merchant.inventory.warehouses', 'Warehouses'), href: '/inventory/warehouses', exact: true },
    { label: getText('merchant.inventory.transfers', 'Transfers'), href: '/inventory/transfers', exact: true },
    { label: getText('merchant.inventory.alerts', 'Alerts'), href: '/inventory/alerts', exact: true },
  ]

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [stats, setStats] = useState<WarehouseStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      await Promise.all([loadWarehouses(), loadStats()])
    } catch (err) {
      console.error('Failed to load data:', err)
      setError(getText('merchant.warehouses.loadFailed', 'Failed to load warehouse data'))
    } finally {
      setLoading(false)
    }
  }

  const loadWarehouses = async () => {
    try {
      const response = await warehouseApi.getAll({ limit: 100, sortBy: 'name', sortOrder: 'asc' })
      if (response.success && response.data) {
        const warehouseList = response.data.items || []
        setWarehouses(warehouseList)
      }
    } catch (error) {
      console.error('Failed to load warehouses:', error)
      throw error
    }
  }

  const loadStats = async () => {
    try {
      const response = await warehouseApi.getStats()
      if (response.success && response.data) {
        setStats(response.data)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  if (loading && warehouses.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">
              {getText('merchant.warehouses.loading', 'Loading warehouses...')}
            </p>
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
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">{error}</p>
            <Button variant="outline" onClick={loadData}>
              {getText('merchant.warehouses.retry', 'Retry')}
            </Button>
          </div>
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
            <h1 className="text-2xl font-bold text-gray-900">
              {getText('merchant.warehouses.title', 'Warehouse Management')}
            </h1>
            <p className="text-gray-600 mt-1">
              {getText('merchant.warehouses.subtitle', 'Manage warehouse locations and inventory distribution')}
            </p>
          </div>
          <Button onClick={loadData} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {getText('merchant.warehouses.refresh', 'Refresh')}
          </Button>
        </div>
        {/* In-page Navigation */}
        <PageNav items={navItems} />
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {getText('merchant.warehouses.totalWarehouses', 'Total Warehouses')}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalWarehouses}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.activeWarehouses} {getText('merchant.warehouses.active', 'active')}
                  </p>
                </div>
                <Building2 className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {getText('merchant.warehouses.totalInventory', 'Total Inventory Items')}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalInventory}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {getText('merchant.warehouses.acrossWarehouses', 'across all warehouses')}
                  </p>
                </div>
                <Package className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {getText('merchant.warehouses.totalQuantity', 'Total Stock Units')}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {stats.totalQuantity.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {getText('merchant.warehouses.inStock', 'in stock')}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {getText('merchant.warehouses.lowStock', 'Low Stock Items')}
                  </p>
                  <p className="text-2xl font-bold text-yellow-600 mt-2">{stats.lowStockItems}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.outOfStockItems} {getText('merchant.warehouses.outOfStock', 'out of stock')}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Warehouse Manager Component */}
      <WarehouseManager warehouses={warehouses} onRefresh={loadData} />
    </div>
  )
}
