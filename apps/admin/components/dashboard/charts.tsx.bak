'use client'

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
  Area,
  AreaChart
} from 'recharts'

// Online vs Offline Sales Data
const salesChannelData = [
  { name: 'Jan', online: 45000, offline: 28000 },
  { name: 'Feb', online: 52000, offline: 31000 },
  { name: 'Mar', online: 48000, offline: 29000 },
  { name: 'Apr', online: 61000, offline: 35000 },
  { name: 'May', online: 55000, offline: 33000 },
  { name: 'Jun', online: 67000, offline: 38000 },
]

// Real Time Orders Data
const realTimeOrdersData = Array.from({ length: 50 }, (_, i) => ({
  time: i,
  value: 156 + Math.sin(i * 0.1) * 20 + Math.random() * 10
}))

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

export function SalesChannelChart() {
  return (
    <ChartCard title="Online VS Offline Sales">
      <div className="mb-4">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Online</span>
            <span className="text-lg font-semibold text-gray-900">¥67.0K</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-300 rounded-full"></div>
            <span className="text-sm text-gray-600">Offline</span>
            <span className="text-lg font-semibold text-gray-900">¥38.0K</span>
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          <span className="text-green-600">+12.5%</span> vs last month
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={salesChannelData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6B7280' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6B7280' }}
              tickFormatter={(value) => `¥${value / 1000}K`}
            />
            <Tooltip
              formatter={(value: any) => [`¥${value.toLocaleString()}`, '']}
              labelStyle={{ color: '#374151' }}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Bar dataKey="online" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="offline" fill="#93C5FD" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

export function RealTimeOrdersChart() {
  return (
    <ChartCard
      title="Real Time Orders"
      action={
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">Live</span>
        </div>
      }
    >
      <div className="mb-4">
        <div className="text-2xl font-bold text-gray-900">156</div>
        <div className="flex items-center space-x-2 mt-1">
          <span className="text-green-600 text-sm font-medium">+8.2%</span>
          <span className="text-gray-500 text-sm">vs last hour</span>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={realTimeOrdersData}>
            <defs>
              <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke="#10B981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorOrders)"
              dot={false}
            />
            <Tooltip
              formatter={(value: any) => [`${Math.round(value)}`, 'Orders']}
              labelFormatter={() => 'Now'}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
