/**
 * Plugins Overview Page
 *
 * Displays installed plugins with i18n support.
 * Uses in-page navigation instead of sidebar submenu (Shopify style).
 */

'use client'

import { AlertTriangle, ArrowRight, Box, CheckCircle, ShoppingBag } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useInstalledPlugins } from '@/lib/hooks/use-api'
import { PageNav } from '@/components/layout/page-nav'
import Link from 'next/link'
import { useT, useLocale } from 'shared/src/i18n/react'


// Render brand-specific plugin icon
const renderPluginIcon = (plugin: { slug?: string; name?: string; icon?: string }, bgColor: string) => {
  const slug = plugin.slug?.toLowerCase() || ''
  const name = plugin.name?.toLowerCase() || ''

  const iconWrapper = (children: React.ReactNode) => (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: bgColor }}>
      {children}
    </div>
  )

  // Stripe
  if (slug.includes('stripe') || name.includes('stripe')) {
    return iconWrapper(
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
      </svg>
    )
  }

  // PayPal
  if (slug.includes('paypal') || name.includes('paypal')) {
    return iconWrapper(
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z" />
      </svg>
    )
  }

  // WeChat Pay
  if (slug.includes('wechat') || name.includes('wechat')) {
    return iconWrapper(
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
        <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.032zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z" />
      </svg>
    )
  }

  // Alipay
  if (slug.includes('alipay') || name.includes('alipay')) {
    return iconWrapper(
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
        <path d="M21.422 15.358c-3.32-1.339-6.042-2.478-6.042-2.478s.676-1.666 1.053-3.478c.379-1.812.265-3.274-.354-3.992-.619-.717-1.812-.934-2.926-.226-1.113.71-2.026 2.46-2.31 4.194h-2.13v-1.608h-2.61v1.608H3.16v2.13h2.943v3.82H3.16v2.128h2.943v4.548h2.61V17.36h2.705c.452 1.16 1.033 2.248 1.743 3.23 1.162 1.604 2.558 2.79 4.066 3.557 1.508.767 3.13 1.157 4.708 1.157.764 0 1.513-.094 2.233-.275v-9.67z" />
      </svg>
    )
  }

  // Default
  return iconWrapper(<Box className="w-5 h-5 text-white" />)
}

export default function PluginsOverviewPage() {
  const t = useT()
  const locale = useLocale()
  const { data: installedData, isLoading: installedLoading } = useInstalledPlugins()

  const installedPlugins = installedData?.plugins || []
  const loading = installedLoading

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    // If translation returns the key itself, use fallback
    return translated === key ? fallback : translated
  }

  // Page navigation items for Plugins module
  const navItems = [
    { label: getText('merchant.plugins.overview', 'Overview'), href: '/plugins', exact: true },
    { label: getText('merchant.plugins.installed', 'Installed'), href: '/plugins/installed' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">{getText('merchant.plugins.loading', 'Loading plugins...')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">{getText('merchant.plugins.title', 'Plugin Management')}</h1>
          <p className="text-gray-600 mt-1">
            {getText('merchant.plugins.subtitle', 'Manage your installed plugins and use offline installation')}
          </p>
        </div>
        {/* In-page Navigation */}
        <PageNav items={navItems} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{getText('merchant.plugins.installedPlugins', 'Installed Plugins')}</CardTitle>
            <Box className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{installedPlugins.length}</div>
            <p className="text-xs text-gray-600 mt-1">
              {installedPlugins.filter((p: any) => p.enabled).length} {getText('merchant.plugins.active', 'active')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{getText('merchant.plugins.status', 'Status')}</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{getText('merchant.plugins.allSystemsOperational', 'All Systems Operational')}</div>
            <p className="text-xs text-gray-600 mt-1">{getText('merchant.plugins.noIssuesDetected', 'No issues detected')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Installed Plugins */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{getText('merchant.plugins.installedPlugins', 'Installed Plugins')}</CardTitle>
                <CardDescription>{getText('merchant.plugins.manageActivePlugins', 'Manage your active plugins')}</CardDescription>
              </div>
              <Button variant="outline" asChild>
                <Link href={`/${locale}/plugins/installed`}>
                  {getText('merchant.plugins.viewAll', 'View All')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {installedPlugins.length === 0 ? (
              <div className="text-center py-8">
                <Box className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">{getText('merchant.plugins.noPluginsInstalled', 'No plugins installed yet')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {installedPlugins.slice(0, 3).map((installation: any) => (
                  <div
                    key={installation.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      {renderPluginIcon(installation.plugin, installation.plugin.iconBgColor || '#3B82F6')}
                      <div>
                        <p className="font-medium">{installation.plugin.name}</p>
                        <p className="text-sm text-gray-600">{installation.plugin.category}</p>
                      </div>
                    </div>
                    <Badge className={installation.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {installation.enabled ? getText('merchant.plugins.active', 'Active') : getText('merchant.plugins.disabled', 'Disabled')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Help Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-blue-600" />
            {getText('merchant.plugins.gettingStarted', 'Getting Started with Plugins')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-4">
            {getText('merchant.plugins.gettingStartedDesc', "Plugins extend your store's functionality. You can install plugins offline using ZIP files.")}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href={`/${locale}/plugins/installed`}>{getText('merchant.plugins.manageInstalled', 'Manage Installed')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

