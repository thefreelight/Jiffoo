/**
 * Performance Analytics Component
 *
 * Displays recommendation performance charts including CTR and conversion data.
 * Supports i18n through the translation function.
 */

'use client'

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { useT } from 'shared/src/i18n/react'
import { TrendingUp, MousePointerClick, ShoppingCart } from 'lucide-react'

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

interface PerformanceAnalyticsProps {
  // Data can be passed from parent or fetched internally
  timeSeriesData?: Array<{
    date: string
    ctr: number
    conversionRate: number
    impressions: number
  }>
  performanceByType?: Array<{
    type: string
    ctr: number
    conversionRate: number
    revenue: number
  }>
}

export function PerformanceAnalytics({
  timeSeriesData,
  performanceByType
}: PerformanceAnalyticsProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Mock data for demonstration
  // TODO: Replace with actual API data when analytics endpoint is integrated
  const defaultTimeSeriesData = timeSeriesData || [
    { date: 'Jan 1', ctr: 10.2, conversionRate: 2.1, impressions: 450 },
    { date: 'Jan 2', ctr: 11.5, conversionRate: 2.5, impressions: 520 },
    { date: 'Jan 3', ctr: 10.8, conversionRate: 2.3, impressions: 480 },
    { date: 'Jan 4', ctr: 12.1, conversionRate: 2.8, impressions: 540 },
    { date: 'Jan 5', ctr: 11.9, conversionRate: 2.7, impressions: 530 },
    { date: 'Jan 6', ctr: 13.2, conversionRate: 3.2, impressions: 580 },
    { date: 'Jan 7', ctr: 12.5, conversionRate: 3.0, impressions: 560 }
  ]

  const defaultPerformanceByType = performanceByType || [
    {
      type: getText('merchant.recommendations.type.customersAlsoBought', 'Customers Also Bought'),
      ctr: 12.5,
      conversionRate: 3.2,
      revenue: 8420
    },
    {
      type: getText('merchant.recommendations.type.frequentlyBought', 'Frequently Bought Together'),
      ctr: 15.3,
      conversionRate: 4.1,
      revenue: 5200
    },
    {
      type: getText('merchant.recommendations.type.personalized', 'Personalized'),
      ctr: 11.8,
      conversionRate: 2.9,
      revenue: 1800
    }
  ]

  // Custom tooltip for time series charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center space-x-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600">{entry.name}:</span>
              <span className="font-medium text-gray-900">{entry.value}%</span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  // Custom tooltip for bar chart
  const BarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center space-x-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600">{entry.name}:</span>
              <span className="font-medium text-gray-900">
                {entry.name === 'Revenue' ? `$${entry.value.toLocaleString()}` : `${entry.value}%`}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* CTR Over Time Chart */}
      <ChartCard
        title={getText('merchant.recommendations.charts.ctrOverTime', 'Click-Through Rate Over Time')}
      >
        <div className="mb-4">
          <div className="flex items-center space-x-2">
            <MousePointerClick className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-600">
              {getText('merchant.recommendations.charts.ctrDescription', 'Percentage of recommendations that users clicked')}
            </span>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={defaultTimeSeriesData}>
              <defs>
                <linearGradient id="colorCtr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748B', fontSize: 12 }}
                stroke="#CBD5E1"
              />
              <YAxis
                tick={{ fill: '#64748B', fontSize: 12 }}
                stroke="#CBD5E1"
                label={{
                  value: 'CTR (%)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: '#64748B', fontSize: 12 }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="ctr"
                name="CTR"
                stroke="#3B82F6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCtr)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Conversion Rate Over Time Chart */}
      <ChartCard
        title={getText('merchant.recommendations.charts.conversionOverTime', 'Conversion Rate Over Time')}
      >
        <div className="mb-4">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-600">
              {getText('merchant.recommendations.charts.conversionDescription', 'Percentage of clicks that resulted in purchases')}
            </span>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={defaultTimeSeriesData}>
              <defs>
                <linearGradient id="colorConversion" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#64748B', fontSize: 12 }}
                stroke="#CBD5E1"
              />
              <YAxis
                tick={{ fill: '#64748B', fontSize: 12 }}
                stroke="#CBD5E1"
                label={{
                  value: 'Conversion Rate (%)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: '#64748B', fontSize: 12 }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="conversionRate"
                name="Conversion Rate"
                stroke="#22C55E"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorConversion)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Performance by Recommendation Type */}
      <ChartCard
        title={getText('merchant.recommendations.charts.performanceByType', 'Performance by Recommendation Type')}
      >
        <div className="mb-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-gray-600">
              {getText('merchant.recommendations.charts.compareTypes', 'Compare CTR and conversion rates across recommendation algorithms')}
            </span>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={defaultPerformanceByType}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="type"
                tick={{ fill: '#64748B', fontSize: 12 }}
                stroke="#CBD5E1"
              />
              <YAxis
                tick={{ fill: '#64748B', fontSize: 12 }}
                stroke="#CBD5E1"
                label={{
                  value: 'Rate (%)',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: '#64748B', fontSize: 12 }
                }}
              />
              <Tooltip content={<BarTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="circle"
              />
              <Bar
                dataKey="ctr"
                name="CTR"
                fill="#3B82F6"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="conversionRate"
                name="Conversion Rate"
                fill="#22C55E"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  )
}
