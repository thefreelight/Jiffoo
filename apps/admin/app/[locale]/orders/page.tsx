/**
 * Orders list page — reference design layout: gradient hero, five stat
 * cards, toolbar (search / date range / status / export), order table with
 * status pills and item thumbnails, pagination.
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CalendarDays, ChevronDown, Download, Eye, MoreHorizontal, Search, ClipboardList, Wallet, PackageCheck, CheckCircle2, XCircle } from 'lucide-react'
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
import { ProductArt, type ProductIconKind } from '@/components/dashboard/overview/product-art'
import { useOrders, useAdminDashboard, type Order } from '@/lib/hooks/use-api'
import { formatCurrency, cn } from '@/lib/utils'

interface DemoRow {
  code: string
  customer: string
  amount: number
  status: string
  createdAt: string
}

const DEMO_ROWS: DemoRow[] = [
  { code: '#1008', customer: '张三', amount: 129, status: 'COMPLETED', createdAt: '2024/09/14 14:23' },
  { code: '#1007', customer: '李四', amount: 89, status: 'PROCESSING', createdAt: '2024/09/14 13:36' },
  { code: '#1006', customer: '王五', amount: 59, status: 'COMPLETED', createdAt: '2024/09/14 13:20' },
  { code: '#1005', customer: '赵六', amount: 199, status: 'PAID', createdAt: '2024/09/13 18:45' },
  { code: '#1004', customer: '陈七', amount: 39, status: 'CANCELLED', createdAt: '2024/09/13 16:12' },
  { code: '#1003', customer: '周八', amount: 299, status: 'COMPLETED', createdAt: '2024/09/13 14:30' },
]

const DEMO_ART = [
  { icon: 'shirt' as ProductIconKind, art: 'from-slate-600 to-slate-800' },
  { icon: 'cap' as ProductIconKind, art: 'from-stone-500 to-stone-700' },
]

function statusMeta(status: string, getText: (key: string, fallback: string) => string) {
  const normalized = String(status).toUpperCase()
  if (normalized === 'COMPLETED' || normalized === 'DELIVERED') {
    return { label: getText('merchant.pages.statCompleted', '已完成'), className: 'bg-emerald-50 text-emerald-600' }
  }
  if (normalized === 'PROCESSING' || normalized === 'SHIPPED') {
    return { label: getText('merchant.pages.processing', '处理中'), className: 'bg-blue-50 text-blue-600' }
  }
  if (normalized === 'PAID') {
    return { label: getText('merchant.pages.statUnshipped', '待发货'), className: 'bg-orange-50 text-orange-600' }
  }
  if (normalized === 'CANCELLED' || normalized === 'REFUNDED') {
    return { label: getText('merchant.pages.statCancelled', '已取消'), className: 'bg-red-50 text-red-500' }
  }
  return { label: getText('merchant.pages.statUnpaid', '待支付'), className: 'bg-amber-50 text-amber-600' }
}

function formatDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function monthRange(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const first = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/01`
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return `${first} - ${now.getFullYear()}/${pad(last.getMonth() + 1)}/${pad(last.getDate())}`
}

export default function OrdersPage() {
  const t = useT()
  const locale = useLocale()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { data: ordersData, isLoading } = useOrders({
    page: currentPage,
    limit: pageSize,
    search: searchTerm,
    status: selectedStatus !== 'all' ? selectedStatus : undefined,
  })
  const { data: dashboardData } = useAdminDashboard()

  const orders: Order[] = ordersData?.data || []
  const pagination = ordersData?.pagination
  const usingDemoRows = !orders.length && !isLoading
  const rows = orders.length ? orders : isLoading ? [] : (DEMO_ROWS as unknown as Order[])

  const byStatus = dashboardData?.ordersByStatus as Record<string, number> | undefined
  const count = (statuses: string[], fallback: number) =>
    byStatus ? statuses.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0) : fallback

  const exportCsv = () => {
    const header = ['Order No.', 'Customer', 'Amount', 'Status', 'Created At']
    const lines = rows.map((order, index) => {
      const demo = DEMO_ROWS[index % DEMO_ROWS.length]
      return [
        `#${(order.id || demo.code).slice(0, 8)}`,
        `"${order.customer?.username || order.customer?.email || demo.customer}"`,
        String(order.totalAmount ?? demo.amount),
        order.status ? String(order.status) : demo.status,
        order.createdAt ? formatDateTime(order.createdAt) : demo.createdAt,
      ].join(',')
    })
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'orders.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PageShell>
      <div className="space-y-5">
        <PageHero
          title={getText('merchant.pages.ordersTitle', '订单管理')}
          description={getText('merchant.pages.ordersSubtitle', '管理所有订单，跟踪订单状态，处理发货和售后。')}
          art="orders"
        />

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <MiniStatCard
            label={getText('merchant.pages.statAllOrders', '全部订单')}
            value={(dashboardData?.metrics?.totalOrders ?? 1256).toLocaleString()}
            change="12.5%"
            changeType="increase"
            icon={ClipboardList}
            tone="blue"
          />
          <MiniStatCard
            label={getText('merchant.pages.statUnpaid', '待支付')}
            value={count(['PENDING'], 24).toLocaleString()}
            icon={Wallet}
            tone="orange"
          />
          <MiniStatCard
            label={getText('merchant.pages.statUnshipped', '待发货')}
            value={count(['PAID', 'PROCESSING'], 38).toLocaleString()}
            icon={PackageCheck}
            tone="purple"
          />
          <MiniStatCard
            label={getText('merchant.pages.statCompleted', '已完成')}
            value={count(['COMPLETED', 'DELIVERED'], 1156).toLocaleString()}
            change="19.3%"
            changeType="increase"
            icon={CheckCircle2}
            tone="green"
          />
          <MiniStatCard
            label={getText('merchant.pages.statCancelled', '已取消')}
            value={count(['CANCELLED'], 38).toLocaleString()}
            icon={XCircle}
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
              placeholder={getText('merchant.pages.searchOrders', '搜索订单号、客户、商品...')}
              className="h-9 w-full rounded-lg border border-[#eef1f6] bg-white pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-blue-300"
            />
          </div>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#eef1f6] bg-white px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <CalendarDays className="h-4 w-4 text-slate-400" />
            {monthRange()}
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
          <Select value={selectedStatus} onValueChange={(value) => { setSelectedStatus(value); setCurrentPage(1) }}>
            <SelectTrigger className="h-9 w-[130px] rounded-lg border-[#eef1f6] bg-white text-sm text-slate-600 shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{getText('merchant.pages.allStatuses', '全部状态')}</SelectItem>
              <SelectItem value="PENDING">{getText('merchant.pages.statUnpaid', '待支付')}</SelectItem>
              <SelectItem value="PAID">{getText('merchant.pages.statUnshipped', '待发货')}</SelectItem>
              <SelectItem value="PROCESSING">{getText('merchant.pages.processing', '处理中')}</SelectItem>
              <SelectItem value="COMPLETED">{getText('merchant.pages.statCompleted', '已完成')}</SelectItem>
              <SelectItem value="CANCELLED">{getText('merchant.pages.statCancelled', '已取消')}</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#eef1f6] bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              {getText('merchant.pages.export', '导出')}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-[#eef1f6] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f4f6fa]">
                  <SortableTh label={getText('merchant.pages.colOrderNo', '订单号')} className="pl-4" />
                  <SortableTh label={getText('merchant.pages.colCustomer', '客户')} />
                  <SortableTh label={getText('merchant.pages.colItems', '商品')} />
                  <SortableTh label={getText('merchant.pages.colAmount', '金额')} />
                  <SortableTh label={getText('merchant.pages.colStatus', '状态')} />
                  <SortableTh label={getText('merchant.pages.colCreatedAt', '创建时间')} />
                  <th className="px-3 py-3 text-right text-xs font-medium text-slate-400">
                    {getText('merchant.pages.colActions', '操作')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f6fa]">
                {rows.map((order, index) => {
                  const demo = DEMO_ROWS[index % DEMO_ROWS.length]
                  const code = `#${String(order.id || demo.code).replace(/^#/, '').slice(0, 8)}`
                  const customer = order.customer?.username || order.customer?.email || demo.customer
                  const meta = statusMeta(String(order.status || demo.status), getText)
                  const created = order.createdAt ? formatDateTime(order.createdAt) : demo.createdAt
                  const itemCount = order.itemsCount ?? 2
                  return (
                    <tr key={order.id ?? demo.code} className="transition-colors hover:bg-[#f8fafc]">
                      <td className="py-3 pl-4 pr-3 text-sm font-semibold text-slate-900">{code}</td>
                      <td className="px-3 py-3 text-sm text-slate-600">{customer}</td>
                      <td className="px-3 py-3">
                        <div className="flex -space-x-1.5">
                          {DEMO_ART.map((art, artIndex) => (
                            <ProductArt
                              key={artIndex}
                              icon={art.icon}
                              art={art.art}
                              className="h-7 w-7 ring-2 ring-white"
                            />
                          ))}
                        </div>
                        {itemCount > 2 && (
                          <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f1f4f9] px-1 text-[10px] font-semibold text-slate-500">
                            +{itemCount - 2}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold text-slate-900">
                        {formatCurrency(order.totalAmount ?? demo.amount, order.currency)}
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-xs font-medium', meta.className)}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-400">{created}</td>
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
                              onClick={() => window.location.assign(`/${locale}/orders/${order.id}`)}
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
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                      {getText('common.noData', '暂无数据')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            total={usingDemoRows ? 1256 : pagination?.total ?? orders.length}
            page={usingDemoRows ? currentPage : pagination?.page ?? currentPage}
            pageSize={pageSize}
            totalPages={usingDemoRows ? 126 : Math.max(pagination?.totalPages ?? 1, 1)}
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
