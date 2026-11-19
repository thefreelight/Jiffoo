/**
 * Redemption Codes management — native coupon plugin.
 *
 * Lists product/subscription redemption codes with claim state, and creates
 * new codes (auto-generated code when left blank). Codes are redeemed by
 * shoppers from the storefront profile page; a product grant settles as a
 * comped PAID order and fulfills through the standard pipeline (BOSS for
 * eSIM SKUs).
 */

'use client'

import { Gift, Loader2, Plus, RefreshCw, Ticket } from 'lucide-react'
import { useState } from 'react'
import { useT, useLocale } from 'shared/src/i18n/react'
import { PageShell } from '@/components/layout/page-shell'
import { PageNav } from '@/components/layout/page-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRedemptionCodes } from '@/lib/hooks/use-api'
import { redemptionsApi, type RedemptionCodeDTO } from '@/lib/api'
import { toast } from 'sonner'

type Trilingual = { en: string; hans: string; hant: string }

function useTrilingual() {
  const locale = useLocale()
  const pick = (copy: Trilingual): string =>
    locale === 'zh-Hans' ? copy.hans : locale === 'zh-Hant' ? copy.hant : copy.en
  return { pick, locale }
}

const CLAIM_LABELS: Record<string, Trilingual> = {
  unclaimed: { en: 'Available', hans: '可领取', hant: '可領取' },
  claimed: { en: 'Claimed', hans: '已领取', hant: '已領取' },
}

export default function RedemptionCodesPage() {
  const t = useT()
  const { pick, locale } = useTrilingual()
  const getText = (key: string, fallback: string): string => (t ? t(key) : fallback)

  const codes = useRedemptionCodes()
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formCode, setFormCode] = useState('')
  const [formProductId, setFormProductId] = useState('')
  const [formVariantId, setFormVariantId] = useState('')
  const [formQuantity, setFormQuantity] = useState('1')
  const [formExpiresAt, setFormExpiresAt] = useState('')

  const items: RedemptionCodeDTO[] = codes.data ?? []
  const claimedCount = items.filter((item) => item.claimedByUserId).length

  const copy = {
    title: { en: 'Redemption Codes', hans: '兑换码', hant: '兌換碼' },
    subtitle: {
      en: 'Create codes shoppers can redeem for eSIM plans or subscriptions; redemption settles a comped order and fulfills automatically.',
      hans: '创建供用户兑换 eSIM 套餐或订阅的兑换码；兑换会以 0 元订单结算并自动发货。',
      hant: '建立供用戶兌換 eSIM 套餐或訂閱的兌換碼；兌換會以 0 元訂單結算並自動發貨。',
    } as Trilingual,
    total: { en: 'Total Codes', hans: '码总数', hant: '碼總數' },
    claimed: { en: 'Claimed', hans: '已领取', hant: '已領取' },
    available: { en: 'Available', hans: '可领取', hant: '可領取' },
    create: { en: 'Create Code', hans: '新建兑换码', hant: '新建兌換碼' },
    codeLabel: { en: 'Code (blank = auto-generate)', hans: '码（留空自动生成）', hant: '碼（留空自動生成）' },
    productLabel: { en: 'Product ID *', hans: '商品 ID *', hant: '商品 ID *' },
    variantLabel: { en: 'Variant ID (optional)', hans: '变体 ID（可选）', hant: '變體 ID（可選）' },
    quantityLabel: { en: 'Quantity', hans: '数量', hant: '數量' },
    expiresLabel: { en: 'Expires at (optional)', hans: '过期时间（可选）', hant: '過期時間（可選）' },
    submit: { en: 'Create', hans: '创建', hant: '建立' },
    cancel: { en: 'Cancel', hans: '取消', hant: '取消' },
    codeHeader: { en: 'Code', hans: '码', hant: '碼' },
    productHeader: { en: 'Product', hans: '商品', hant: '商品' },
    quantityHeader: { en: 'Qty', hans: '数量', hant: '數量' },
    statusHeader: { en: 'Status', hans: '状态', hant: '狀態' },
    claimedHeader: { en: 'Claimed By', hans: '领取人', hant: '領取人' },
    orderHeader: { en: 'Order', hans: '订单', hant: '訂單' },
    expiresHeader: { en: 'Expires', hans: '过期', hant: '過期' },
    empty: {
      en: 'No redemption codes yet. Create one to hand out to shoppers.',
      hans: '还没有兑换码。创建一个发给用户吧。',
      hant: '還沒有兌換碼。建立一個發給用戶吧。',
    } as Trilingual,
    createSuccess: { en: 'Code created', hans: '兑换码已创建', hant: '兌換碼已建立' } as Trilingual,
    createFailed: { en: 'Create failed', hans: '创建失败', hant: '建立失敗' } as Trilingual,
  }

  const statusOf = (item: RedemptionCodeDTO): string => {
    const expired = item.expiresAt && new Date(item.expiresAt) < new Date()
    if (item.claimedByUserId) return pick(CLAIM_LABELS.claimed)
    if (expired || !item.active) return pick({ en: 'Expired', hans: '已过期', hant: '已過期' })
    return pick(CLAIM_LABELS.unclaimed)
  }

  const statusStyle = (item: RedemptionCodeDTO): string => {
    if (item.claimedByUserId) return 'bg-gray-100 text-gray-700'
    if (item.expiresAt && new Date(item.expiresAt) < new Date()) return 'bg-red-100 text-red-700'
    return item.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
  }

  const handleCreate = async () => {
    if (!formProductId.trim() || busy) return
    setBusy(true)
    try {
      await redemptionsApi.create({
        ...(formCode.trim() ? { code: formCode.trim().toUpperCase() } : {}),
        productId: formProductId.trim(),
        ...(formVariantId.trim() ? { variantId: formVariantId.trim() } : {}),
        ...(formQuantity.trim() && Number(formQuantity) > 0 ? { quantity: Number(formQuantity) } : {}),
        ...(formExpiresAt.trim() ? { expiresAt: new Date(formExpiresAt).toISOString() } : {}),
      })
      toast.success(pick(copy.createSuccess))
      setFormCode('')
      setFormProductId('')
      setFormVariantId('')
      setFormQuantity('1')
      setFormExpiresAt('')
      setShowForm(false)
      await codes.refetch()
    } catch (error) {
      toast.error(`${pick(copy.createFailed)}: ${error instanceof Error ? error.message : 'unknown error'}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell>
      <PageNav
        items={[
          { label: getText('merchant.promotions.allPromotions', 'All Promotions'), href: '/promotions', exact: true },
          { label: getText('merchant.promotions.addPromotion', 'Add Promotion'), href: '/promotions/create' },
          { label: pick(copy.title), href: '/promotions/redemptions', exact: true },
        ]}
      />

      <section className="px-4 py-6 lg:px-8">
        {/* Summary + actions */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{pick(copy.total)}</span>
              <Ticket className="h-5 w-5 text-blue-600" />
            </div>
            <p className="mt-2 text-3xl font-bold">{items.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{pick(copy.claimed)}</span>
              <Gift className="h-5 w-5 text-purple-600" />
            </div>
            <p className="mt-2 text-3xl font-bold text-purple-700">{claimedCount}</p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{pick(copy.available)}</span>
              <RefreshCw
                className="h-5 w-5 cursor-pointer text-green-600 hover:text-green-700"
                onClick={() => void codes.refetch()}
              />
            </div>
            <p className="mt-2 text-3xl font-bold text-green-700">{items.length - claimedCount}</p>
          </div>
        </div>

        {/* Create form */}
        <div className="mb-6">
          {!showForm ? (
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {pick(copy.create)}
            </Button>
          ) : (
            <div className="rounded-lg border bg-card p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">{pick(copy.codeLabel)}</span>
                  <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="ESIM-JP-7D" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">{pick(copy.productLabel)}</span>
                  <Input value={formProductId} onChange={(e) => setFormProductId(e.target.value)} placeholder="boss-HKMO-1GB-7D" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">{pick(copy.variantLabel)}</span>
                  <Input value={formVariantId} onChange={(e) => setFormVariantId(e.target.value)} placeholder="boss-HKMO-1GB-7D-v1" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">{pick(copy.quantityLabel)}</span>
                  <Input type="number" min={1} max={999} value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">{pick(copy.expiresLabel)}</span>
                  <Input type="datetime-local" value={formExpiresAt} onChange={(e) => setFormExpiresAt(e.target.value)} />
                </label>
              </div>
              <div className="mt-4 flex gap-3">
                <Button onClick={() => void handleCreate()} disabled={busy || !formProductId.trim()} className="gap-2">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {pick(copy.submit)}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  {pick(copy.cancel)}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card">
          {codes.isLoading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {getText('common.loading', 'Loading…')}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center text-muted-foreground">
              <Ticket className="h-10 w-10 opacity-40" />
              <p>{pick(copy.empty)}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">{pick(copy.codeHeader)}</th>
                    <th className="px-4 py-3 font-medium">{pick(copy.productHeader)}</th>
                    <th className="px-4 py-3 font-medium">{pick(copy.quantityHeader)}</th>
                    <th className="px-4 py-3 font-medium">{pick(copy.statusHeader)}</th>
                    <th className="px-4 py-3 font-medium">{pick(copy.claimedHeader)}</th>
                    <th className="px-4 py-3 font-medium">{pick(copy.orderHeader)}</th>
                    <th className="px-4 py-3 font-medium">{pick(copy.expiresHeader)}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b last:border-b-0 hover:bg-muted/40">
                      <td className="px-4 py-3 font-mono font-semibold">{item.code}</td>
                      <td className="px-4 py-3 font-mono text-xs">{item.productId}</td>
                      <td className="px-4 py-3">×{item.quantity}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle(item)}`}>
                          {statusOf(item)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {item.claimedByUserId ? (
                          <span title={item.claimedAt ?? ''}>{item.claimedByUserId}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{item.orderId ?? '—'}</td>
                      <td className="px-4 py-3 text-xs">
                        {item.expiresAt ? new Date(item.expiresAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </PageShell>
  )
}
