'use client'

/**
 * Edit Promotion Page - Immersive Industrial Power Design
 * Aligned with the high-impact product create page design language.
 */

import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { usePromotion, useUpdatePromotion, useDeletePromotion } from '@/lib/hooks/use-api'
import { useT } from 'shared/src/i18n/react'
import { PromotionForm } from '@/components/promotions/PromotionForm'
import type { PromotionForm as PromotionFormData } from '@/lib/api'
import { toast } from 'sonner'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function EditPromotionPage() {
  const router = useRouter()
  const params = useParams()
  const t = useT()
  const id = params.id as string

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const { data: promotion, isLoading, error } = usePromotion(id)
  const updatePromotionMutation = useUpdatePromotion()
  const deletePromotionMutation = useDeletePromotion()

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

      await updatePromotionMutation.mutateAsync({ id, data: cleanData })
      router.push('/promotions')
    } catch (error) {
      // Error is already handled by the mutation's onError
    }
  }

  const handleDelete = async () => {
    try {
      await deletePromotionMutation.mutateAsync(id)
      router.push('/promotions')
    } catch (error) {
      // Error is already handled by the mutation's onError
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <p className="text-red-600 font-semibold">{getText('merchant.promotions.edit.failedToLoadPromotion', 'Failed to load promotion')}</p>
        <Button onClick={() => router.push('/promotions')}>
          {getText('merchant.promotions.edit.backToPromotions', 'Back to Promotions')}
        </Button>
      </div>
    )
  }

  if (!promotion) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <p className="text-gray-600 font-semibold">{getText('merchant.promotions.edit.promotionNotFound', 'Promotion not found')}</p>
        <Button onClick={() => router.push('/promotions')}>
          {getText('merchant.promotions.edit.backToPromotions', 'Back to Promotions')}
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full bg-white min-h-screen">
      {/* Header Bar - Full Bleed */}
      <div className="sticky top-0 z-50 flex items-center justify-between border-b-2 border-gray-100 bg-white/95 px-4 py-4 backdrop-blur-xl sm:px-10 sm:py-7">
        <div className="flex items-center space-x-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="hover:bg-gray-100 rounded-full w-12 h-12">
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-gray-900 tracking-tighter leading-none">
              {getText('merchant.promotions.edit.modifyPromotion', 'Modify Promotion:')} {promotion.code}
            </h1>
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mt-2">{getText('merchant.promotions.edit.discountEditInterface', 'Discount Edit Interface')}</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => setShowDeleteDialog(true)}
            disabled={deletePromotionMutation.isPending}
            className="text-red-600 border-red-200 hover:bg-red-50 font-black uppercase tracking-widest rounded-2xl h-12 px-8"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {getText('merchant.promotions.edit.delete', 'Delete')}
          </Button>
          <Button variant="outline" onClick={() => router.push('/promotions')} className="text-gray-400 border-gray-100 hover:bg-gray-50 font-black uppercase tracking-widest rounded-2xl h-12 px-8">
            {getText('merchant.promotions.edit.cancel', 'Cancel')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col">
        {/* Module 1: Promotion Form */}
        <div className="bg-white">
          <div className="w-full max-w-4xl space-y-12 px-4 py-10 sm:space-y-20 sm:px-10 sm:py-20">
            <div className="space-y-3">
              <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase">{getText('merchant.promotions.edit.promotionCore', 'Promotion Core')}</h2>
              <div className="h-1.5 w-24 bg-blue-600 rounded-full" />
              <p className="text-gray-400 text-lg font-bold">{getText('merchant.promotions.edit.updateDiscountParametersConstraints', 'UPDATE DISCOUNT PARAMETERS & CONSTRAINTS')}</p>
            </div>

            <PromotionForm
              initialData={promotion}
              onSubmit={handleSubmit as any}
              isLoading={updatePromotionMutation.isPending}
              mode="edit"
            />
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getText('merchant.promotions.edit.areYouSure', 'Are you sure?')}</DialogTitle>
            <DialogDescription>
              {getText('merchant.promotions.edit.thisWillPermanentlyDeleteThePromotion', 'This will permanently delete the promotion "')}{promotion.code}{getText('merchant.promotions.edit.thisActionCannotBeUndone', '". This action cannot be undone.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {getText('merchant.promotions.edit.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deletePromotionMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletePromotionMutation.isPending ? getText('merchant.promotions.edit.deleting', 'Deleting...') : getText('merchant.promotions.edit.deletePromotion', 'Delete Promotion')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
