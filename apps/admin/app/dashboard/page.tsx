'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '../../lib/store'
import { Sidebar } from '../../components/layout/sidebar'
import { Header } from '../../components/layout/header'
import { StatsCard } from '../../components/dashboard/stats-card'
import { SalesChannelChart, RealTimeOrdersChart } from '../../components/dashboard/charts'
import {
  CurrencyDollarIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  UsersIcon
} from '@heroicons/react/24/outline'

export default function DashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header title="Dashboard" />


        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-6">

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatsCard
              title="Total Revenue"
              value="¥156,780"
              change="+12.5%"
              changeType="increase"
              color="blue"
              icon={<CurrencyDollarIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Total Orders"
              value="2,847"
              change="+8.2%"
              changeType="increase"
              color="green"
              icon={<ArrowTrendingUpIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Total Products"
              value="1,234"
              change="+15.3%"
              changeType="increase"
              color="purple"
              icon={<ArrowTrendingUpIcon className="w-5 h-5" />}
            />
            <StatsCard
              title="Active Users"
              value="8,567"
              change="-2.1%"
              changeType="decrease"
              color="orange"
              icon={<ArrowTrendingDownIcon className="w-5 h-5" />}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SalesChannelChart />
            <RealTimeOrdersChart />
          </div>
        </main>
      </div>
    </div>
  )
}
