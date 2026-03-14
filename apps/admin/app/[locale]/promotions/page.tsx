/**
 * Promotions Page for Admin Application
 *
 * Displays promotion list with search, filter, and pagination.
 * Supports i18n through the translation function.
 * Uses in-page navigation instead of sidebar submenu (Shopify style).
 */

'use client'

import { AlertTriangle, Calendar, Filter, Percent, Plus, Search, Tag, Trash2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PageNav } from '@/components/layout/page-nav'
import { AnalyticsDashboard } from '@/components/promotions/AnalyticsDashboard'
import { useT, useLocale } from 'shared/src/i18n/react'

// Placeholder Promotion type (will be replaced with API types)
interface Promotion {
  id: string
  code: string
  type: string
  value: number
  startDate: Date | null
  endDate: Date | null
  isActive: boolean
  usedCount: number
  maxUses: number | null
  minPurchaseAmount: number | null
}

export default function PromotionsPage() {
  const t = useT()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Page navigation items for Promotions module
  const navItems = [
    { label: getText('merchant.promotions.allPromotions', 'All Promotions'), href: '/promotions', exact: true },
    { label: getText('merchant.promotions.addPromotion', 'Add Promotion'), href: '/promotions/create' },
  ]

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // Placeholder: API hooks will be added in later phases
  const isLoading = false
  const error = null
  const promotions: Promotion[] = []

  const getStatusColor = (isActive: boolean, endDate: Date | null) => {
    if (!isActive) {
      return 'bg-gray-100 text-gray-800'
    }
    if (endDate && new Date(endDate) < new Date()) {
      return 'bg-red-100 text-red-800'
    }
    return 'bg-green-100 text-green-800'
  }

  const getStatusText = (isActive: boolean, endDate: Date | null) => {
    if (!isActive) {
      return getText('merchant.promotions.inactive', 'Inactive')
    }
    if (endDate && new Date(endDate) < new Date()) {
      return getText('merchant.promotions.expired', 'Expired')
    }
    return getText('merchant.promotions.active', 'Active')
  }

  const getDiscountTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      'PERCENTAGE': getText('merchant.promotions.percentage', 'Percentage'),
      'FIXED_AMOUNT': getText('merchant.promotions.fixedAmount', 'Fixed Amount'),
      'BUY_X_GET_Y': getText('merchant.promotions.buyXGetY', 'Buy X Get Y'),
      'FREE_SHIPPING': getText('merchant.promotions.freeShipping', 'Free Shipping'),
    }
    return typeMap[type] || type
  }

  const formatDate = (date: Date | null) => {
    if (!date) return getText('merchant.promotions.noEndDate', 'No end date')
    return new Date(date).toLocaleDateString()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">{getText('merchant.promotions.loading', 'Loading promotions...')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{getText('merchant.promotions.loadFailed', 'Failed to load promotions')}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            {getText('merchant.promotions.retry', 'Retry')}
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
            <h1 className="text-2xl font-bold text-gray-900">{getText('merchant.promotions.title', 'Promotions')}</h1>
            <p className="text-gray-600 mt-1">{getText('merchant.promotions.subtitle', 'Manage discounts and special offers')}</p>
          </div>
          <Link href={`/${locale}/promotions/create`}>
            <Button className="bg-gray-900 hover:bg-gray-800">
              <Plus className="w-4 h-4 mr-2" />
              {getText('merchant.promotions.addPromotion', 'Add Promotion')}
            </Button>
          </Link>
        </div>
        {/* In-page Navigation */}
        <PageNav items={navItems} />
      </div>

      {/* Analytics Dashboard */}
      <AnalyticsDashboard isLoading={isLoading} />

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={getText('merchant.promotions.searchPlaceholder', 'Search promotions...')}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="All">{getText('merchant.promotions.allTypes', 'All Types')}</option>
              <option value="PERCENTAGE">{getText('merchant.promotions.percentage', 'Percentage')}</option>
              <option value="FIXED_AMOUNT">{getText('merchant.promotions.fixedAmount', 'Fixed Amount')}</option>
              <option value="BUY_X_GET_Y">{getText('merchant.promotions.buyXGetY', 'Buy X Get Y')}</option>
              <option value="FREE_SHIPPING">{getText('merchant.promotions.freeShipping', 'Free Shipping')}</option>
            </select>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              {getText('merchant.promotions.filters', 'Filters')}
            </Button>
          </div>
        </div>
      </div>

      {/* Promotions Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {promotions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Tag className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {getText('merchant.promotions.noPromotions', 'No promotions yet')}
            </h3>
            <p className="text-gray-500 text-center mb-6 max-w-sm">
              {getText('merchant.promotions.noPromotionsDescription', 'Create your first promotion to offer discounts and special deals to your customers.')}
            </p>
            <Link href={`/${locale}/promotions/create`}>
              <Button className="bg-gray-900 hover:bg-gray-800">
                <Plus className="w-4 h-4 mr-2" />
                {getText('merchant.promotions.createFirstPromotion', 'Create First Promotion')}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.promotions.code', 'Code')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.promotions.type', 'Type')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.promotions.value', 'Value')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.promotions.dateRange', 'Date Range')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.promotions.usage', 'Usage')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.promotions.status', 'Status')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.promotions.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {promotions.map((promotion) => (
                  <tr key={promotion.id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        <Percent className="w-5 h-5 text-gray-400 mr-2" />
                        <div className="font-medium text-gray-900">{promotion.code}</div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-600">{getDiscountTypeLabel(promotion.type)}</td>
                    <td className="py-4 px-6 font-medium text-gray-900">
                      {promotion.type === 'PERCENTAGE' ? `${promotion.value}%` : `$${promotion.value}`}
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      <div className="flex items-center text-sm">
                        <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                        {formatDate(promotion.startDate)} - {formatDate(promotion.endDate)}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      {promotion.usedCount} / {promotion.maxUses || '∞'}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(promotion.isActive, promotion.endDate)}`}>
                        {getStatusText(promotion.isActive, promotion.endDate)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <button className="p-1 text-gray-400 hover:text-red-600" title={getText('merchant.promotions.delete', 'Delete')}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
