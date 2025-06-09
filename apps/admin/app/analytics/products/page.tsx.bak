'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
} from 'recharts'
import {
  ArrowLeftIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

// Mock product analytics data
const productPerformance = [
  { name: 'iPhone 15 Pro Max', revenue: 2339400, units: 234, profit: 701820, margin: 30, category: 'Electronics' },
  { name: 'MacBook Pro 16"', revenue: 1779111, units: 89, profit: 533733, margin: 30, category: 'Electronics' },
  { name: 'Samsung 4K TV 55"', revenue: 334933, units: 67, profit: 83733, margin: 25, category: 'Electronics' },
  { name: 'Nike Air Max 270', revenue: 140244, units: 156, profit: 42073, margin: 30, category: 'Fashion' },
  { name: 'Sony WH-1000XM5', revenue: 89567, units: 89, profit: 26870, margin: 30, category: 'Electronics' },
  { name: 'Adidas Ultraboost', revenue: 78234, units: 98, profit: 23470, margin: 30, category: 'Fashion' },
]

const categoryPerformance = [
  { name: 'Electronics', revenue: 4543011, units: 479, growth: 15.2, color: '#3B82F6' },
  { name: 'Fashion', revenue: 218478, units: 254, growth: 8.7, color: '#10B981' },
  { name: 'Home & Garden', revenue: 156789, units: 123, growth: -2.3, color: '#F59E0B' },
  { name: 'Sports', revenue: 89456, units: 67, growth: 22.1, color: '#EF4444' },
  { name: 'Books', revenue: 45678, units: 234, growth: 5.4, color: '#8B5CF6' },
]

const inventoryStatus = [
  { name: 'iPhone 15 Pro Max', stock: 45, lowStockThreshold: 10, status: 'healthy', sales: 234 },
  { name: 'MacBook Pro 16"', stock: 8, lowStockThreshold: 10, status: 'low', sales: 89 },
  { name: 'Samsung 4K TV 55"', stock: 0, lowStockThreshold: 5, status: 'out', sales: 67 },
  { name: 'Nike Air Max 270', stock: 156, lowStockThreshold: 20, status: 'healthy', sales: 156 },
  { name: 'Sony WH-1000XM5', stock: 3, lowStockThreshold: 15, status: 'critical', sales: 89 },
]

const priceAnalysis = [
  { name: 'iPhone 15 Pro Max', price: 9999, cost: 6999, margin: 30, demand: 95 },
  { name: 'MacBook Pro 16"', price: 19999, cost: 13999, margin: 30, demand: 78 },
  { name: 'Samsung 4K TV 55"', price: 4999, cost: 3749, margin: 25, demand: 65 },
  { name: 'Nike Air Max 270', price: 899, cost: 629, margin: 30, demand: 88 },
  { name: 'Sony WH-1000XM5', price: 2499, cost: 1749, margin: 30, demand: 72 },
]

export default function ProductAnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30d')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800'
      case 'low': return 'bg-yellow-100 text-yellow-800'
      case 'critical': return 'bg-orange-100 text-orange-800'
      case 'out': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStockIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircleIcon className="w-4 h-4 text-green-600" />
      case 'low': case 'critical': case 'out': return <ExclamationTriangleIcon className="w-4 h-4 text-red-600" />
      default: return <CubeIcon className="w-4 h-4 text-gray-600" />
    }
  }

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
            <h1 className="text-2xl font-bold text-gray-900">Product Analytics</h1>
            <p className="text-gray-600">Product performance and inventory insights</p>
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
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="electronics">Electronics</SelectItem>
              <SelectItem value="fashion">Fashion</SelectItem>
              <SelectItem value="home">Home & Garden</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-gray-900">1,234</p>
                <div className="flex items-center mt-1">
                  <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">+15.3%</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <CubeIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
                <p className="text-2xl font-bold text-gray-900">23</p>
                <div className="flex items-center mt-1">
                  <ExclamationTriangleIcon className="w-4 h-4 text-orange-500 mr-1" />
                  <span className="text-sm text-orange-600">Needs attention</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <ExclamationTriangleIcon className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Profit Margin</p>
                <p className="text-2xl font-bold text-gray-900">29.2%</p>
                <div className="flex items-center mt-1">
                  <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600">+2.1%</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <ArrowTrendingUpIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                <p className="text-2xl font-bold text-gray-900">5</p>
                <div className="flex items-center mt-1">
                  <ArrowTrendingDownIcon className="w-4 h-4 text-red-500 mr-1" />
                  <span className="text-sm text-red-600">Critical</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Product Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Product Performance</CardTitle>
            <CardDescription>Revenue by product</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productPerformance} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(value) => `¥${value / 1000}K`} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={120} />
                  <Tooltip formatter={(value: any) => [`¥${value.toLocaleString()}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Category Performance</CardTitle>
            <CardDescription>Revenue by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPerformance}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="revenue"
                  >
                    {categoryPerformance.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [`¥${value.toLocaleString()}`, 'Revenue']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {categoryPerformance.map((category, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: category.color }}
                    ></div>
                    <span className="text-sm text-gray-600">{category.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900">¥{category.revenue.toLocaleString()}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      category.growth > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {category.growth > 0 ? '+' : ''}{category.growth}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Status & Price Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Inventory Status */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory Status</CardTitle>
            <CardDescription>Stock levels and alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {inventoryStatus.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getStockIcon(item.status)}
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600">{item.sales} units sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{item.stock} units</span>
                      <Badge className={getStockStatusColor(item.status)}>
                        {item.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Threshold: {item.lowStockThreshold}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Price vs Demand Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Price vs Demand</CardTitle>
            <CardDescription>Price optimization insights</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart data={priceAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    type="number"
                    dataKey="price"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `¥${value}`}
                    name="Price"
                  />
                  <YAxis
                    type="number"
                    dataKey="demand"
                    axisLine={false}
                    tickLine={false}
                    name="Demand"
                  />
                  <Tooltip
                    formatter={(value: any, name: string) => {
                      if (name === 'price') return [`¥${value}`, 'Price']
                      if (name === 'demand') return [`${value}%`, 'Demand']
                      return [value, name]
                    }}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) {
                        return payload[0].payload.name
                      }
                      return label
                    }}
                  />
                  <Scatter dataKey="demand" fill="#8B5CF6" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Product Performance</CardTitle>
          <CardDescription>Comprehensive product metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Product</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Category</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Revenue</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Units Sold</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Profit</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Margin</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {productPerformance.map((product, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{product.name}</div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">{product.category}</Badge>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      ¥{product.revenue.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{product.units}</td>
                    <td className="py-3 px-4 font-medium text-green-600">
                      ¥{product.profit.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{product.margin}%</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${Math.min((product.revenue / 2500000) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600">
                          {Math.round((product.revenue / 2500000) * 100)}%
                        </span>
                      </div>
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
