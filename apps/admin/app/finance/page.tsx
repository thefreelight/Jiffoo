'use client'

import { useState } from 'react'
import { Sidebar } from '../../components/layout/sidebar'
import { Header } from '../../components/layout/header'
import { Button } from '../../components/ui/button'
import { StatsCard } from '../../components/dashboard/stats-card'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import {
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
  CreditCardIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline'

// Mock financial data
const revenueData = [
  { month: 'Jan', revenue: 156000, profit: 45000, expenses: 111000 },
  { month: 'Feb', revenue: 178000, profit: 52000, expenses: 126000 },
  { month: 'Mar', revenue: 165000, profit: 48000, expenses: 117000 },
  { month: 'Apr', revenue: 195000, profit: 58000, expenses: 137000 },
  { month: 'May', revenue: 187000, profit: 55000, expenses: 132000 },
  { month: 'Jun', revenue: 210000, profit: 63000, expenses: 147000 },
]

const transactions = [
  {
    id: 'TXN-2024-001',
    type: 'Payment',
    customer: 'Zhang Wei',
    amount: 15999,
    method: 'Alipay',
    status: 'Completed',
    date: '2024-01-15 14:30',
    orderId: 'ORD-2024-001',
  },
  {
    id: 'TXN-2024-002',
    type: 'Refund',
    customer: 'Li Mei',
    amount: -2899,
    method: 'WeChat Pay',
    status: 'Completed',
    date: '2024-01-15 12:15',
    orderId: 'ORD-2024-002',
  },
  {
    id: 'TXN-2024-003',
    type: 'Payment',
    customer: 'Wang Lei',
    amount: 8999,
    method: 'Credit Card',
    status: 'Pending',
    date: '2024-01-14 16:45',
    orderId: 'ORD-2024-003',
  },
  {
    id: 'TXN-2024-004',
    type: 'Payment',
    customer: 'Chen Xiao',
    amount: 1299,
    method: 'Bank Transfer',
    status: 'Completed',
    date: '2024-01-14 10:20',
    orderId: 'ORD-2024-004',
  },
  {
    id: 'TXN-2024-005',
    type: 'Refund',
    customer: 'Liu Yang',
    amount: -4999,
    method: 'Alipay',
    status: 'Processing',
    date: '2024-01-13 09:30',
    orderId: 'ORD-2024-005',
  },
]

const paymentMethods = [
  { name: 'Alipay', transactions: 1245, amount: 567800, percentage: 45 },
  { name: 'WeChat Pay', transactions: 987, amount: 432100, percentage: 35 },
  { name: 'Credit Card', transactions: 456, amount: 198900, percentage: 15 },
  { name: 'Bank Transfer', transactions: 123, amount: 67200, percentage: 5 },
]

export default function FinancePage() {
  const [selectedPeriod, setSelectedPeriod] = useState('6months')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800'
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'Processing':
        return 'bg-blue-100 text-blue-800'
      case 'Failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Payment':
        return 'text-green-600'
      case 'Refund':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
                <p className="text-gray-600 mt-1">Track revenue, payments, and financial performance</p>
              </div>
              <div className="flex space-x-3">
                <Button variant="outline">
                  <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
                  Export Report
                </Button>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="1month">Last Month</option>
                  <option value="3months">Last 3 Months</option>
                  <option value="6months">Last 6 Months</option>
                  <option value="1year">Last Year</option>
                </select>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatsCard
              title="Total Revenue"
              value="¥1,091,000"
              change="+15.3%"
              changeType="increase"
              color="blue"
              icon={<CurrencyDollarIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Net Profit"
              value="¥321,000"
              change="+12.8%"
              changeType="increase"
              color="green"
              icon={<ArrowTrendingUpIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Total Expenses"
              value="¥770,000"
              change="+8.2%"
              changeType="increase"
              color="orange"
              icon={<ArrowTrendingDownIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Pending Payments"
              value="¥45,600"
              change="-5.1%"
              changeType="decrease"
              color="purple"
              icon={<BanknotesIcon className="w-5 h-5" />}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Revenue Trend */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Revenue & Profit Trend</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `¥${value / 1000}K`} />
                    <Tooltip formatter={(value: any) => [`¥${value.toLocaleString()}`, '']} />
                    <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="profit" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center space-x-6 mt-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-600">Revenue</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-600">Profit</span>
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Payment Methods</h3>
              <div className="space-y-4">
                {paymentMethods.map((method, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                        <CreditCardIcon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{method.name}</div>
                        <div className="text-sm text-gray-500">{method.transactions} transactions</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">¥{method.amount.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">{method.percentage}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Transaction ID</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Type</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Customer</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Amount</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Method</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Status</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Date</th>
                    <th className="text-left py-3 px-6 font-medium text-gray-900">Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <div className="font-mono text-blue-600 text-sm">{transaction.id}</div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`font-medium ${getTypeColor(transaction.type)}`}>
                          {transaction.type}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-900">{transaction.customer}</td>
                      <td className="py-4 px-6">
                        <span className={`font-medium ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.amount > 0 ? '+' : ''}¥{Math.abs(transaction.amount).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-600">{transaction.method}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(transaction.status)}`}>
                          {transaction.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-600 text-sm">{transaction.date}</td>
                      <td className="py-4 px-6">
                        <a href="#" className="text-blue-600 hover:text-blue-800 text-sm">
                          {transaction.orderId}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">1</span> to <span className="font-medium">{transactions.length}</span> of{' '}
              <span className="font-medium">156</span> results
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">Previous</Button>
              <Button variant="outline" size="sm">1</Button>
              <Button variant="outline" size="sm">2</Button>
              <Button variant="outline" size="sm">3</Button>
              <Button variant="outline" size="sm">Next</Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
