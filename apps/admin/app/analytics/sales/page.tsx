'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  Area,
  AreaChart,
} from 'recharts'
import {
  ArrowLeftIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline'

// Mock sales data
const salesTrendData = [
  { date: '2024-01-01', revenue: 12000, orders: 45, avgOrderValue: 267 },
  { date: '2024-01-02', revenue: 15000, orders: 52, avgOrderValue: 288 },
  { date: '2024-01-03', revenue: 18000, orders: 61, avgOrderValue: 295 },
  { date: '2024-01-04', revenue: 14000, orders: 48, avgOrderValue: 292 },
  { date: '2024-01-05', revenue: 22000, orders: 73, avgOrderValue: 301 },
  { date: '2024-01-06', revenue: 19000, orders: 65, avgOrderValue: 292 },
  { date: '2024-01-07', revenue: 25000, orders: 82, avgOrderValue: 305 },
  { date: '2024-01-08', revenue: 21000, orders: 69, avgOrderValue: 304 },
  { date: '2024-01-09', revenue: 28000, orders: 89, avgOrderValue: 315 },
  { date: '2024-01-10', revenue: 24000, orders: 76, avgOrderValue: 316 },
]

const hourlyData = [
  { hour: '00:00', sales: 1200 },
  { hour: '01:00', sales: 800 },
  { hour: '02:00', sales: 600 },
  { hour: '03:00', sales: 400 },
  { hour: '04:00', sales: 300 },
  { hour: '05:00', sales: 500 },
  { hour: '06:00', sales: 800 },
  { hour: '07:00', sales: 1200 },
  { hour: '08:00', sales: 1800 },
  { hour: '09:00', sales: 2400 },
  { hour: '10:00', sales: 3200 },
  { hour: '11:00', sales: 3800 },
  { hour: '12:00', sales: 4200 },
  { hour: '13:00', sales: 3900 },
  { hour: '14:00', sales: 4100 },
  { hour: '15:00', sales: 3700 },
  { hour: '16:00', sales: 3300 },
  { hour: '17:00', sales: 2900 },
  { hour: '18:00', sales: 2500 },
  { hour: '19:00', sales: 2100 },
  { hour: '20:00', sales: 1800 },
  { hour: '21:00', sales: 1500 },
  { hour: '22:00', sales: 1200 },
  { hour: '23:00', sales: 1000 },
]

const salesByChannel = [
  { channel: 'Online Store', sales: 156000, percentage: 65, growth: 12.5 },
  { channel: 'Mobile App', sales: 72000, percentage: 30, growth: 18.3 },
  { channel: 'Social Media', sales: 12000, percentage: 5, growth: 25.7 },
]

const topSellingProducts = [
  { name: 'iPhone 15 Pro Max', revenue: 2339400, units: 234, growth: 15.2 },
  { name: 'MacBook Pro 16"', revenue: 1779111, units: 89, growth: 8.7 },
  { name: 'Samsung 4K TV 55"', revenue: 334933, units: 67, growth: -2.3 },
  { name: 'Nike Air Max 270', revenue: 140244, units: 156, growth: 22.1 },
  { name: 'Sony WH-1000XM5', revenue: 89567, units: 89, growth: 11.4 },
]

export default function SalesAnalyticsPage() {
  const [timeRange, setTimeRange] = useState('7d')
  const [chartType, setChartType] = useState('revenue')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Link href="/analytics">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Analytics
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales Analytics</h1>
            <p className="text-gray-600">Detailed sales performance and trends</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <CalendarIcon className="w-4 h-4 mr-2" />
            Custom Range
          </Button>
          <Button variant="outline" size="sm">
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">¥240,000</p>
                <div className="flex items-center mt-1">
                  <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">+12.5%</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <CurrencyDollarIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">560</p>
                <div className="flex items-center mt-1">
                  <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">+8.2%</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <ShoppingCartIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
                <p className="text-2xl font-bold text-gray-900">¥429</p>
                <div className="flex items-center mt-1">
                  <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">+4.1%</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <CurrencyDollarIcon className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                <p className="text-2xl font-bold text-gray-900">3.24%</p>
                <div className="flex items-center mt-1">
                  <ArrowTrendingDownIcon className="w-4 h-4 text-red-500 mr-1" />
                  <span className="text-sm text-red-600">-0.3%</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <ArrowTrendingUpIcon className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Sales Trend</CardTitle>
                <CardDescription>Revenue and orders over time</CardDescription>
              </div>
              <Select value={chartType} onValueChange={setChartType}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="orders">Orders</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={salesTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tickFormatter={(value) => `¥${value / 1000}K`} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: any, name: string) => {
                      if (name === 'revenue') return [`¥${value.toLocaleString()}`, 'Revenue']
                      if (name === 'orders') return [value, 'Orders']
                      return [value, name]
                    }}
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="revenue" fill="#3B82F6" fillOpacity={0.1} stroke="#3B82F6" strokeWidth={2} />
                  <Bar yAxisId="right" dataKey="orders" fill="#10B981" radius={[2, 2, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Sales by Channel */}
        <Card>
          <CardHeader>
            <CardTitle>Sales by Channel</CardTitle>
            <CardDescription>Revenue distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {salesByChannel.map((channel, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{channel.channel}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">¥{channel.sales.toLocaleString()}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        channel.growth > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {channel.growth > 0 ? '+' : ''}{channel.growth}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${channel.percentage}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{channel.percentage}% of total</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Hourly Sales Pattern */}
        <Card>
          <CardHeader>
            <CardTitle>Hourly Sales Pattern</CardTitle>
            <CardDescription>Sales distribution throughout the day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyData}>
                  <defs>
                    <linearGradient id="colorHourly" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `¥${value}`} />
                  <Tooltip formatter={(value: any) => [`¥${value}`, 'Sales']} />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorHourly)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Selling Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
            <CardDescription>Best performers by revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topSellingProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-blue-600 font-medium text-sm">{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-600">{product.units} units</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">¥{product.revenue.toLocaleString()}</p>
                    <div className="flex items-center">
                      {product.growth > 0 ? (
                        <ArrowTrendingUpIcon className="w-3 h-3 text-green-500 mr-1" />
                      ) : (
                        <ArrowTrendingDownIcon className="w-3 h-3 text-red-500 mr-1" />
                      )}
                      <span className={`text-xs ${product.growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {product.growth > 0 ? '+' : ''}{product.growth}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Summary</CardTitle>
          <CardDescription>Detailed breakdown of sales performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Revenue</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Orders</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Avg Order Value</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Growth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {salesTrendData.slice(0, 7).map((day, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">
                      {new Date(day.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">¥{day.revenue.toLocaleString()}</td>
                    <td className="py-3 px-4 text-gray-600">{day.orders}</td>
                    <td className="py-3 px-4 text-gray-600">¥{day.avgOrderValue}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        +{Math.floor(Math.random() * 10 + 5)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
