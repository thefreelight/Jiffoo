/**
 * ForecastChart Component
 *
 * Displays demand forecast chart with historical vs predicted demand and confidence bands.
 * Follows chart patterns from dashboard/charts.tsx
 */

'use client'

import React from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { useT } from 'shared/src/i18n/react'

// Chart Data Interfaces (matches API types)
export interface DailyForecastPrediction {
  date: string
  predictedDemand: number
  confidence: number
  lowerBound: number
  upperBound: number
}

export interface ForecastChartData {
  productId: string
  variantId?: string | null
  historicalDemand: Array<{ date: string; demand: number }>
  predictions: DailyForecastPrediction[]
  reorderPoint: number
  currentStock: number
}

interface ChartCardProps {
  title: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}

function ChartCard({ title, children, className, action }: ChartCardProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

interface ForecastChartProps {
  data?: ForecastChartData
  loading?: boolean
}

export function ForecastChart({ data, loading = false }: ForecastChartProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  // Transform data for recharts
  const chartData = React.useMemo(() => {
    if (!data) return []

    const historical = data.historicalDemand.map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      historicalDemand: item.demand,
      predictedDemand: null,
      lowerBound: null,
      upperBound: null,
      type: 'historical' as const
    }))

    const predicted = data.predictions.map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      historicalDemand: null,
      predictedDemand: item.predictedDemand,
      lowerBound: item.lowerBound,
      upperBound: item.upperBound,
      type: 'predicted' as const
    }))

    return [...historical, ...predicted]
  }, [data])

  if (loading) {
    return (
      <ChartCard title={getText('merchant.inventory.demandForecast', 'Demand Forecast')}>
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </ChartCard>
    )
  }

  if (!data || chartData.length === 0) {
    return (
      <ChartCard title={getText('merchant.inventory.demandForecast', 'Demand Forecast')}>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="text-center">
            <p className="text-gray-600 mb-2">
              {getText('merchant.inventory.noForecastData', 'No forecast data available')}
            </p>
            <p className="text-sm text-gray-500">
              {getText('merchant.inventory.selectProduct', 'Select a product to view demand forecast')}
            </p>
          </div>
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title={getText('merchant.inventory.demandForecast', 'Demand Forecast')}>
      <div className="mb-4">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-gray-600">
              {getText('merchant.inventory.historicalDemand', 'Historical Demand')}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span className="text-sm text-gray-600">
              {getText('merchant.inventory.predictedDemand', 'Predicted Demand')}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-purple-200 rounded-full"></div>
            <span className="text-sm text-gray-600">
              {getText('merchant.inventory.confidenceBands', 'Confidence Bands')}
            </span>
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          <span className="text-gray-600">
            {getText('merchant.inventory.currentStock', 'Current Stock')}: {data.currentStock}
          </span>
          <span className="text-gray-400 mx-2">•</span>
          <span className="text-gray-600">
            {getText('merchant.inventory.reorderPoint', 'Reorder Point')}: {data.reorderPoint}
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="date"
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#6B7280"
            style={{ fontSize: '12px' }}
            label={{
              value: getText('merchant.inventory.units', 'Units'),
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: '12px', fill: '#6B7280' }
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
            labelStyle={{ color: '#111827', fontWeight: 600 }}
          />

          {/* Confidence bands as area */}
          <Area
            type="monotone"
            dataKey="upperBound"
            stroke="none"
            fill="#C4B5FD"
            fillOpacity={0.3}
          />
          <Area
            type="monotone"
            dataKey="lowerBound"
            stroke="none"
            fill="#ffffff"
            fillOpacity={1}
          />

          {/* Historical demand line */}
          <Line
            type="monotone"
            dataKey="historicalDemand"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={{ fill: '#3B82F6', r: 3 }}
            connectNulls={false}
            name={getText('merchant.inventory.historicalDemand', 'Historical Demand')}
          />

          {/* Predicted demand line */}
          <Line
            type="monotone"
            dataKey="predictedDemand"
            stroke="#8B5CF6"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#8B5CF6', r: 3 }}
            connectNulls={false}
            name={getText('merchant.inventory.predictedDemand', 'Predicted Demand')}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
