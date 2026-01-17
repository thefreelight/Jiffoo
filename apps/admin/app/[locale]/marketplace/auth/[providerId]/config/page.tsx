/**
 * Marketplace OAuth Provider Configuration Page
 *
 * Configuration page for OAuth providers in the marketplace.
 * This feature is pending backend API implementation.
 */

'use client'

import { AlertCircle, ArrowLeft } from 'lucide-react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useT } from 'shared/src/i18n/react'

export default function AuthProviderConfigPage() {
  const t = useT()
  const params = useParams()
  const providerId = params.providerId as string

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Link href="/marketplace">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {getText('common.back', 'Back')}
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getText('merchant.marketplace.oauthConfig.title', 'OAuth Provider Configuration')}</h1>
            <p className="text-gray-600">{getText('merchant.marketplace.oauthConfig.provider', 'Provider')}: {providerId}</p>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900">{getText('merchant.marketplace.oauthConfig.pendingTitle', 'Feature Under Development')}</h3>
              <p className="text-sm text-yellow-800 mt-1">
                {getText('merchant.marketplace.oauthConfig.pendingDescription', 'OAuth provider configuration is pending backend API implementation. This feature will be enabled once the backend provides the authentication provider management interface.')}
              </p>
              <p className="text-sm text-yellow-800 mt-2">
                {getText('merchant.marketplace.oauthConfig.alternativeHint', 'To configure OAuth authentication, please use installed plugins (such as Google OAuth plugin).')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
