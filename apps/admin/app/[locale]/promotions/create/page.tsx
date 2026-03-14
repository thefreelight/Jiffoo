'use client'

/**
 * Create Promotion Page - Immersive Industrial Power Design
 * Aligned with the high-impact product create page design language.
 */

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useCreatePromotion } from '@/lib/hooks/use-api'
import { useT } from 'shared/src/i18n/react'
import { PromotionForm } from '@/components/promotions/PromotionForm'
import type { PromotionForm as PromotionFormData } from '@/lib/api'

export default function CreatePromotionPage() {
  const router = useRouter()
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const createPromotionMutation = useCreatePromotion()

  const handleSubmit = async (data: PromotionFormData) => {
    try {
      // Clean up empty optional fields
      const cleanData: Partial<PromotionFormData> = {
        code: data.code,
        type: data.type,
        value: data.value,
        isActive: data.isActive ?? true,
        stackable: data.stackable ?? false,
      }

      if (data.description) cleanData.description = data.description
      if (data.minAmount) cleanData.minAmount = Number(data.minAmount)
      if (data.maxUses) cleanData.maxUses = Number(data.maxUses)
      if (data.startDate) cleanData.startDate = data.startDate
      if (data.endDate) cleanData.endDate = data.endDate
      if (data.productIds?.length) cleanData.productIds = data.productIds
      if (data.customerGroups?.length) cleanData.customerGroups = data.customerGroups

      await createPromotionMutation.mutateAsync(cleanData as PromotionFormData)
      router.push('/promotions')
    } catch (error) {
      // Error is already handled by the mutation's onError
    }
  }

  return (
    <div className="w-full bg-white min-h-screen">
      {/* Header Bar - Full Bleed */}
      <div className="border-b-2 border-gray-100 px-10 py-7 sticky top-0 bg-white/95 backdrop-blur-xl z-50 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="hover:bg-gray-100 rounded-full w-12 h-12">
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-gray-900 tracking-tighter leading-none">
              Initialize New Promotion
            </h1>
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mt-2">Discount Creation Interface</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => router.push('/promotions')} className="text-gray-400 border-gray-100 hover:bg-gray-50 font-black uppercase tracking-widest rounded-2xl h-12 px-8">
            Cancel
          </Button>
        </div>
      </div>

      <div className="flex flex-col">
        {/* Module 1: Promotion Form */}
        <div className="bg-white">
          <div className="px-10 py-20 space-y-20 w-full max-w-4xl">
            <div className="space-y-3">
              <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase">Promotion Core</h2>
              <div className="h-1.5 w-24 bg-blue-600 rounded-full" />
              <p className="text-gray-400 text-lg font-bold">ESTABLISH DISCOUNT PARAMETERS & CONSTRAINTS</p>
            </div>

            <PromotionForm
              onSubmit={handleSubmit as any}
              isLoading={createPromotionMutation.isPending}
              mode="create"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
