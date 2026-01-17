/**
 * Downgrade Confirmation Dialog Component
 *
 * Confirmation dialog for plan downgrade with i18n support.
 */

'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { ArrowRight, CreditCard, Clock, AlertTriangle, TrendingDown } from 'lucide-react'
import { useT } from 'shared/src/i18n/react'

interface DowngradeConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPlan: string
  targetPlan: string
  currentAmount: number
  targetAmount: number
  isImmediate: boolean
  isPaidDowngrade: boolean
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function DowngradeConfirmationDialog({
  open,
  onOpenChange,
  currentPlan,
  targetPlan,
  currentAmount,
  targetAmount,
  isImmediate,
  isPaidDowngrade,
  onConfirm,
  onCancel,
  isLoading = false
}: DowngradeConfirmationDialogProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const handleCancel = () => {
    onCancel()
    onOpenChange(false)
  }

  const handleConfirm = () => {
    onConfirm()
  }

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount)
  }

  const getPlanDisplayName = (planId: string) => {
    const planNames: Record<string, string> = {
      'free': getText('merchant.plugins.plan.free', 'Free Plan'),
      'business': getText('merchant.plugins.plan.business', 'Business Plan'),
      'enterprise': getText('merchant.plugins.plan.enterprise', 'Enterprise Plan')
    }
    return planNames[planId] || planId
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-orange-600" />
            {getText('merchant.plugins.downgrade.title', 'Confirm Plan Downgrade')}
          </DialogTitle>
          <DialogDescription>
            {getText('merchant.plugins.downgrade.description', 'Please review the details of your plan downgrade before proceeding.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto flex-1 pr-2">
          {/* Plan Comparison */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">{getText('merchant.plugins.planChange', 'Plan Change')}</h4>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <Badge variant="outline" className="mb-2">{getText('merchant.plugins.current', 'Current')}</Badge>
                  <div className="font-semibold">{getPlanDisplayName(currentPlan)}</div>
                  <div className="text-sm text-gray-600">
                    {formatCurrency(currentAmount)}/{getText('merchant.plugins.month', 'month')}
                  </div>
                </div>

                <ArrowRight className="h-5 w-5 text-gray-400" />

                <div className="text-center">
                  <Badge variant="secondary" className="mb-2">{getText('merchant.plugins.newPlan', 'New Plan')}</Badge>
                  <div className="font-semibold">{getPlanDisplayName(targetPlan)}</div>
                  <div className="text-sm text-gray-600">
                    {formatCurrency(targetAmount)}/{getText('merchant.plugins.month', 'month')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Billing Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">{getText('merchant.plugins.billingDetails', 'Billing Details')}</h4>

            {isPaidDowngrade ? (
              <div className="space-y-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-orange-600" />
                  <span className="font-medium text-orange-900">
                    {getText('merchant.plugins.downgrade.immediateProrated', 'Immediate Downgrade with Prorated Billing')}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-orange-700">{getText('merchant.plugins.downgrade.proratedCredit', 'Prorated credit today')}:</span>
                  <span className="font-medium text-orange-900">
                    {formatCurrency(currentAmount - targetAmount)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-orange-700">
                  <Clock className="h-3 w-3" />
                  <span>{getText('merchant.plugins.downgrade.newBillingCycle', 'New billing cycle starts immediately')}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-900">
                    {getText('merchant.plugins.downgrade.scheduled', 'Scheduled Downgrade')}
                  </span>
                </div>

                <div className="text-sm text-blue-700">
                  {getText('merchant.plugins.downgrade.scheduledDesc', 'Your plan will change at the end of your current billing period. You\'ll continue to have access to your current plan features until then.')}
                </div>
              </div>
            )}
          </div>

          {/* Important Notice */}
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <strong>{getText('merchant.plugins.importantNotice', 'Important Notice')}:</strong>
                <div className="mt-2 space-y-1">
                  {isPaidDowngrade ? (
                    <>
                      <div>• {getText('merchant.plugins.downgrade.notice1Immediate', 'Your plan will be downgraded immediately after confirmation')}</div>
                      <div>• {getText('merchant.plugins.downgrade.notice2Immediate', 'You\'ll receive a prorated credit for the unused portion of your current plan')}</div>
                      <div>• {getText('merchant.plugins.downgrade.notice3Immediate', 'Some features may become unavailable immediately')}</div>
                      <div>• {getText('merchant.plugins.downgrade.notice4Immediate', 'Usage limits will be reduced to the new plan\'s limits')}</div>
                    </>
                  ) : (
                    <>
                      <div>• {getText('merchant.plugins.downgrade.notice1Scheduled', 'Your plan will be downgraded at the end of your current billing period')}</div>
                      <div>• {getText('merchant.plugins.downgrade.notice2Scheduled', 'You\'ll continue to have access to current features until then')}</div>
                      <div>• {getText('merchant.plugins.downgrade.notice3Scheduled', 'No refund will be issued for the current billing period')}</div>
                      <div>• {getText('merchant.plugins.downgrade.notice4Scheduled', 'You can cancel this downgrade request anytime before it takes effect')}</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {getText('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            variant="destructive"
            className="min-w-[120px]"
          >
            {isLoading ? getText('common.processing', 'Processing...') : `${getText('merchant.plugins.downgrade.downgradeTo', 'Downgrade to')} ${getPlanDisplayName(targetPlan)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
