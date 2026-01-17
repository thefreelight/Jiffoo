/**
 * Upgrade Confirmation Dialog Component
 *
 * Confirmation dialog for plan upgrade with i18n support.
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
import { Separator } from '../ui/separator'
import { CheckCircle, ArrowRight, CreditCard, Clock, Zap } from 'lucide-react'
import { useT } from 'shared/src/i18n/react'

interface UpgradeConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPlan: {
    name: string
    amount: number
    currency: string
    billingCycle: string
  }
  targetPlan: {
    name: string
    amount: number
    currency: string
    billingCycle: string
    features: string[]
    limits: Record<string, number>
  }
  upgradePreview: {
    prorationAmount: number
    nextBillingDate: string
    upgradeType: 'proration' | 'payment'
    immediateCharge: boolean
  }
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function UpgradeConfirmationDialog({
  open,
  onOpenChange,
  currentPlan,
  targetPlan,
  upgradePreview,
  onConfirm,
  onCancel,
  isLoading = false
}: UpgradeConfirmationDialogProps) {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getFeatureDisplayName = (feature: string) => {
    const featureMap: Record<string, string> = {
      'basic_payments': getText('merchant.plugins.feature.basicPayments', 'Basic Payments'),
      'payment_verification': getText('merchant.plugins.feature.paymentVerification', 'Payment Verification'),
      'webhooks': getText('merchant.plugins.feature.webhooks', 'Webhook Support'),
      'subscriptions': getText('merchant.plugins.feature.subscriptions', 'Subscription Management'),
      'refunds': getText('merchant.plugins.feature.refunds', 'Refund Processing'),
      'installments': getText('merchant.plugins.feature.installments', 'Installment Payments'),
      'advanced_analytics': getText('merchant.plugins.feature.advancedAnalytics', 'Advanced Analytics')
    }
    return featureMap[feature] || feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const getLimitDisplayName = (limit: string) => {
    const limitMap: Record<string, string> = {
      'api_calls': getText('merchant.plugins.limit.apiCalls', 'API Calls'),
      'transactions': getText('merchant.plugins.limit.transactions', 'Transactions')
    }
    return limitMap[limit] || limit.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatLimit = (value: number) => {
    return value === -1 ? getText('merchant.plugins.plan.unlimited', 'Unlimited') : value.toLocaleString()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            {getText('merchant.plugins.upgrade.title', 'Confirm Plan Upgrade')}
          </DialogTitle>
          <DialogDescription>
            {getText('merchant.plugins.upgrade.description', 'Review the details of your plan upgrade before proceeding.')}
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
                  <div className="font-semibold">{currentPlan.name}</div>
                  <div className="text-sm text-gray-600">
                    {formatCurrency(currentPlan.amount)}/{currentPlan.billingCycle}
                  </div>
                </div>

                <ArrowRight className="h-5 w-5 text-gray-400" />

                <div className="text-center">
                  <Badge variant="default" className="mb-2">{getText('merchant.plugins.newPlan', 'New Plan')}</Badge>
                  <div className="font-semibold">{targetPlan.name}</div>
                  <div className="text-sm text-gray-600">
                    {formatCurrency(targetPlan.amount)}/{targetPlan.billingCycle}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Billing Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">{getText('merchant.plugins.billingDetails', 'Billing Details')}</h4>
            <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900">
                  {upgradePreview.upgradeType === 'proration'
                    ? getText('merchant.plugins.upgrade.proratedUpgrade', 'Prorated Upgrade')
                    : getText('merchant.plugins.upgrade.newSubscription', 'New Subscription')}
                </span>
              </div>

              {upgradePreview.upgradeType === 'proration' && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">{getText('merchant.plugins.upgrade.proratedCharge', 'Prorated charge today')}:</span>
                    <span className="font-medium text-blue-900">
                      {formatCurrency(upgradePreview.prorationAmount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <Clock className="h-3 w-3" />
                    <span>{getText('merchant.plugins.upgrade.newBillingCycle', 'New billing cycle starts immediately')}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-blue-700">{getText('merchant.plugins.upgrade.nextBillingDate', 'Next billing date')}:</span>
                <span className="font-medium text-blue-900">
                  {formatDate(upgradePreview.nextBillingDate)}
                </span>
              </div>
            </div>
          </div>

          {/* New Features & Limits */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">{getText('merchant.plugins.upgrade.whatYouGet', 'What You\'ll Get')}</h4>

            {/* Features */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">{getText('merchant.plugins.plan.features', 'Features')}</h5>
              <div className="grid grid-cols-1 gap-2">
                {targetPlan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>{getFeatureDisplayName(feature)}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Limits */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">{getText('merchant.plugins.upgrade.usageLimits', 'Usage Limits')}</h5>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(targetPlan.limits).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-gray-600">{getLimitDisplayName(key)}:</span>
                    <span className="font-medium text-gray-900">{formatLimit(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Important Notice */}
          {upgradePreview.upgradeType === 'proration' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <div className="text-blue-600 mt-0.5">ℹ️</div>
                <div className="text-sm text-blue-800">
                  <strong>{getText('merchant.plugins.upgrade.instantUpgrade', 'Instant Upgrade')}:</strong> {getText('merchant.plugins.upgrade.instantUpgradeDesc', 'Your plan will be upgraded immediately after confirmation. The page will refresh automatically to show your new plan status and updated usage limits.')}
                  <div className="mt-2 text-xs text-blue-700">
                    • {getText('merchant.plugins.upgrade.notice1', 'Prorated billing applies instantly')}
                    • {getText('merchant.plugins.upgrade.notice2', 'New features become available immediately')}
                    • {getText('merchant.plugins.upgrade.notice3', 'Usage limits update automatically')}
                  </div>
                </div>
              </div>
            </div>
          )}
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
            className="min-w-[120px]"
          >
            {isLoading ? getText('common.processing', 'Processing...') : `${getText('merchant.plugins.upgrade.upgradeTo', 'Upgrade to')} ${targetPlan.name}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
