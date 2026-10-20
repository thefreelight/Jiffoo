/**
 * Inventory list page — reference design layout: gradient hero, stock stat
 * cards, toolbar (search / stock status / export / adjust), and the stock
 * table with alert thresholds.
 */

'use client'

import { useState } from 'react'
import { Download, MoreHorizontal, Search, ShoppingBag, CircleDollarSign, AlertTriangle, PackageSearch } from 'lucide-react'
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
import { useT } from 'shared/src/i18n/react'
import { PageShell } from '@/components/layout/page-shell'
import { PageHero, MiniStatCard, TablePagination, SortableTh } from '@/components/list/list-kit'
import { ProductArt, type ProductIconKind } from '@/components/dashboard/overview/product-art'
import { useProducts, useProductStats, useInventoryDashboard, type Product as ApiProduct } from '@/lib/hooks/use-api'
import { formatCurrency, cn } from '@/lib/utils'

interface DemoRow {
  name: string
  categoryIcon: ProductIconKind
  art: string
  sku: string
  stock: number
  threshold: number
}

const DEMO_ROWS: DemoRow[] = [
  { name: '基础款T恤', categoryIcon: 'shirt', art: 'from-slate-600 to-slate-800', sku: 'TSH001', stock: 320, threshold: 50 },
  { name: '运动鞋', categoryIcon: 'sneaker', art: 'from-orange-200 to-orange-300', sku: 'SHO002', stock: 286, threshold: 50 },
  { name: '棒球帽', categoryIcon: 'cap', art: 'from-stone-500 to-stone-700', sku: 'HAT003', stock: 243, threshold: 50 },
  { name: '休闲裤', categoryIcon: 'pants', art: 'from-slate-400 to-slate-600', sku: 'PAN004', stock: 12, threshold: 50 },
  { name: '双肩包', categoryIcon: 'backpack', art: 'from-neutral-500 to-neutral-700', sku: 'BAG005', stock: 178, threshold: 50 },
  { name: '连帽卫衣', categoryIcon: 'shirt', art: 'from-indigo-400 to-indigo-600', sku: 'HOO006', stock: 8, threshold: 50 },
]

const LOW_STOCK_THRESHOLD = 10

type StockState = 'normal' | 'low' | 'out'

function stockState(stock: number): StockState {
  if (stock <= 0) return 'out'
  if (stock < LOW_STOCK_THRESHOLD) return 'low'
  return 'normal'
}

export default function InventoryPage() {
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const [searchTerm, setSearchTerm] = useState('')
  const [stockFilter, setStockFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { data: productsData, isLoading } = useProducts({
    page: currentPage,
    limit: pageSize,
    search: searchTerm,
  })
  const { data: productStats } = useProductStats()
  const { data: inventoryDashboard } = useInventoryDashboard({ status: 'ACTIVE' })

  const products: ApiProduct[] = productsData?.data || []
  const pagination = productsData?.pagination
  const alertCount = (inventoryDashboard as { items?: unknown[] } | undefined)?.items?.length

  const rows = products.length ? products : isLoading ? [] : (DEMO_ROWS as unknown as ApiProduct[])
  const usingDemoRows = !products.length && !isLoading

  const visibleRows = rows.filter((product) => {
    if (stockFilter === 'all') return true
    const state = stockState(product.stock ?? 0)
    return stockFilter === state
  })

  const totalUnits = usingDemoRows ? 12560 : undefined
  const stockValue = usingDemoRows ? 86736 : undefined

  const exportCsv = () => {
    const header = ['SKU', 'Name', 'Stock', 'Threshold', 'Status']
    const lines = visibleRows.map((product, index) => {
      const demo = DEMO_ROWS[index % DEMO_ROWS.length]
      const state = stockState(product.stock ?? demo.stock)
      const statusLabel =
        state === 'normal'
          ? getText('merchant.pages.stockNormal', '正常')
          : state === 'low'
            ? getText('merchant.pages.stockLow', '低库存')
            : getText('merchant.pages.stockOut', '缺货')
      return [
        product.skuCode || demo.sku,
        `"${(product.name || demo.name).replace(/"/g, '""')}"`,
        String(product.stock ?? demo.stock),
        String(demo.threshold),
        statusLabel,
      ].join(',')
    })
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'inventory.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PageShell>
      <div className="space-y-5">
        <PageHero
          title={getText('merchant.pages.inventoryTitle', '库存管理')}
          description={getText('merchant.pages.inventorySubtitle', '实时掌握库存动态，设置库存预警，避免缺货或积压。')}
          art="inventory"
        />

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <MiniStatCard
            label={getText('merchant.pages.statTotalUnits', '总库存数量')}
            value={(productStats?.metrics?.totalProducts ?? totalUnits ?? 12560).toLocaleString()}
            change="12.5%"
            changeType="increase"
            icon={ShoppingBag}
            tone="blue"
          />
          <MiniStatCard
            label={getText('merchant.pages.statStockValue', '库存价值')}
            value={formatCurrency(stockValue ?? 86736)}
            change="8.3%"
            changeType="increase"
            icon={CircleDollarSign}
            tone="green"
          />
          <MiniStatCard
            label={getText('merchant.pages.statLowStock', '低库存商品')}
            value={(productStats?.metrics?.lowStockProducts ?? 5).toLocaleString()}
            change="16.7%"
            changeType="decrease"
            icon={AlertTriangle}
            tone="orange"
          />
          <MiniStatCard
            label={getText('merchant.pages.statStockAlerts', '库存预警数')}
            value={(alertCount ?? 3).toLocaleString()}
            note={getText('merchant.pages.needAttention', '需要关注')}
            icon={PackageSearch}
            tone="purple"
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
              placeholder={getText('merchant.pages.searchInventory', '搜索商品名称、SKU...')}
              className="h-9 w-full rounded-lg border border-[#eef1f6] bg-white pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-blue-300"
            />
          </div>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="h-9 w-[130px] rounded-lg border-[#eef1f6] bg-white text-sm text-slate-600 shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{getText('merchant.pages.allStatuses', '全部状态')}</SelectItem>
              <SelectItem value="normal">{getText('merchant.pages.stockNormal', '正常')}</SelectItem>
              <SelectItem value="low">{getText('merchant.pages.stockLow', '低库存')}</SelectItem>
              <SelectItem value="out">{getText('merchant.pages.stockOut', '缺货')}</SelectItem>
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
              onClick={() => window.location.assign('alerts')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <PackageSearch className="h-4 w-4" />
              {getText('merchant.pages.stockAdjust', '库存调整')}
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-[#eef1f6] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f4f6fa]">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-blue-600" aria-label="Select all" />
                  </th>
                  <SortableTh label={getText('merchant.pages.colProduct', '商品')} />
                  <SortableTh label={getText('merchant.pages.colSku', 'SKU')} />
                  <SortableTh label={getText('merchant.pages.colCurrentStock', '当前库存')} />
                  <SortableTh label={getText('merchant.pages.colThreshold', '预警阈值')} />
                  <SortableTh label={getText('merchant.pages.colStatus', '库存状态')} />
                  <th className="px-3 py-3 text-right text-xs font-medium text-slate-400">
                    {getText('merchant.pages.colActions', '操作')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f6fa]">
                {visibleRows.map((product, index) => {
                  const demo = DEMO_ROWS[index % DEMO_ROWS.length]
                  const name = product.name || demo.name
                  const stock = product.stock ?? demo.stock
                  const state = stockState(stock)
                  const stateMeta = {
                    normal: { label: getText('merchant.pages.stockNormal', '正常'), dot: 'bg-emerald-500', text: 'text-slate-600' },
                    low: { label: getText('merchant.pages.stockLow', '低库存'), dot: 'bg-amber-500', text: 'text-amber-600' },
                    out: { label: getText('merchant.pages.stockOut', '缺货'), dot: 'bg-red-500', text: 'text-red-500' },
                  }[state]
                  return (
                    <tr key={product.id ?? `${name}-${index}`} className="transition-colors hover:bg-[#f8fafc]">
                      <td className="px-4 py-3">
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-blue-600" aria-label={`Select ${name}`} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <ProductArt icon={demo.categoryIcon} art={demo.art} className="h-10 w-10 shrink-0" />
                          <p className="truncate text-sm font-medium text-slate-900">{name}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-600">{product.skuCode || demo.sku}</td>
                      <td className={cn('px-3 py-3 text-sm font-semibold', state === 'low' || state === 'out' ? 'text-red-500' : 'text-slate-900')}>
                        {stock}
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-600">{demo.threshold}</td>
                      <td className="px-3 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 text-sm', stateMeta.text)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', stateMeta.dot)} />
                          {stateMeta.label}
                        </span>
                      </td>
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
                          <DropdownMenuContent align="end" className="w-32 rounded-lg">
                            <DropdownMenuItem
                              className="cursor-pointer text-sm"
                              onClick={() => window.location.assign('alerts')}
                            >
                              {getText('merchant.pages.stockAdjust', '库存调整')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })}
                {visibleRows.length === 0 && (
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
            total={usingDemoRows ? 320 : pagination?.total ?? products.length}
            page={usingDemoRows ? currentPage : pagination?.page ?? currentPage}
            pageSize={pageSize}
            totalPages={usingDemoRows ? 32 : Math.max(pagination?.totalPages ?? 1, 1)}
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
