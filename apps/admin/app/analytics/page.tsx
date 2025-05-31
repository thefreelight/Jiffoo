'use client'

import { Sidebar } from '../../components/layout/sidebar'
import { Header } from '../../components/layout/header'
import { StatsCard } from '../../components/dashboard/stats-card'
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
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts'
import {
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ShoppingCartIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'

// Mock analytics data
const salesData = [
  { month: 'Jan', sales: 45000, orders: 234, customers: 189 },
  { month: 'Feb', sales: 52000, orders: 267, customers: 201 },
  { month: 'Mar', sales: 48000, orders: 245, customers: 195 },
  { month: 'Apr', sales: 61000, orders: 312, customers: 234 },
  { month: 'May', sales: 55000, orders: 289, customers: 218 },
  { month: 'Jun', sales: 67000, orders: 345, customers: 267 },
]

const categoryData = [
  { name: 'Electronics', value: 45, color: '#3B82F6' },
  { name: 'Fashion', value: 25, color: '#10B981' },
  { name: 'Home & Garden', value: 15, color: '#F59E0B' },
  { name: 'Sports', value: 10, color: '#EF4444' },
  { name: 'Others', value: 5, color: '#8B5CF6' },
]

const topProducts = [
  { name: 'iPhone 15 Pro Max', sales: 234, revenue: 2339400 },
  { name: 'MacBook Pro 16"', sales: 89, revenue: 1779111 },
  { name: 'Samsung 4K TV', sales: 67, revenue: 334933 },
  { name: 'Nike Air Max', sales: 156, revenue: 140244 },
  { name: 'Adidas Ultraboost', sales: 198, revenue: 257202 },
]

const revenueData = [
  { date: '01/01', revenue: 12000 },
  { date: '01/02', revenue: 15000 },
  { date: '01/03', revenue: 18000 },
  { date: '01/04', revenue: 14000 },
  { date: '01/05', revenue: 22000 },
  { date: '01/06', revenue: 19000 },
  { date: '01/07', revenue: 25000 },
]

export default function AnalyticsPage() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600 mt-1">Track your business performance and insights</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatsCard
              title="Total Revenue"
              value="¥328,000"
              change="+15.3%"
              changeType="increase"
              color="blue"
              icon={<CurrencyDollarIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Total Orders"
              value="1,692"
              change="+8.2%"
              changeType="increase"
              color="green"
              icon={<ShoppingCartIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="New Customers"
              value="1,304"
              change="+12.1%"
              changeType="increase"
              color="purple"
              icon={<UsersIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Conversion Rate"
              value="3.24%"
              change="+0.5%"
              changeType="increase"
              color="orange"
              icon={<ArrowTrendingUpIcon className="w-5 h-5" />}
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Sales Trend */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Sales Trend</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `¥${value / 1000}K`} />
                    <Tooltip formatter={(value: any) => [`¥${value.toLocaleString()}`, 'Sales']} />
                    <Bar dataKey="sales" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Revenue Trend */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Daily Revenue</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `¥${value / 1000}K`} />
                    <Tooltip formatter={(value: any) => [`¥${value.toLocaleString()}`, 'Revenue']} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10B981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Category Distribution */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Sales by Category</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [`${value}%`, 'Share']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {categoryData.map((category, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: category.color }}
                      ></div>
                      <span className="text-sm text-gray-600">{category.name}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{category.value}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Products */}
            <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Top Selling Products</h3>
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                        <span className="text-blue-600 font-medium text-sm">{index + 1}</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500">{product.sales} units sold</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">¥{product.revenue.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">Revenue</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
