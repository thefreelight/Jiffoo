/**
 * Products list page — reference design layout:
 * gradient hero, four compact stat cards, toolbar (search / category /
 * status / add), product table, and pagination.
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  PackageCheck,
  PackageX,
  AlertTriangle,
  Trash2,
} from 'lucide-react'
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
import { useProducts, useDeleteProduct, useProductStats, type Product as ApiProduct } from '@/lib/hooks/use-api'
import { formatCurrency, cn } from '@/lib/utils'

interface DemoRow {
  name: string
  category: string
  categoryIcon: ProductIconKind
  art: string
  sku: string
  price: number
  stock: number
  active: boolean
}

const DEMO_ROWS: DemoRow[] = [
  { name: '基础款T恤', category: '上衣 · 短袖', categoryIcon: 'shirt', art: 'from-slate-600 to-slate-800', sku: 'TSH001', price: 128, stock: 320, active: true },
  { name: '运动鞋', category: '鞋履 · 运动鞋', categoryIcon: 'sneaker', art: 'from-orange-200 to-orange-300', sku: 'SHO002', price: 89, stock: 286, active: true },
  { name: '棒球帽', category: '配饰 · 帽子', categoryIcon: 'cap', art: 'from-stone-500 to-stone-700', sku: 'HAT003', price: 59, stock: 243, active: true },
  { name: '休闲裤', category: '裤装 · 休闲', categoryIcon: 'pants', art: 'from-slate-400 to-slate-600', sku: 'PAN004', price: 199, stock: 190, active: false },
  { name: '双肩包', category: '箱包 · 背包', categoryIcon: 'backpack', art: 'from-neutral-500 to-neutral-700', sku: 'BAG005', price: 39, stock: 178, active: true },
]

export default function ProductsPage() {
  const t = useT()
  const locale = useLocale()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { data: productsData, isLoading, refetch } = useProducts({
    page: currentPage,
    limit: pageSize,
    search: searchTerm,
  })
  const { data: productStats } = useProductStats()
  const deleteProductMutation = useDeleteProduct()

  const products: ApiProduct[] = productsData?.data || []
  const pagination = productsData?.pagination

  const rows = products.length
    ? products
    : isLoading
      ? []
      : (DEMO_ROWS as unknown as ApiProduct[])
  const usingDemoRows = !products.length && !isLoading

  const categories = Array.from(
    new Set(products.map((product) => product.categoryName).filter(Boolean) as string[]),
  )

  const visibleRows = rows.filter((product) => {
    const categoryName = (product.categoryName as string | undefined) || ''
    const matchesCategory = selectedCategory === 'all' || categoryName === selectedCategory
    const matchesStatus =
      selectedStatus === 'all' || (selectedStatus === 'on' ? product.isActive !== false : product.isActive === false)
    return matchesCategory && matchesStatus
  })

  const total = usingDemoRows ? 320 : pagination?.total ?? products.length
  const totalPages = usingDemoRows ? 32 : Math.max(pagination?.totalPages ?? 1, 1)

  const stats = {
    total: productStats?.metrics?.totalProducts,
    active: productStats?.metrics?.activeProducts,
    offShelf: productStats?.metrics?.outOfStockProducts,
    lowStock: productStats?.metrics?.lowStockProducts,
  }

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm(getText('merchant.products.deleteConfirm', '确定要删除此商品吗？'))) {
      try {
        await deleteProductMutation.mutateAsync(id)
        await refetch()
      } catch (error) {
        console.error('Failed to delete product:', error)
      }
    }
  }

  const getProductImage = (product: ApiProduct) => {
    const firstImage = Array.isArray(product.images) ? (product.images[0] as string | { url?: string } | null) : null
    if (typeof firstImage === 'string' && firstImage.trim()) return firstImage
    if (firstImage && typeof firstImage === 'object' && 'url' in firstImage && typeof firstImage.url === 'string') {
      return firstImage.url
    }
    return null
  }

  const demoArt = (index: number) => DEMO_ROWS[index % DEMO_ROWS.length]

  return (
    <PageShell>
      <div className="space-y-5">
        <PageHero
          title={getText('merchant.pages.productsTitle', '商品管理')}
          description={getText('merchant.pages.productsSubtitle', '管理你的商品信息，支持多规格、库存、分类和上下架操作。')}
          art="products"
        />

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <MiniStatCard
            label={getText('merchant.pages.statAllProducts', '全部商品')}
            value={(stats.total ?? 320).toLocaleString()}
            change="4.2%"
            changeType="increase"
            icon={ShoppingBag}
            tone="blue"
          />
          <MiniStatCard
            label={getText('merchant.pages.statOnSale', '在售商品')}
            value={(stats.active ?? 286).toLocaleString()}
            change="4.3%"
            changeType="increase"
            icon={PackageCheck}
            tone="green"
          />
          <MiniStatCard
            label={getText('merchant.pages.statOffShelf', '下架商品')}
            value={(stats.offShelf ?? 24).toLocaleString()}
            change="6.1%"
            changeType="decrease"
            icon={PackageX}
            tone="red"
          />
          <MiniStatCard
            label={getText('merchant.pages.statLowStock', '低库存商品')}
            value={(stats.lowStock ?? 5).toLocaleString()}
            change="16.7%"
            changeType="decrease"
            icon={AlertTriangle}
            tone="orange"
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
              placeholder={getText('merchant.pages.searchProducts', '搜索商品名称、SKU、分类...')}
              className="h-9 w-full rounded-lg border border-[#eef1f6] bg-white pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-blue-300"
            />
          </div>
          <Select value={selectedCategory} onValueChange={(value) => { setSelectedCategory(value); setCurrentPage(1) }}>
            <SelectTrigger className="h-9 w-[130px] rounded-lg border-[#eef1f6] bg-white text-sm text-slate-600 shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{getText('merchant.pages.allCategories', '全部分类')}</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="h-9 w-[120px] rounded-lg border-[#eef1f6] bg-white text-sm text-slate-600 shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{getText('merchant.pages.allStatuses', '全部状态')}</SelectItem>
              <SelectItem value="on">{getText('merchant.pages.statusOnSale', '在售')}</SelectItem>
              <SelectItem value="off">{getText('merchant.pages.statusOffShelf', '下架')}</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <Link
              href={`/${locale}/products/create`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              {getText('merchant.pages.addProduct', '添加商品')}
            </Link>
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
                  <SortableTh label={getText('merchant.pages.colPrice', '价格')} />
                  <SortableTh label={getText('merchant.pages.colStock', '库存')} />
                  <SortableTh label={getText('merchant.pages.colStatus', '状态')} />
                  <th className="px-3 py-3 text-right text-xs font-medium text-slate-400">
                    {getText('merchant.pages.colActions', '操作')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f6fa]">
                {visibleRows.map((product, index) => {
                  const demo = demoArt(index)
                  const imageUrl = getProductImage(product)
                  const name = product.name || demo.name
                  const category = product.categoryName || demo.category
                  const stock = product.stock ?? demo.stock ?? 0
                  const active = usingDemoRows ? demo.active : product.isActive !== false
                  return (
                    <tr key={product.id ?? `${name}-${index}`} className="group transition-colors hover:bg-[#f8fafc]">
                      <td className="px-4 py-3">
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-blue-600" aria-label={`Select ${name}`} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          {imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imageUrl} alt={name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                          ) : (
                            <ProductArt
                              icon={demo.categoryIcon}
                              art={demo.art}
                              className="h-10 w-10 shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{name}</p>
                            <p className="truncate text-xs text-slate-400">{category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-600">{product.skuCode || demo.sku}</td>
                      <td className="px-3 py-3 text-sm font-medium text-slate-900">
                        {formatCurrency(product.price ?? demo.price ?? 0)}
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-600">{stock}</td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium',
                            active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {active
                            ? getText('merchant.pages.statusOnSale', '在售')
                            : getText('merchant.pages.statusOffShelf', '下架')}
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
                            {!usingDemoRows && (
                              <DropdownMenuItem
                                className="cursor-pointer text-sm"
                                onClick={() => window.location.assign(`/${locale}/products/${product.id}/edit`)}
                              >
                                <Pencil className="mr-2 h-3.5 w-3.5" />
                                {getText('merchant.pages.edit', '编辑')}
                              </DropdownMenuItem>
                            )}
                            {!usingDemoRows && (
                              <DropdownMenuItem
                                className="cursor-pointer text-sm text-red-500 focus:text-red-600"
                                onClick={() => handleDeleteProduct(String(product.id))}
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                {getText('merchant.pages.delete', '删除')}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                      {getText('merchant.products.noProducts', '暂无商品')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePagination
            total={total}
            page={usingDemoRows ? currentPage : pagination?.page ?? currentPage}
            pageSize={pageSize}
            totalPages={totalPages}
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
