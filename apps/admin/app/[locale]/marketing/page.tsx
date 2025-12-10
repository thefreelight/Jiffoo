/**
 * Marketing Management Page
 *
 * Manages campaigns, promotions, and customer engagement with i18n support.
 */

'use client'

import { AlertCircle, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useT } from 'shared/src/i18n'

export default function MarketingPage() {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{getText('tenant.marketing.title', 'Marketing')}</h1>
          <p className="text-gray-600 mt-1">{getText('tenant.marketing.subtitle', 'Manage campaigns, promotions, and customer engagement')}</p>
        </div>
      </div>

      {/* Alert Banner */}
      <Card className="border-yellow-200 bg-yellow-50 mb-8">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900">{getText('tenant.marketing.featureInDevelopment', 'Feature In Development')}</h3>
              <p className="text-sm text-yellow-800 mt-1">
                {getText('tenant.marketing.featureInDevelopmentDesc', 'Marketing campaigns, coupons, and email marketing features are pending backend API implementation. This feature will be enabled once the backend provides the corresponding marketing management interfaces.')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Placeholder Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{getText('tenant.marketing.campaigns', 'Campaigns')}</p>
                <p className="text-2xl font-bold text-gray-900">—</p>
                <p className="text-sm text-gray-500 mt-1">{getText('tenant.marketing.featureInDevelopment', 'Feature In Development')}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Megaphone className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{getText('tenant.marketing.coupons', 'Coupons')}</p>
                <p className="text-2xl font-bold text-gray-900">—</p>
                <p className="text-sm text-gray-500 mt-1">{getText('tenant.marketing.featureInDevelopment', 'Feature In Development')}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Megaphone className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
