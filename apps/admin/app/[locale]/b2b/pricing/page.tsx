/**
 * Pricing Rules Page for B2B Admin
 *
 * Displays pricing rules list with search, filter, and pagination.
 * Supports i18n through the translation function.
 * Uses in-page navigation (Shopify style).
 */

'use client'

import { AlertTriangle, Tag, Search, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { usePriceRules, type PriceRule } from '@/lib/hooks/use-api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageNav } from '@/components/layout/page-nav'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useT, useLocale } from 'shared/src/i18n/react'
import { PricingRuleForm } from '@/components/b2b/PricingRuleForm'
import { useToast } from '@/hooks/use-toast'

export default function PricingRulesPage() {
  const t = useT()
  const locale = useLocale()
  const { toast } = useToast()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Page navigation items for Pricing module
  const navItems = [
    { label: getText('merchant.b2b.pricing.allRules', 'All Pricing Rules'), href: '/b2b/pricing', exact: true },
  ]
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedPriceRule, setSelectedPriceRule] = useState<PriceRule | null>(null)

  // API hooks
  const {
    data: priceRulesResponse,
    isLoading,
    error,
    refetch
  } = usePriceRules({
    page: currentPage,
    limit: pageSize,
    search: searchTerm,
    status: selectedStatus === 'All' ? undefined : selectedStatus,
  })

  // Extract data from API response
  const priceRules = priceRulesResponse?.data || []
  const pagination = priceRulesResponse?.pagination || {
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 0
  }

  // Filter price rules locally for immediate feedback
  const filteredPriceRules = priceRules.filter((rule: PriceRule) => {
    if (!rule) return false

    const matchesSearch = searchTerm === '' ||
      rule.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.description?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = selectedStatus === 'All' ||
      (selectedStatus === 'active' && rule.isActive) ||
      (selectedStatus === 'inactive' && !rule.isActive)

    return matchesSearch && matchesStatus
  })

  const getDiscountTypeLabel = (type: string) => {
    switch (type) {
      case 'PERCENTAGE':
        return getText('merchant.b2b.pricing.discountTypePercentage', 'Percentage')
      case 'FIXED_AMOUNT':
        return getText('merchant.b2b.pricing.discountTypeFixedAmount', 'Fixed Amount')
      case 'FIXED_PRICE':
        return getText('merchant.b2b.pricing.discountTypeFixedPrice', 'Fixed Price')
      default:
        return type
    }
  }

  const getDiscountTypeColor = (type: string) => {
    switch (type) {
      case 'PERCENTAGE':
        return 'bg-blue-100 text-blue-800'
      case 'FIXED_AMOUNT':
        return 'bg-green-100 text-green-800'
      case 'FIXED_PRICE':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDiscountValue = (type: string, value: number) => {
    switch (type) {
      case 'PERCENTAGE':
        return `${value}%`
      case 'FIXED_AMOUNT':
        return `$${value.toFixed(2)}`
      case 'FIXED_PRICE':
        return `$${value.toFixed(2)}`
      default:
        return String(value)
    }
  }

  // Operation success callback
  const handleOperationSuccess = (message: string) => {
    toast({
      title: getText('merchant.b2b.pricing.success', 'Operation Successful'),
      description: message,
    })
    refetch()
  }

  // Open edit dialog
  const handleEdit = (priceRule: PriceRule) => {
    setSelectedPriceRule(priceRule)
    setEditDialogOpen(true)
  }

  // Open delete dialog
  const handleDelete = (priceRule: PriceRule) => {
    setSelectedPriceRule(priceRule)
    setDeleteDialogOpen(true)
  }

  // Calculate stats from price rules data
  const priceRuleStats = {
    total: pagination.total,
    active: priceRules.filter((r: PriceRule) => r.isActive).length,
    inactive: priceRules.filter((r: PriceRule) => !r.isActive).length,
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{getText('merchant.b2b.pricing.loadFailed', 'Failed to load pricing rules')}</h3>
              <p className="text-gray-600 mb-4">
                {getText('merchant.b2b.pricing.loadError', 'Error: {message}').replace('{message}', error instanceof Error ? error.message : getText('merchant.b2b.pricing.unknown', 'Unknown'))}
              </p>
              <Button onClick={() => refetch()}>{getText('merchant.b2b.pricing.tryAgain', 'Try Again')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getText('merchant.b2b.pricing.title', 'Pricing Rules')}</h1>
            <p className="text-gray-600 mt-1">{getText('merchant.b2b.pricing.subtitle', 'Manage tiered pricing and discounts for B2B customers')}</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {getText('merchant.b2b.pricing.addRule', 'Add Pricing Rule')}
          </Button>
        </div>
        {/* In-page Navigation */}
        <PageNav items={navItems} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.b2b.pricing.totalRules', 'Total Rules')}</p>
                <p className="text-2xl font-bold text-gray-900">{priceRuleStats.total.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Tag className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.b2b.pricing.active', 'Active')}</p>
                <p className="text-2xl font-bold text-green-600">{priceRuleStats.active}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Tag className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.b2b.pricing.inactive', 'Inactive')}</p>
                <p className="text-2xl font-bold text-gray-600">{priceRuleStats.inactive}</p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Tag className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={getText('merchant.b2b.pricing.searchPlaceholder', 'Search pricing rules by name...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={getText('merchant.b2b.pricing.allStatus', 'All Status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">{getText('merchant.b2b.pricing.allStatus', 'All Status')}</SelectItem>
                  <SelectItem value="active">{getText('merchant.b2b.pricing.statusActive', 'Active')}</SelectItem>
                  <SelectItem value="inactive">{getText('merchant.b2b.pricing.statusInactive', 'Inactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Rules Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.pricing.ruleName', 'Rule Name')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.pricing.discountType', 'Discount Type')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.pricing.discountValue', 'Discount Value')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.pricing.quantity', 'Quantity')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.pricing.priority', 'Priority')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.pricing.status', 'Status')}</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.pricing.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPriceRules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <div className="text-gray-500">
                        {searchTerm ? getText('merchant.b2b.pricing.noRulesMatching', 'No pricing rules found matching your search.') : getText('merchant.b2b.pricing.noRulesFound', 'No pricing rules found.')}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPriceRules.map((rule: PriceRule) => (
                    <tr key={rule.id} className="hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div>
                          <div className="font-medium text-gray-900">{rule.name}</div>
                          {rule.description && (
                            <div className="text-sm text-gray-500">{rule.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <Badge className={getDiscountTypeColor(rule.discountType)}>
                          {getDiscountTypeLabel(rule.discountType)}
                        </Badge>
                      </td>
                      <td className="py-4 px-6 text-gray-900 font-medium">
                        {formatDiscountValue(rule.discountType, rule.discountValue)}
                      </td>
                      <td className="py-4 px-6 text-gray-600">
                        {rule.minQuantity}{rule.maxQuantity ? ` - ${rule.maxQuantity}` : '+'}
                      </td>
                      <td className="py-4 px-6 text-gray-600">
                        {rule.priority}
                      </td>
                      <td className="py-4 px-6">
                        <Badge className={rule.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {rule.isActive ? getText('merchant.b2b.pricing.statusActive', 'Active') : getText('merchant.b2b.pricing.statusInactive', 'Inactive')}
                        </Badge>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(rule)}
                          >
                            {getText('merchant.b2b.pricing.edit', 'Edit')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(rule)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {getText('merchant.b2b.pricing.delete', 'Delete')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {getText('merchant.b2b.pricing.showingResults', 'Showing {from} to {to} of {total} results')
              .replace('{from}', String((currentPage - 1) * pageSize + 1))
              .replace('{to}', String(Math.min(currentPage * pageSize, pagination.total)))
              .replace('{total}', String(pagination.total))}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              {getText('merchant.b2b.pricing.previous', 'Previous')}
            </Button>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const page = i + 1
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              )
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
              disabled={currentPage === pagination.totalPages}
            >
              {getText('merchant.b2b.pricing.next', 'Next')}
            </Button>
          </div>
        </div>
      )}

      {/* Dialog components */}
      <PricingRuleForm
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => handleOperationSuccess(getText('merchant.b2b.pricing.create.success', 'Pricing rule created successfully'))}
        mode="create"
      />

      <PricingRuleForm
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={() => handleOperationSuccess(getText('merchant.b2b.pricing.edit.success', 'Pricing rule updated successfully'))}
        priceRule={selectedPriceRule}
        mode="edit"
      />

      <PricingRuleForm
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={() => handleOperationSuccess(getText('merchant.b2b.pricing.delete.success', 'Pricing rule deleted successfully'))}
        priceRule={selectedPriceRule}
        mode="delete"
      />
    </div>
  )
}
