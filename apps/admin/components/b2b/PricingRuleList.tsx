/**
 * Pricing Rule List Component
 *
 * Reusable table component for displaying pricing rules
 * Used in the main pricing rules page
 */

'use client'

import { useT } from 'shared/src/i18n/react'
import { type PriceRule } from '@/lib/hooks/use-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, Trash2 } from 'lucide-react'

interface PricingRuleListProps {
  priceRules: PriceRule[]
  onEdit: (priceRule: PriceRule) => void
  onDelete: (priceRule: PriceRule) => void
}

export function PricingRuleList({ priceRules, onEdit, onDelete }: PricingRuleListProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

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

  if (priceRules.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">
          {getText('merchant.b2b.pricing.noRules', 'No pricing rules found.')}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left py-3 px-6 font-medium text-gray-900">
              {getText('merchant.b2b.pricing.ruleName', 'Rule Name')}
            </th>
            <th className="text-left py-3 px-6 font-medium text-gray-900">
              {getText('merchant.b2b.pricing.discountType', 'Discount Type')}
            </th>
            <th className="text-left py-3 px-6 font-medium text-gray-900">
              {getText('merchant.b2b.pricing.discountValue', 'Discount Value')}
            </th>
            <th className="text-left py-3 px-6 font-medium text-gray-900">
              {getText('merchant.b2b.pricing.quantity', 'Quantity')}
            </th>
            <th className="text-left py-3 px-6 font-medium text-gray-900">
              {getText('merchant.b2b.pricing.priority', 'Priority')}
            </th>
            <th className="text-left py-3 px-6 font-medium text-gray-900">
              {getText('merchant.b2b.pricing.status', 'Status')}
            </th>
            <th className="text-left py-3 px-6 font-medium text-gray-900">
              {getText('merchant.b2b.pricing.actions', 'Actions')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {priceRules.map((rule) => (
            <tr key={rule.id} className="hover:bg-gray-50">
              <td className="py-4 px-6">
                <div>
                  <div className="font-medium text-gray-900">{rule.name}</div>
                  {rule.description && (
                    <div className="text-sm text-gray-500 truncate max-w-xs">{rule.description}</div>
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
                {rule.minQuantity}
                {rule.maxQuantity ? ` - ${rule.maxQuantity}` : '+'}
              </td>
              <td className="py-4 px-6 text-gray-600">
                {rule.priority}
              </td>
              <td className="py-4 px-6">
                <Badge className={rule.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                  {rule.isActive
                    ? getText('merchant.b2b.pricing.statusActive', 'Active')
                    : getText('merchant.b2b.pricing.statusInactive', 'Inactive')}
                </Badge>
              </td>
              <td className="py-4 px-6">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(rule)}
                    title={getText('merchant.b2b.pricing.edit', 'Edit')}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(rule)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    title={getText('merchant.b2b.pricing.delete', 'Delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
