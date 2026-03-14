/**
 * Analytics Dashboard Component for Promotions
 *
 * Displays promotion analytics including total uses, revenue impact, and top performing codes.
 * Supports i18n through the translation function.
 */

'use client'

import { TrendingUp, Tag, DollarSign, Users } from 'lucide-react'
import { StatsCard } from '@/components/dashboard/stats-card'
import { formatCurrency } from '@/lib/utils'
import { useT } from 'shared/src/i18n/react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface PromotionAnalyticsData {
  totalUses: number
  revenueImpact: number
  currency: string
  averageDiscount: number
  topPerformingCodes: {
    code: string
    uses: number
    revenue: number
    discountType: string
  }[]
}

interface AnalyticsDashboardProps {
  data?: PromotionAnalyticsData
  isLoading?: boolean
}

export function AnalyticsDashboard({ data, isLoading = false }: AnalyticsDashboardProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Use placeholder data if no data provided
  const analytics: PromotionAnalyticsData = data || {
    totalUses: 0,
    revenueImpact: 0,
    currency: 'USD',
    averageDiscount: 0,
    topPerformingCodes: []
  }

  const getDiscountTypeColor = (type: string) => {
    switch (type) {
      case 'PERCENTAGE': return 'bg-blue-100 text-blue-800'
      case 'FIXED_AMOUNT': return 'bg-green-100 text-green-800'
      case 'BUY_X_GET_Y': return 'bg-purple-100 text-purple-800'
      case 'FREE_SHIPPING': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
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

  return (
    <div className="space-y-6">
      {/* Analytics Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title={getText('merchant.promotions.analytics.totalUses', 'Total Uses')}
          value={analytics.totalUses.toLocaleString()}
          change="0%"
          changeType="increase"
          color="blue"
          icon={<Users className="w-5 h-5" />}
        />
        <StatsCard
          title={getText('merchant.promotions.analytics.revenueImpact', 'Revenue Impact')}
          value={formatCurrency(analytics.revenueImpact, analytics.currency)}
          change="0%"
          changeType="increase"
          color="green"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatsCard
          title={getText('merchant.promotions.analytics.averageDiscount', 'Average Discount')}
          value={formatCurrency(analytics.averageDiscount, analytics.currency)}
          change="0%"
          changeType="increase"
          color="purple"
          icon={<Tag className="w-5 h-5" />}
        />
      </div>

      {/* Top Performing Codes */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-[#3B82F6]" />
            <h3 className="text-lg font-semibold leading-none tracking-tight">
              {getText('merchant.promotions.analytics.topPerforming', 'Top Performing Codes')}
            </h3>
          </div>
        </div>
        <div className="p-6 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{getText('merchant.promotions.code', 'Code')}</TableHead>
                <TableHead>{getText('merchant.promotions.type', 'Type')}</TableHead>
                <TableHead>{getText('merchant.promotions.uses', 'Uses')}</TableHead>
                <TableHead>{getText('merchant.promotions.revenue', 'Revenue')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.topPerformingCodes.map((code) => (
                <TableRow key={code.code}>
                  <TableCell className="font-medium">{code.code}</TableCell>
                  <TableCell>
                    <Badge className={getDiscountTypeColor(code.discountType)} variant="secondary">
                      {getDiscountTypeLabel(code.discountType)}
                    </Badge>
                  </TableCell>
                  <TableCell>{code.uses.toLocaleString()}</TableCell>
                  <TableCell>
                    {formatCurrency(code.revenue, analytics.currency)}
                  </TableCell>
                </TableRow>
              ))}
              {analytics.topPerformingCodes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {getText('merchant.promotions.analytics.noData', 'No promotion data available yet')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
