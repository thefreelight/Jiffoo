'use client'

import { DashboardOverview } from '@/components/dashboard/dashboard-overview'
import { TenantStats } from '@/components/dashboard/tenant-stats'
import { PlatformRevenueChart } from '@/components/dashboard/platform-revenue-chart'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { useI18n } from '@/lib/i18n'

export default function Dashboard() {
  const { t } = useI18n()

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">{t('dashboard.title', 'Platform Dashboard')}</h2>
        <p className="text-gray-600 mt-2">
          {t('dashboard.welcome', 'Welcome to the Jiffoo Platform Super Admin Dashboard. Monitor all tenants, users, and platform-wide statistics.')}
        </p>
      </div>

      {/* Overview Cards */}
      <DashboardOverview />

      {/* Charts and Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <TenantStats />
        <PlatformRevenueChart />
      </div>

      {/* Recent Activity */}
      <RecentActivity />
    </div>
  )
}
