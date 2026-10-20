/**
 * Customers list page — reference design layout: gradient hero, four stat
 * cards, toolbar (search / level / status / export / add), customer table
 * with level badges and activity status, pagination.
 */

'use client'

import { useState } from 'react'
import { Crown, Download, Eye, MoreHorizontal, Plus, Search, Users, UserPlus, UserCheck, UserX } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useT, useLocale } from 'shared/src/i18n/react'
import { PageShell } from '@/components/layout/page-shell'
import { PageHero, MiniStatCard, TablePagination, SortableTh } from '@/components/list/list-kit'
import { useUsers, useUserStats, type User } from '@/lib/hooks/use-api'
import { formatCurrency, cn } from '@/lib/utils'

const AVATAR_TONES = [
  'bg-violet-100 text-violet-600',
  'bg-orange-100 text-orange-600',
  'bg-sky-100 text-sky-600',
  'bg-emerald-100 text-emerald-600',
  'bg-rose-100 text-rose-600',
]

interface DemoRow {
  name: string
  email: string
  spent: number
  orders: number
  vip: boolean
  active: boolean
  registeredAt: string
}

const DEMO_ROWS: DemoRow[] = [
  { name: '张三', email: 'zhangsan@example.com', spent: 1296, orders: 12, vip: true, active: true, registeredAt: '2024/08/20' },
  { name: '李四', email: 'lisi@example.com', spent: 892, orders: 8, vip: false, active: true, registeredAt: '2024/08/18' },
  { name: '王五', email: 'wangwu@example.com', spent: 566, orders: 6, vip: false, active: false, registeredAt: '2024/08/15' },
  { name: '赵六', email: 'zhaoliu@example.com', spent: 1990, orders: 18, vip: true, active: true, registeredAt: '2024/08/12' },
  { name: '陈七', email: 'chenqi@example.com', spent: 398, orders: 4, vip: false, active: false, registeredAt: '2024/08/10' },
]

const VIP_THRESHOLD = 1000
const DORMANT_DAYS = 30

export default function CustomersPage() {
  const t = useT()
  const locale = useLocale()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { data: usersResponse, isLoading } = useUsers({
    page: currentPage,
    limit: pageSize,
    search: searchTerm,
  })
  const { data: userStats } = useUserStats()

  const users: User[] = usersResponse?.data || []
  const pagination = usersResponse?.pagination
  const usingDemoRows = !users.length && !isLoading
  const rows = users.length ? users : isLoading ? [] : (DEMO_ROWS as unknown as User[])

  const isActiveUser = (user: User): boolean => {
    if (!user.lastLoginAt) return false
    const last = new Date(user.lastLoginAt)
    if (Number.isNaN(last.getTime())) return false
    return Date.now() - last.getTime() <= DORMANT_DAYS * 86_400_000
  }

  const isVip = (user: User): boolean => (user.totalSpent ?? 0) >= VIP_THRESHOLD

  const visibleRows = rows.filter((user) => {
    const vip = usingDemoRows ? (user as unknown as DemoRow).vip : isVip(user)
    const active = usingDemoRows ? (user as unknown as DemoRow).active : isActiveUser(user)
    if (levelFilter !== 'all' && ((levelFilter === 'vip') !== vip)) return false
    if (statusFilter !== 'all' && ((statusFilter === 'active') !== active)) return false
    return true
  })


  const formatDate = (value: string | Date | undefined | null, fallback: string): string => {
    if (!usingDemoRows && value) {
      const date = typeof value === 'string' ? new Date(value) : value
      if (!Number.isNaN(date.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0')
        return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`
      }
    }
    return fallback
  }

  const exportCsv = () => {
    const header = ['Name', 'Email', 'Total Spent', 'Orders', 'Level', 'Status', 'Registered At']
    const lines = visibleRows.map((user, index) => {
      const demo = DEMO_ROWS[index % DEMO_ROWS.length]
      const vip = usingDemoRows ? demo.vip : isVip(user)
      const active = usingDemoRows ? demo.active : isActiveUser(user)
      return [
        `"${user.username || demo.name}"`,
        user.email || demo.email,
        String(user.totalSpent ?? demo.spent),
        String(user.totalOrders ?? demo.orders),
        vip ? 'VIP' : 'Standard',
        active ? 'Active' : 'Dormant',
        formatDate(user.createdAt, demo.registeredAt),
      ].join(',')
    })
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'customers.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PageShell>
      <div className="space-y-5">
        <PageHero
          title={getText('merchant.pages.customersTitle', '客户管理')}
          description={getText('merchant.pages.customersSubtitle', '管理你的客户信息，查看购买记录和客户行为。')}
          art="customers"
        />

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <MiniStatCard
            label={getText('merchant.pages.statAllCustomers', '全部客户')}
            value={(userStats?.metrics?.totalUsers ?? 89).toLocaleString()}
            change="24.6%"
            changeType="increase"
            icon={Users}
            tone="purple"
          />
          <MiniStatCard
            label={getText('merchant.pages.statNewCustomers', '新客户')}
            value={(userStats?.metrics?.newThisMonth ?? 12).toLocaleString()}
            change="8.3%"
            changeType="increase"
            icon={UserPlus}
            tone="green"
          />
          <MiniStatCard
            label={getText('merchant.pages.statActiveCustomers', '活跃客户')}
            value={(userStats?.metrics?.activeUsers ?? 56).toLocaleString()}
            change="18.2%"
            changeType="increase"
            icon={UserCheck}
            tone="blue"
          />
          <MiniStatCard
            label={getText('merchant.pages.statSleepingCustomers', '沉睡客户')}
            value={(userStats?.metrics?.inactiveUsers ?? 21).toLocaleString()}
            change="6.7%"
            changeType="decrease"
            icon={UserX}
            tone="red"
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-[300px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
                setCurrentPage(1)
              }}
              placeholder={getText('merchant.pages.searchCustomers', '搜索客户姓名、邮箱、手机号...')}
              className="h-9 w-full rounded-lg border border-[#eef1f6] bg-white pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-blue-300"
            />
          </div>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="h-9 w-[120px] rounded-lg border-[#eef1f6] bg-white text-sm text-slate-600 shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{getText('merchant.pages.allLevels', '全部等级')}</SelectItem>
              <SelectItem value="vip">{getText('merchant.pages.levelVip', 'VIP')}</SelectItem>
              <SelectItem value="normal">{getText('merchant.pages.levelNormal', '普通')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[120px] rounded-lg border-[#eef1f6] bg-white text-sm text-slate-600 shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{getText('merchant.pages.allStatuses', '全部状态')}</SelectItem>
              <SelectItem value="active">{getText('merchant.pages.stateActive', '活跃')}</SelectItem>
              <SelectItem value="dormant">{getText('merchant.pages.stateSleeping', '沉睡')}</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#eef1f6] bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              {getText('merchant.pages.export', '导出')}
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              {getText('merchant.pages.addCustomer', '添加客户')}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-[#eef1f6] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f4f6fa]">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-blue-600" aria-label="Select all" />
                  </th>
                  <SortableTh label={getText('merchant.pages.colCustomer', '客户')} />
                  <SortableTh label={getText('merchant.pages.colContact', '联系方式')} />
                  <SortableTh label={getText('merchant.pages.colTotalSpent', '累计消费')} />
                  <SortableTh label={getText('merchant.pages.colOrderCount', '订单数')} />
                  <SortableTh label={getText('merchant.pages.colLevel', '客户等级')} />
                  <SortableTh label={getText('merchant.pages.colStatus', '状态')} />
                  <SortableTh label={getText('merchant.pages.colRegisteredAt', '注册时间')} />
                  <th className="px-3 py-3 text-right text-xs font-medium text-slate-400">
                    {getText('merchant.pages.colActions', '操作')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f6fa]">
                {visibleRows.map((user, index) => {
                  const demo = DEMO_ROWS[index % DEMO_ROWS.length]
                  const name = user.username || demo.name
                  const email = user.email || demo.email
                  const spent = user.totalSpent ?? (usingDemoRows ? demo.spent : 0)
                  const orderCount = user.totalOrders ?? (usingDemoRows ? demo.orders : 0)
                  const vip = usingDemoRows ? demo.vip : isVip(user)
                  const active = usingDemoRows ? demo.active : isActiveUser(user)
                  const registered = formatDate(user.createdAt, demo.registeredAt)
                  const initial = name.charAt(0).toUpperCase()
                  return (
                    <tr key={user.id ?? name} className="transition-colors hover:bg-[#f8fafc]">
                      <td className="px-4 py-3">
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-blue-600" aria-label={`Select ${name}`} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                              AVATAR_TONES[index % AVATAR_TONES.length],
                            )}
                          >
                            {initial}
                          </span>
                          <p className="truncate text-sm font-medium text-slate-900">{name}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-500">{email}</td>
                      <td className="px-3 py-3 text-sm font-semibold text-slate-900">{formatCurrency(spent)}</td>
                      <td className="px-3 py-3 text-sm text-slate-600">{orderCount}</td>
                      <td className="px-3 py-3">
                        {vip ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-500">
                            <Crown className="h-3.5 w-3.5" />
                            {getText('merchant.pages.levelVip', 'VIP')}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">{getText('merchant.pages.levelNormal', '普通')}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            'text-sm font-medium',
                            active ? 'text-emerald-600' : 'text-slate-400',
                          )}
                        >
                          {active
                            ? getText('merchant.pages.stateActive', '活跃')
                            : getText('merchant.pages.stateSleeping', '沉睡')}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-400">{registered}</td>
                      <td className="px-3 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                              aria-label={getText('merchant.pages.colActions', '操作')}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36 rounded-lg">
                            <DropdownMenuItem
                              className="cursor-pointer text-sm"
                              onClick={() => window.location.assign(`/${locale}/customers/${user.id}`)}
                            >
                              <Eye className="mr-2 h-3.5 w-3.5" />
                              {getText('merchant.pages.viewDetail', '查看详情')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-sm text-slate-400">
                      {getText('common.noData', '暂无数据')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            total={usingDemoRows ? 89 : pagination?.total ?? users.length}
            page={usingDemoRows ? currentPage : pagination?.page ?? currentPage}
            pageSize={pageSize}
            totalPages={usingDemoRows ? 9 : Math.max(pagination?.totalPages ?? 1, 1)}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setCurrentPage(1)
            }}
            totalLabel={getText('merchant.pages.totalRecords', '共')}
            perPageLabel={getText('merchant.pages.perPage', '条/页')}
          />
        </div>
      </div>
    </PageShell>
  )
}
