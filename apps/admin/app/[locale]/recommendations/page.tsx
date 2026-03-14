/**
 * Recommendations Dashboard Page
 *
 * Displays AI-powered recommendation performance metrics and analytics.
 * Supports i18n through the translation function.
 */

'use client'

import { AlertTriangle, TrendingUp, Users, ShoppingBag, Target, Sparkles } from 'lucide-react'
import { StatsCard } from '@/components/dashboard/stats-card'
import { Button } from '@/components/ui/button'
import { useT } from 'shared/src/i18n/react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default function RecommendationsPage() {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Mock data for recommendations performance
  // TODO: Replace with actual API call when recommendations API is implemented
  const loading = false
  const error = null
  const stats = {
    totalRecommendations: 1247,
    clickThroughRate: 12.5,
    conversionRate: 3.2,
    revenue: 15420.50,
    currency: 'USD',
    topProducts: [
      { id: '1', name: 'Wireless Earbuds Pro', recommendations: 145, clicks: 32, conversions: 8 },
      { id: '2', name: 'Smart Watch Ultra', recommendations: 128, clicks: 28, conversions: 6 },
      { id: '3', name: 'Laptop Stand Premium', recommendations: 98, clicks: 21, conversions: 5 },
      { id: '4', name: 'USB-C Hub 7-in-1', recommendations: 87, clicks: 18, conversions: 4 },
      { id: '5', name: 'Mechanical Keyboard RGB', recommendations: 76, clicks: 15, conversions: 3 },
    ]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">{getText('merchant.recommendations.loading', 'Loading recommendations data...')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{getText('merchant.recommendations.loadFailed', 'Failed to load recommendations data')}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            {getText('merchant.recommendations.retry', 'Retry')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A] flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#3B82F6]" />
            {getText('merchant.recommendations.title', 'AI Recommendations')}
          </h1>
          <p className="text-[#64748B]">{getText('merchant.recommendations.subtitle', 'Track performance of AI-powered product recommendations.')}</p>
        </div>
      </div>

      {/* Performance Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title={getText('merchant.recommendations.totalRecommendations', 'Total Recommendations')}
          value={stats.totalRecommendations.toLocaleString()}
          change="0%"
          changeType="increase"
          color="blue"
          icon={<Target className="w-5 h-5" />}
        />
        <StatsCard
          title={getText('merchant.recommendations.clickThroughRate', 'Click-Through Rate')}
          value={`${stats.clickThroughRate}%`}
          change="0%"
          changeType="increase"
          color="green"
          icon={<Users className="w-5 h-5" />}
        />
        <StatsCard
          title={getText('merchant.recommendations.conversionRate', 'Conversion Rate')}
          value={`${stats.conversionRate}%`}
          change="0%"
          changeType="increase"
          color="purple"
          icon={<ShoppingBag className="w-5 h-5" />}
        />
        <StatsCard
          title={getText('merchant.recommendations.revenue', 'Revenue Generated')}
          value={`$${stats.revenue.toLocaleString()}`}
          change="0%"
          changeType="increase"
          color="orange"
          icon={<TrendingUp className="w-5 h-5" />}
        />
      </div>

      {/* Top Performing Products */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <h3 className="text-lg font-semibold leading-none tracking-tight">
            {getText('merchant.recommendations.topProducts', 'Top Recommended Products')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {getText('merchant.recommendations.topProductsDescription', 'Products with the highest recommendation performance')}
          </p>
        </div>
        <div className="p-6 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{getText('merchant.recommendations.productName', 'Product Name')}</TableHead>
                <TableHead className="text-right">{getText('merchant.recommendations.recommendations', 'Recommendations')}</TableHead>
                <TableHead className="text-right">{getText('merchant.recommendations.clicks', 'Clicks')}</TableHead>
                <TableHead className="text-right">{getText('merchant.recommendations.conversions', 'Conversions')}</TableHead>
                <TableHead className="text-right">{getText('merchant.recommendations.ctr', 'CTR')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.topProducts.map((product) => {
                const ctr = ((product.clicks / product.recommendations) * 100).toFixed(1)
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-right">{product.recommendations.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{product.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {product.conversions}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{ctr}%</TableCell>
                  </TableRow>
                )
              })}
              {stats.topProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {getText('merchant.recommendations.noData', 'No recommendation data available')}
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
