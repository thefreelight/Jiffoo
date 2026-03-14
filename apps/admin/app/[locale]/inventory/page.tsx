/**
 * Inventory Management Page for Admin Application
 *
 * Displays inventory overview with stats, warehouse filter, and product list
 * with multi-warehouse stock information. Supports i18n through the translation function.
 * Uses in-page navigation (Shopify style).
 */

'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle, Package, RefreshCw, Search, Warehouse as WarehouseIcon, Download, Upload, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useT, useLocale } from 'shared/src/i18n/react'
import {
  useInventoryDashboard,
  useInventoryStats,
  useDismissAlert,
  useResolveAlert,
  useCheckAlerts,
  useGenerateForecast,
  useRecomputeAllForecasts,
  useUpdateAlertStatus,
  useRecordAccuracy
} from '@/lib/hooks/use-api'
import { ReorderAlerts } from '@/components/inventory/reorder-alerts'
import { StatsCard } from '@/components/dashboard/stats-card'

export default function InventoryPage() {
  const t = useT()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const [forecastId, setForecastId] = useState('')
  const [actualDemand, setActualDemand] = useState('')
  const [productIdInput, setProductIdInput] = useState('')
  const [variantIdInput, setVariantIdInput] = useState('')

  // Fetch alerts from API
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useInventoryDashboard({
    page: 1,
    limit: 10,
    status: 'ACTIVE',
    productId: productIdInput.trim() || undefined,
    variantId: variantIdInput.trim() || undefined,
  })
  const { data: inventoryStatsData } = useInventoryStats()

  const alerts = dashboardData?.alerts?.items || []

  // Dismiss alert mutation
  const dismissAlert = useDismissAlert()
  const resolveAlert = useResolveAlert()
  const checkAlerts = useCheckAlerts()
  const generateForecast = useGenerateForecast()
  const recomputeAll = useRecomputeAllForecasts()
  const updateAlertStatus = useUpdateAlertStatus()
  const recordAccuracy = useRecordAccuracy()
  const forecastProductId = productIdInput.trim() || (dashboardData?.context?.productId as string) || ''
  const forecastVariantId = variantIdInput.trim() || ((dashboardData?.context?.variantId as string | null) || '')
  const latestForecast = dashboardData?.latestForecast

  // Extract data
  const loading = dashboardLoading
  const error = dashboardError
  const hasAccuracyContext = !!dashboardData?.context?.productId
  const stats = {
    totalAlerts: inventoryStatsData?.metrics.totalAlerts ?? 0,
    stockoutRisks: inventoryStatsData?.metrics.stockoutRisks ?? 0,
    overstockItems: inventoryStatsData?.metrics.overstockItems ?? 0,
    avgAccuracy: inventoryStatsData?.metrics.avgAccuracy ?? dashboardData?.accuracy?.avgAccuracy ?? 0,
    totalAlertsTrend: inventoryStatsData?.metrics.totalAlertsTrend ?? 0,
    stockoutRisksTrend: inventoryStatsData?.metrics.stockoutRisksTrend ?? 0,
    overstockItemsTrend: inventoryStatsData?.metrics.overstockItemsTrend ?? 0,
    avgAccuracyTrend: inventoryStatsData?.metrics.avgAccuracyTrend ?? 0,
  }
  const accuracyValue = `${stats.avgAccuracy.toFixed(1)}%`
  const alertsMeta = dashboardData?.alerts
  const accuracyMetrics = dashboardData?.accuracy
  const weeklyPatternText = latestForecast?.seasonalFactors?.weeklyPattern?.join(', ') || '-'
  const monthlyPatternText = latestForecast?.seasonalFactors?.monthlyPattern?.join(', ') || '-'
  const dayOfWeekText = latestForecast?.seasonalFactors?.dayOfWeekMultipliers
    ? Object.entries(latestForecast.seasonalFactors.dayOfWeekMultipliers)
      .map(([day, value]) => `${day}:${value}`)
      .join(' | ')
    : '-'
  const holidayImpactText = latestForecast?.seasonalFactors?.holidayImpact
    ? Object.entries(latestForecast.seasonalFactors.holidayImpact)
      .map(([holiday, impact]) => `${holiday}:${impact}`)
      .join(' | ')
    : '-'
  const weeklyPattern = latestForecast?.seasonalFactors?.weeklyPattern || []
  const monthlyPattern = latestForecast?.seasonalFactors?.monthlyPattern || []
  const weeklyMax = Math.max(...weeklyPattern, 1)
  const monthlyMax = Math.max(...monthlyPattern, 1)

  const toTrendDisplay = (value: number | undefined) => {
    const trendValue = value ?? 0
    return {
      change: `${Math.abs(trendValue).toFixed(2)}%`,
      changeType: trendValue >= 0 ? 'increase' as const : 'decrease' as const,
    }
  }

  const formatNumber = (value: number | null | undefined, digits = 2) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '-'
    return Number(value).toFixed(digits)
  }

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleString()
  }

  const handleDismissAlert = async (alertId: string) => {
    await dismissAlert.mutateAsync({ id: alertId })
  }

  const handleUpdateAlertStatus = async (alertId: string, status: 'ACTIVE' | 'DISMISSED' | 'RESOLVED') => {
    await updateAlertStatus.mutateAsync({ id: alertId, status })
  }

  const handleResolveAlert = async (alertId: string) => {
    await resolveAlert.mutateAsync(alertId)
  }

  const handleRecordAccuracy = async () => {
    const trimmedForecastId = forecastId.trim()
    const parsedActualDemand = Number(actualDemand)
    if (!trimmedForecastId) return
    if (!Number.isFinite(parsedActualDemand)) return

    await recordAccuracy.mutateAsync({
      forecastId: trimmedForecastId,
      actualDemand: parsedActualDemand
    })
    setForecastId('')
    setActualDemand('')
  }

  const handleCheckAlerts = async () => {
    if (!forecastProductId || !forecastVariantId) return
    await checkAlerts.mutateAsync({
      productId: forecastProductId,
      variantId: forecastVariantId
    })
  }

  const handleGenerateForecast = async () => {
    if (!forecastProductId || !forecastVariantId) return
    await generateForecast.mutateAsync({
      productId: forecastProductId,
      variantId: forecastVariantId
    })
  }

  const handleRecomputeAll = async () => {
    await recomputeAll.mutateAsync({})
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-400 font-bold text-[10px] uppercase tracking-widest">{getText('merchant.inventory.loading', 'Loading Telemetry Data...')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-gray-900 font-bold">{getText('merchant.inventory.loadFailed', 'Signal Interference Detected')}</p>
          <Button
            variant="outline"
            className="rounded-xl border-gray-200"
            onClick={() => window.location.reload()}
          >
            {getText('merchant.inventory.retry', 'Reconnect Signal')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full bg-[#fcfdfe] min-h-screen">
      {/* Header Bar */}
      <div className="border-b border-gray-100 pl-20 pr-4 sm:pr-8 lg:px-8 py-4 sticky top-0 bg-white/80 backdrop-blur-md z-50 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">
            {getText('merchant.inventory.title', 'Inventory')}
          </h1>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">
            {getText('merchant.inventory.predictiveNode', 'Predictive Analytics Node')}
          </span>
        </div>
      </div>

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title={getText('merchant.inventory.totalAlerts', 'Total Alerts')}
            value={stats.totalAlerts.toLocaleString()}
            change={toTrendDisplay(stats.totalAlertsTrend).change}
            changeType={toTrendDisplay(stats.totalAlertsTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="blue"
            icon={<AlertCircle className="w-5 h-5" />}
          />
          <StatsCard
            title={getText('merchant.inventory.stockoutRisks', 'Stockout Risks')}
            value={stats.stockoutRisks.toLocaleString()}
            change={toTrendDisplay(stats.stockoutRisksTrend).change}
            changeType={toTrendDisplay(stats.stockoutRisksTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="red"
            icon={<AlertTriangle className="w-5 h-5" />}
          />
          <StatsCard
            title={getText('merchant.inventory.overstockItems', 'Overstock Items')}
            value={stats.overstockItems.toLocaleString()}
            change={toTrendDisplay(stats.overstockItemsTrend).change}
            changeType={toTrendDisplay(stats.overstockItemsTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="orange"
            icon={<Package className="w-5 h-5" />}
          />
          <StatsCard
            title={getText('merchant.inventory.avgAccuracy', 'Avg Capacity')}
            value={accuracyValue}
            change={toTrendDisplay(stats.avgAccuracyTrend).change}
            changeType={toTrendDisplay(stats.avgAccuracyTrend).changeType}
            comparisonLabel={getText('merchant.dashboard.vsYesterday', 'vs yesterday')}
            color="green"
            icon={<TrendingUp className="w-5 h-5" />}
          />
        </div>
        {!hasAccuracyContext && (
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">
            {getText('merchant.inventory.accuracyContextHint', 'Capacity analysis requires active signal context.')}
          </p>
        )}

        {/* Reorder Alerts Section */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900">
                {getText('merchant.inventory.reorderAlerts', 'Reorder Alerts')}
              </h3>
              <p className="text-gray-400 text-xs font-medium">
                {getText('merchant.inventory.alertsDescription', 'Active alerts for products requiring attention')}
              </p>
            </div>
            <div className="text-right space-y-1">
              <span className="block text-[10px] font-bold text-blue-600 uppercase tracking-widest">{getText('merchant.inventory.priorityLedger', 'Priority Ledger')}</span>
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {getText('merchant.inventory.pageLabel', 'Page')} {alertsMeta?.page ?? 1}/{alertsMeta?.totalPages ?? 1} · {getText('merchant.inventory.totalLabel', 'Total')} {alertsMeta?.total ?? 0} · {getText('merchant.inventory.limitLabel', 'Limit')} {alertsMeta?.limit ?? 10}
              </span>
            </div>
          </div>
          <div className="p-0">
            <ReorderAlerts
              alerts={alerts}
              onDismiss={handleDismissAlert}
              onResolve={handleResolveAlert}
              onUpdateStatus={handleUpdateAlertStatus}
              isUpdatingStatus={updateAlertStatus.isPending || resolveAlert.isPending}
              loading={loading}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm space-y-6 min-h-[360px] h-full flex flex-col">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900">
                {getText('merchant.inventory.forecastOps', 'Signal Operations')}
              </h3>
              <p className="text-gray-400 text-xs font-medium">
                {getText('merchant.inventory.forecastOpsDescription', 'Manual telemetry override and signal generation.')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">{getText('merchant.inventory.productId', 'Product ID')}</label>
                <Input
                  placeholder="Enter ID..."
                  value={productIdInput}
                  onChange={(e) => setProductIdInput(e.target.value)}
                  className="h-11 rounded-xl bg-gray-50/50 border-gray-100 focus:bg-white transition-all font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">{getText('merchant.inventory.variantId', 'Variant ID')}</label>
                <Input
                  placeholder="Enter ID..."
                  value={variantIdInput}
                  onChange={(e) => setVariantIdInput(e.target.value)}
                  className="h-11 rounded-xl bg-gray-50/50 border-gray-100 focus:bg-white transition-all font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleRecomputeAll}
                  disabled={recomputeAll.isPending}
                  variant="outline"
                  className="flex-1 h-11 rounded-xl border-gray-100 font-bold text-xs uppercase tracking-widest"
                >
                {recomputeAll.isPending ? 'Recomputing...' : getText('merchant.inventory.recomputeAll', 'Recompute All SKUs')}
              </Button>
                <Button
                  onClick={handleCheckAlerts}
                  disabled={checkAlerts.isPending || !forecastProductId || !forecastVariantId}
                  variant="outline"
                  className="flex-1 h-11 rounded-xl border-gray-100 font-bold text-xs uppercase tracking-widest"
                >
                {checkAlerts.isPending ? 'Checking...' : getText('merchant.inventory.checkAlerts', 'Check Signal')}
              </Button>
                <Button
                  onClick={handleGenerateForecast}
                  disabled={generateForecast.isPending || !forecastProductId || !forecastVariantId}
                  className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20"
                >
                {generateForecast.isPending ? 'Generating...' : getText('merchant.inventory.generateForecast', 'Emit Forecast')}
              </Button>
            </div>

            <div className="space-y-3 pt-4 border-t border-gray-50 mt-auto">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-gray-400">{getText('merchant.inventory.latestPulse', 'Latest Pulse')}</span>
                <span className="text-blue-600">
                  {latestForecast?.id ? `#${latestForecast.id.substring(0, 8)}` : getText('merchant.inventory.noSignal', 'No Signal')}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-gray-400">{getText('merchant.inventory.demandProjection', 'Demand Projection')}</span>
                <span className="text-gray-900">{latestForecast?.predictedDemand || 0} {getText('merchant.inventory.units', 'units')}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm space-y-6 min-h-[360px] h-full flex flex-col">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900">
                {getText('merchant.inventory.recordAccuracy', 'Calibration')}
              </h3>
              <p className="text-gray-400 text-xs font-medium">
                {getText('merchant.inventory.recordAccuracyDescription', 'Submit actual demand to calibrate the prediction model.')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">{getText('merchant.inventory.forecastId', 'Forecast ID')}</label>
                <Input
                  placeholder="Enter ID..."
                  value={forecastId}
                  onChange={(e) => setForecastId(e.target.value)}
                  className="h-11 rounded-xl bg-gray-50/50 border-gray-100 focus:bg-white transition-all font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">{getText('merchant.inventory.actualDemand', 'Actual Demand')}</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={actualDemand}
                  onChange={(e) => setActualDemand(e.target.value)}
                  className="h-11 rounded-xl bg-gray-50/50 border-gray-100 focus:bg-white transition-all font-bold"
                />
              </div>
            </div>

            <Button
              onClick={handleRecordAccuracy}
              disabled={recordAccuracy.isPending || !forecastId.trim() || !actualDemand.trim()}
              className="w-full h-11 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-black/10"
            >
              {recordAccuracy.isPending ? 'Calibrating...' : getText('merchant.inventory.submitAccuracy', 'Submit Calibration')}
            </Button>
            <div className="space-y-3 pt-4 border-t border-gray-50 mt-auto">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-gray-400">{getText('merchant.inventory.accuracyTrendLabel', 'Accuracy Trend')}</span>
                <span className="text-gray-900">{accuracyMetrics?.accuracyTrend || '-'}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-gray-400">{getText('merchant.inventory.contextProduct', 'Context Product')}</span>
                <span className="text-blue-600">{dashboardData?.context?.productId || getText('merchant.inventory.noSignal', 'No Signal')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm space-y-8">
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-gray-900">{getText('merchant.inventory.demandForecast', 'Spectral Analysis')}</h3>
            <p className="text-gray-400 text-xs font-medium">{getText('merchant.inventory.forecastDescription', 'Demand visualization for the next sync cycle.')}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.inventory.predicted', 'Predicted')}</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{formatNumber(latestForecast?.predictedDemand, 0)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.inventory.confidence', 'Confidence')}</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{formatNumber(latestForecast?.confidence)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.inventory.trend', 'Trend')}</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{latestForecast?.trendAnalysis?.trend || '-'}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.inventory.stockoutIn', 'Stockout In')}</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{formatNumber(latestForecast?.reorderPoint?.daysUntilStockout, 0)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.inventory.orderQty', 'Order Qty')}</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{formatNumber(latestForecast?.reorderPoint?.recommendedOrderQuantity, 0)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Avg Accuracy</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{formatNumber(accuracyMetrics?.avgAccuracy)}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-100 p-5 space-y-3">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.inventory.forecastCore', 'Forecast Core')}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-gray-500">{getText('merchant.inventory.forecastId', 'Forecast ID')}</div>
                <div className="text-right font-mono font-semibold text-gray-900 break-all">{latestForecast?.id || '-'}</div>
                <div className="text-gray-500">{getText('merchant.inventory.productId', 'Product ID')}</div>
                <div className="text-right font-mono font-semibold text-gray-900 break-all">{latestForecast?.productId || '-'}</div>
                <div className="text-gray-500">{getText('merchant.inventory.variantId', 'Variant ID')}</div>
                <div className="text-right font-mono font-semibold text-gray-900 break-all">{latestForecast?.variantId || '-'}</div>
                <div className="text-gray-500">{getText('merchant.inventory.forecastDate', 'Forecast Date')}</div>
                <div className="text-right font-semibold text-gray-900">{formatDateTime(latestForecast?.forecastDate)}</div>
                <div className="text-gray-500">{getText('merchant.inventory.method', 'Method')}</div>
                <div className="text-right font-semibold text-gray-900">{latestForecast?.method || '-'}</div>
                <div className="text-gray-500">{getText('merchant.inventory.createdAt', 'Created At')}</div>
                <div className="text-right font-semibold text-gray-900">{formatDateTime(latestForecast?.createdAt)}</div>
                <div className="text-gray-500">{getText('merchant.inventory.updatedAt', 'Updated At')}</div>
                <div className="text-right font-semibold text-gray-900">{formatDateTime(latestForecast?.updatedAt)}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 p-5 space-y-3">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.inventory.accuracyMetrics', 'Accuracy Metrics')}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-gray-500">{getText('merchant.inventory.avgMAPE', 'AVG MAPE')}</div>
                <div className="text-right font-semibold text-gray-900">{formatNumber(accuracyMetrics?.avgMAPE)}%</div>
                <div className="text-gray-500">{getText('merchant.inventory.avgMAE', 'AVG MAE')}</div>
                <div className="text-right font-semibold text-gray-900">{formatNumber(accuracyMetrics?.avgMAE)}</div>
                <div className="text-gray-500">{getText('merchant.inventory.avgRMSE', 'AVG RMSE')}</div>
                <div className="text-right font-semibold text-gray-900">{formatNumber(accuracyMetrics?.avgRMSE)}</div>
                <div className="text-gray-500">{getText('merchant.inventory.forecastCount', 'Forecast Count')}</div>
                <div className="text-right font-semibold text-gray-900">{accuracyMetrics?.totalForecasts ?? 0}</div>
                <div className="text-gray-500">{getText('merchant.inventory.trend', 'Trend')}</div>
                <div className="text-right font-semibold text-gray-900">{accuracyMetrics?.accuracyTrend || '-'}</div>
                <div className="text-gray-500">{getText('merchant.inventory.periodStart', 'Period Start')}</div>
                <div className="text-right font-semibold text-gray-900">{formatDateTime(accuracyMetrics?.period?.startDate)}</div>
                <div className="text-gray-500">{getText('merchant.inventory.periodEnd', 'Period End')}</div>
                <div className="text-right font-semibold text-gray-900">{formatDateTime(accuracyMetrics?.period?.endDate)}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 p-5 space-y-3">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.inventory.trendAnalysis', 'Trend Analysis')}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-gray-500">{getText('merchant.inventory.dailyAverage', 'Daily Average')}</div>
                <div className="text-right font-semibold text-gray-900">{formatNumber(latestForecast?.trendAnalysis?.dailyAverage)}</div>
                <div className="text-gray-500">{getText('merchant.inventory.weeklyAverage', 'Weekly Average')}</div>
                <div className="text-right font-semibold text-gray-900">{formatNumber(latestForecast?.trendAnalysis?.weeklyAverage)}</div>
                <div className="text-gray-500">{getText('merchant.inventory.monthlyAverage', 'Monthly Average')}</div>
                <div className="text-right font-semibold text-gray-900">{formatNumber(latestForecast?.trendAnalysis?.monthlyAverage)}</div>
                <div className="text-gray-500">{getText('merchant.inventory.growthRate', 'Growth Rate')}</div>
                <div className="text-right font-semibold text-gray-900">{formatNumber(latestForecast?.trendAnalysis?.growthRate)}%</div>
                <div className="text-gray-500">{getText('merchant.inventory.volatility', 'Volatility')}</div>
                <div className="text-right font-semibold text-gray-900">{formatNumber(latestForecast?.trendAnalysis?.volatility)}</div>
                <div className="text-gray-500">{getText('merchant.inventory.trendConfidence', 'Trend Confidence')}</div>
                <div className="text-right font-semibold text-gray-900">{formatNumber(latestForecast?.trendAnalysis?.confidence)}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 p-5 space-y-3">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.inventory.reorderPoint', 'Reorder Point')}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-gray-500">{getText('merchant.inventory.reorderPoint', 'Reorder Point')}</div>
                <div className="text-right font-semibold text-gray-900">{formatNumber(latestForecast?.reorderPoint?.reorderPoint, 0)}</div>
                <div className="text-gray-500">{getText('merchant.inventory.safetyStock', 'Safety Stock')}</div>
                <div className="text-right font-semibold text-gray-900">{formatNumber(latestForecast?.reorderPoint?.safetyStock, 0)}</div>
                <div className="text-gray-500">{getText('merchant.inventory.averageDailyDemand', 'Average Daily Demand')}</div>
                <div className="text-right font-semibold text-gray-900">{formatNumber(latestForecast?.reorderPoint?.averageDailyDemand)}</div>
                <div className="text-gray-500">{getText('merchant.inventory.leadTime', 'Lead Time')}</div>
                <div className="text-right font-semibold text-gray-900">{formatNumber(latestForecast?.reorderPoint?.leadTime, 0)} {getText('merchant.inventory.unitDays', 'days')}</div>
                <div className="text-gray-500">{getText('merchant.inventory.maxDailyDemand', 'Max Daily Demand')}</div>
                <div className="text-right font-semibold text-gray-900">{formatNumber(latestForecast?.reorderPoint?.maxDailyDemand, 0)}</div>
                <div className="text-gray-500">{getText('merchant.inventory.daysUntilStockout', 'Days Until Stockout')}</div>
                <div className="text-right font-semibold text-gray-900">{formatNumber(latestForecast?.reorderPoint?.daysUntilStockout, 0)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 p-5 space-y-3">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.inventory.seasonalFactors', 'Seasonal Factors')}</div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="text-gray-500">{getText('merchant.inventory.weeklyPattern', 'Weekly Pattern')}</div>
                {weeklyPattern.length > 0 ? (
                  weeklyPattern.map((value, index) => (
                    <div key={`weekly-${index}`} className="flex items-center gap-2">
                      <span className="w-8 text-[10px] text-gray-400">D{index + 1}</span>
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${Math.max((value / weeklyMax) * 100, 4)}%` }}
                        />
                      </div>
                      <span className="w-12 text-right font-semibold text-gray-900">{formatNumber(value)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400">-</div>
                )}
              </div>
              <div className="space-y-2">
                <div className="text-gray-500">{getText('merchant.inventory.monthlyPattern', 'Monthly Pattern')}</div>
                {monthlyPattern.length > 0 ? (
                  monthlyPattern.map((value, index) => (
                    <div key={`monthly-${index}`} className="flex items-center gap-2">
                      <span className="w-8 text-[10px] text-gray-400">M{index + 1}</span>
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${Math.max((value / monthlyMax) * 100, 4)}%` }}
                        />
                      </div>
                      <span className="w-12 text-right font-semibold text-gray-900">{formatNumber(value)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400">-</div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 text-xs">
              <div className="text-gray-500">{getText('merchant.inventory.dayOfWeekMultipliers', 'Day Of Week Multipliers')}</div>
              <div className="font-mono text-[11px] text-gray-900 break-all">{dayOfWeekText || weeklyPatternText}</div>
              <div className="text-gray-500">{getText('merchant.inventory.holidayImpact', 'Holiday Impact')}</div>
              <div className="font-mono text-[11px] text-gray-900 break-all">{holidayImpactText || monthlyPatternText}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
