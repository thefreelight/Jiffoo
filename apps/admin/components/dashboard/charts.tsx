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

// Direct vs Indirect Chart Data
const directVsIndirectData = [
  { name: 'Jan', direct: 8250, indirect: 27700 },
  { name: 'Feb', direct: 7800, indirect: 25200 },
  { name: 'Mar', direct: 9100, indirect: 28900 },
  { name: 'Apr', direct: 8600, indirect: 26800 },
  { name: 'May', direct: 9500, indirect: 29200 },
  { name: 'Jun', direct: 8900, indirect: 27100 },
]

// Real Time Value Data
const realTimeData = Array.from({ length: 50 }, (_, i) => ({
  time: i,
  value: 52220 + Math.sin(i * 0.1) * 2000 + Math.random() * 1000
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

export function DirectVsIndirectChart() {
  return (
    <ChartCard title="Direct VS Indirect">
      <div className="mb-4">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Direct</span>
            <span className="text-lg font-semibold text-gray-900">$8.25K</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-300 rounded-full"></div>
            <span className="text-sm text-gray-600">Indirect</span>
            <span className="text-lg font-semibold text-gray-900">$27.7K</span>
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          <span>-8%</span>
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={directVsIndirectData} barCategoryGap="20%">
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
              tickFormatter={(value) => `$${value / 1000}K`}
            />
            <Tooltip 
              formatter={(value: any) => [`$${value.toLocaleString()}`, '']}
              labelStyle={{ color: '#374151' }}
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Bar dataKey="direct" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="indirect" fill="#93C5FD" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

export function RealTimeValueChart() {
  return (
    <ChartCard 
      title="Real Time Value" 
      action={
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">Live</span>
        </div>
      }
    >
      <div className="mb-4">
        <div className="text-2xl font-bold text-gray-900">$52.22</div>
        <div className="flex items-center space-x-2 mt-1">
          <span className="text-green-600 text-sm font-medium">+4.00%</span>
          <span className="text-gray-500 text-sm">vs last hour</span>
        </div>
      </div>
      
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={realTimeData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3B82F6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorValue)"
              dot={false}
            />
            <Tooltip 
              formatter={(value: any) => [`$${value.toFixed(2)}`, 'Value']}
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
