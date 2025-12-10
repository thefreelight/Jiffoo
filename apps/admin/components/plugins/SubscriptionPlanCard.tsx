/**
 * Subscription Plan Card Component
 *
 * Displays subscription plan details with i18n support.
 */

'use client'

import { Check } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { useT } from 'shared/src/i18n'

import { SubscriptionPlan } from '../../lib/types'

interface SubscriptionPlanCardProps {
  plan: SubscriptionPlan
  isPopular?: boolean
  isSelected?: boolean
  onSelect?: () => void
}

export function SubscriptionPlanCard({
  plan,
  isPopular = false,
  isSelected = false,
  onSelect
}: SubscriptionPlanCardProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Parse JSON strings
  const features = JSON.parse(plan.features || '[]')
  const limits = JSON.parse(plan.limits || '{}')

  return (
    <Card className={`relative ${isSelected ? 'ring-2 ring-blue-600' : ''} ${isPopular ? 'border-blue-600' : ''}`}>
      {isPopular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-blue-600 text-white">{getText('tenant.plugins.plan.mostPopular', 'Most Popular')}</Badge>
        </div>
      )}

      <CardHeader>
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>

        <div className="mt-4">
          <div className="flex items-baseline">
            <span className="text-4xl font-bold">{plan.currency} {plan.amount}</span>
            <span className="text-gray-600 ml-2">/{plan.billingCycle}</span>
          </div>
          {plan.trialDays > 0 && (
            <p className="text-sm text-green-600 mt-2">{plan.trialDays} {getText('tenant.plugins.plan.daysFreeTrial', 'days free trial')}</p>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Features */}
          <div>
            <p className="font-semibold mb-2">{getText('tenant.plugins.plan.features', 'Features')}:</p>
            <ul className="space-y-2">
              {features.map((feature: string, index: number) => (
                <li key={index} className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">{feature.replace(/_/g, ' ')}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Limits */}
          {Object.keys(limits).length > 0 && (
            <div>
              <p className="font-semibold mb-2">{getText('tenant.plugins.plan.limits', 'Limits')}:</p>
              <ul className="space-y-1">
                {Object.entries(limits).map(([key, value]) => (
                  <li key={key} className="text-sm text-gray-600">
                    <span className="font-medium">{key.replace(/_/g, ' ')}:</span> {value === -1 ? getText('tenant.plugins.plan.unlimited', 'Unlimited') : (value as number).toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Select Button */}
          <Button
            className="w-full"
            variant={isSelected ? 'default' : 'outline'}
            onClick={onSelect}
          >
            {isSelected ? getText('tenant.plugins.plan.selected', 'Selected') : getText('tenant.plugins.plan.selectPlan', 'Select Plan')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

