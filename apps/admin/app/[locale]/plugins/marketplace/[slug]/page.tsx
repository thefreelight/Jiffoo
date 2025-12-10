'use client'

import { AlertTriangle, ArrowLeft, Box, CheckCircle, Star, Users, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
// Removed SubscriptionPlanCard - no longer needed
import { usePluginDetails, useInstallPlugin, useInstalledPlugins } from '@/lib/hooks/use-api'
import Link from 'next/link'
import { useT, useLocale } from 'shared/src/i18n'

export default function PluginDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const t = useT()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Removed plan selection state - always use free plan

  const { data: pluginData, isLoading, error } = usePluginDetails(slug)
  const { data: installedData } = useInstalledPlugins()
  const installMutation = useInstallPlugin()

  // Handle both { plugin: {...} } and direct plugin data formats
  const plugin = pluginData?.plugin || pluginData
  const plans = pluginData?.plans || []
  const isInstalled = (installedData?.plugins || []).some((p: any) => p.plugin?.slug === slug || p.slug === slug)

  const handleInstall = async () => {
    if (!plugin) return

    try {
      const apiResult = await installMutation.mutateAsync({
        slug: plugin.slug,
        data: {
          planId: 'free', // Force Free Plan installation
          startTrial: false,
          configData: {},
        },
      })

      // 防御性处理：兼容 ApiResponse 结构或直接 payload
      // 后端可能返回 { success, data, message } 或直接返回 payload
      const payload = apiResult?.data ?? apiResult

      // 检查是否需要OAuth安装 (仅对需要OAuth的插件)
      // 使用可选链避免 undefined 访问错误
      if (payload?.requiresOAuth && payload?.oauthUrl) {
        // 重定向到外部插件的OAuth授权页面
        window.location.href = payload.oauthUrl
        return
      }

      // 普通安装成功（包括agent等不需要OAuth的插件），直接跳转
      router.push(`/${locale}/plugins/installed`)
    } catch (error) {
      console.error('Failed to install plugin:', error)
    }
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-5 h-5 ${
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
        <span className="text-lg text-gray-600 ml-2">({rating.toFixed(1)})</span>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">{getText('tenant.plugins.loadingPluginDetails', 'Loading plugin details...')}</p>
        </div>
      </div>
    )
  }

  if (error || !plugin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{getText('tenant.plugins.failedToLoadDetails', 'Failed to load plugin details')}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            {getText('common.goBack', 'Go Back')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="outline" onClick={() => router.back()}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        {getText('tenant.plugins.backToMarketplace', 'Back to Marketplace')}
      </Button>

      {/* Plugin Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {/* Plugin Icon with background color */}
              <div
                className="p-3 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: plugin.iconBgColor || '#EFF6FF' }}
              >
                {plugin.icon?.startsWith('http') ? (
                  <img
                    src={plugin.icon}
                    alt={plugin.name}
                    className="w-8 h-8"
                    style={{ filter: 'brightness(0) invert(1)' }}
                  />
                ) : (
                  <span className="text-2xl">{plugin.icon || '📦'}</span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-2xl">{plugin.name}</CardTitle>
                  {/* Official Badge */}
                  {plugin.isOfficial && (
                    <Badge className="bg-blue-600 text-white flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Official
                    </Badge>
                  )}
                  {plugin.verified && !plugin.isOfficial && (
                    <Badge variant="outline" className="text-green-600 border-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Verified
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-base mt-1">{plugin.description}</CardDescription>
                <div className="flex items-center gap-4 mt-3">
                  {renderStars(plugin.rating)}
                  <div className="flex items-center gap-1 text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{plugin.installCount.toLocaleString()} {getText('tenant.plugins.installs', 'installs')}</span>
                  </div>
                </div>
              </div>
            </div>
            {isInstalled && (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="w-4 h-4 mr-1" />
                {getText('tenant.plugins.installed', 'Installed')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">{getText('tenant.plugins.version', 'Version')}</p>
              <p className="font-semibold">{plugin.version}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{getText('tenant.plugins.developer', 'Developer')}</p>
              <p className="font-semibold">{plugin.developer || plugin.author}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{getText('tenant.plugins.category', 'Category')}</p>
              <Badge variant="outline">{plugin.category}</Badge>
            </div>
            <div>
              <p className="text-sm text-gray-600">{getText('tenant.plugins.businessModel', 'Business Model')}</p>
              <Badge>{plugin.businessModel}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features from Plans */}
      {plans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{getText('tenant.plugins.availableFeatures', 'Available Features')}</CardTitle>
            <CardDescription>{getText('tenant.plugins.availableFeaturesDesc', 'Features available across different plans')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {plans.map((plan: any) => {
                const features = JSON.parse(plan.features || '[]')
                return (
                  <div key={plan.id}>
                    <h4 className="font-semibold mb-2">{plan.name}</h4>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {features.map((feature: string, index: number) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>{feature.replace(/_/g, ' ')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Simple Installation - No Plan Selection */}

      {/* Install Button */}
      {!isInstalled && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">{getText('tenant.plugins.readyToInstall', 'Ready to install?')}</h3>
                <p className="text-gray-600">
                  {getText('tenant.plugins.readyToInstallDesc', 'Install this plugin to get started. You can upgrade to paid plans later from the plugin management page.')}
                </p>
              </div>
              <Button
                size="lg"
                onClick={handleInstall}
                disabled={installMutation.isPending}
              >
                {installMutation.isPending ? getText('tenant.plugins.installing', 'Installing...') : getText('tenant.plugins.installPlugin', 'Install Plugin')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Already Installed */}
      {isInstalled && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <h3 className="font-semibold text-lg">{getText('tenant.plugins.pluginInstalled', 'Plugin Installed')}</h3>
                  <p className="text-gray-600">{getText('tenant.plugins.pluginInstalledDesc', 'This plugin is already installed in your store.')}</p>
                </div>
              </div>
              <Button asChild>
                <Link href={`/${locale}/plugins/installed`}>{getText('tenant.plugins.managePlugin', 'Manage Plugin')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

