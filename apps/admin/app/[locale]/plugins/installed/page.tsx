/**
 * Installed Plugins Page
 *
 * Displays and manages all installed plugins including enabling/disabling
 * and uninstalling functionality.
 * Uses in-page navigation (Shopify style).
 */
'use client'

import { AlertTriangle, Box, CheckCircle, Plus, Settings, Trash2, TrendingUp } from 'lucide-react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { PluginStatusBadge } from '@/components/plugins/PluginStatusBadge'
import { PageNav } from '@/components/layout/page-nav'
import { useInstalledPlugins, useTogglePlugin, useUninstallPlugin } from '@/lib/hooks/use-api'
import { pluginsApi } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { useT } from 'shared/src/i18n'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Component to display plugin usage info
function PluginUsageInfo({ slug, getText }: { slug: string; getText: (key: string, fallback: string) => string }) {
  const { data: usageData, isLoading } = useQuery({
    queryKey: ['plugin-usage', slug],
    queryFn: async () => {
      try {
        const response = await pluginsApi.getPluginUsage(slug)
        return response.data || null
      } catch {
        return null
      }
    },
    staleTime: 60000, // Cache for 1 minute
  })

  if (isLoading || !usageData) return null

  const { used, limit, percentage } = usageData
  if (typeof used !== 'number' || typeof limit !== 'number') return null

  const usagePercent = percentage || Math.round((used / limit) * 100)
  const isNearLimit = usagePercent >= 80
  const isAtLimit = usagePercent >= 100

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">
          {getText('tenant.plugins.installedPage.usage', 'Usage')}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        <span className={`text-sm font-medium ${isAtLimit ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-gray-600'}`}>
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      {isNearLimit && (
        <p className="text-xs text-yellow-600 mt-1">
          {isAtLimit
            ? getText('tenant.plugins.installedPage.limitReached', 'Usage limit reached. Consider upgrading your plan.')
            : getText('tenant.plugins.installedPage.nearLimit', 'Approaching usage limit.')}
        </p>
      )}
    </div>
  )
}

export default function InstalledPluginsPage() {
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    // If translation returns the key itself, use fallback
    return translated === key ? fallback : translated
  }

  // Page navigation items for Plugins module
  const navItems = [
    { label: getText('tenant.plugins.overview', 'Overview'), href: '/plugins', exact: true },
    { label: getText('tenant.plugins.marketplace', 'Marketplace'), href: '/plugins/marketplace' },
    { label: getText('tenant.plugins.installed', 'Installed'), href: '/plugins/installed' },
  ]
  const [uninstallDialogOpen, setUninstallDialogOpen] = useState(false)
  const [selectedPlugin, setSelectedPlugin] = useState<any>(null)
  const [installSuccess, setInstallSuccess] = useState(false)
  const searchParams = useSearchParams()

  const { data: installedData, isLoading, error } = useInstalledPlugins()

  // 处理 OAuth 安装成功回调
  useEffect(() => {
    if (searchParams.get('install') === 'success') {
      setInstallSuccess(true)
      // 3秒后自动隐藏成功提示
      const timer = setTimeout(() => setInstallSuccess(false), 5000)
      // 清理 URL 参数
      window.history.replaceState({}, '', '/plugins/installed')
      return () => clearTimeout(timer)
    }
  }, [searchParams])
  const toggleMutation = useTogglePlugin()
  const uninstallMutation = useUninstallPlugin()

  const plugins = installedData?.plugins || []

  const handleToggle = async (slug: string, currentEnabled: boolean) => {
    try {
      await toggleMutation.mutateAsync({
        slug,
        enabled: !currentEnabled,
      })
    } catch (error) {
      console.error('Failed to toggle plugin:', error)
    }
  }

  const handleUninstallClick = (plugin: any) => {
    setSelectedPlugin(plugin)
    setUninstallDialogOpen(true)
  }

  const handleUninstallConfirm = async () => {
    if (!selectedPlugin) return

    try {
      await uninstallMutation.mutateAsync(selectedPlugin.plugin.slug)
      setUninstallDialogOpen(false)
      setSelectedPlugin(null)
    } catch (error) {
      console.error('Failed to uninstall plugin:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">{getText('tenant.plugins.installedPage.loading', 'Loading installed plugins...')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{getText('tenant.plugins.installedPage.loadFailed', 'Failed to load installed plugins')}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            {getText('tenant.plugins.installedPage.retry', 'Retry')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Install Success Banner */}
      {installSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800">{getText('tenant.plugins.installedPage.installSuccess', 'Plugin installed successfully!')}</p>
              <p className="text-sm text-green-600">{getText('tenant.plugins.installedPage.installSuccessDesc', 'The plugin has been installed and is ready to use.')}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setInstallSuccess(false)}>
            {getText('tenant.plugins.installedPage.dismiss', 'Dismiss')}
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getText('tenant.plugins.installedPage.title', 'Installed Plugins')}</h1>
            <p className="text-gray-600 mt-1">
              {getText('tenant.plugins.installedPage.subtitle', 'Manage your installed plugins and their configurations')}
            </p>
          </div>
          <Button className="bg-gray-900 hover:bg-gray-800" asChild>
            <Link href="/plugins/marketplace">
              <Plus className="w-4 h-4 mr-2" />
              {getText('tenant.plugins.browseMarketplace', 'Browse Marketplace')}
            </Link>
          </Button>
        </div>
        {/* In-page Navigation */}
        <PageNav items={navItems} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{getText('tenant.plugins.installedPage.totalInstalled', 'Total Installed')}</CardTitle>
            <Box className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plugins.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{getText('tenant.plugins.installedPage.activePlugins', 'Active Plugins')}</CardTitle>
            <Box className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {plugins.filter((p: any) => p.enabled).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{getText('tenant.plugins.installedPage.disabledPlugins', 'Disabled Plugins')}</CardTitle>
            <Box className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {plugins.filter((p: any) => !p.enabled).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plugin List */}
      {plugins.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Box className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{getText('tenant.plugins.installedPage.noPlugins', 'No Plugins Installed')}</h3>
              <p className="text-gray-600 mb-4">
                {getText('tenant.plugins.installedPage.getStarted', 'Get started by installing plugins from the marketplace')}
              </p>
              <Button asChild>
                <Link href="/plugins/marketplace">{getText('tenant.plugins.browseMarketplace', 'Browse Marketplace')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {plugins.map((installation: any) => (
            <Card key={installation.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Box className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{installation.plugin.name}</h3>
                        <PluginStatusBadge
                          status={installation.status}
                          enabled={installation.enabled}
                        />
                        <Badge variant="outline">{installation.plugin.category}</Badge>
                      </div>
                      <p className="text-gray-600 mb-3">{installation.plugin.description}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{getText('tenant.plugins.installedPage.version', 'Version')}: {installation.plugin.version}</span>
                        <span>•</span>
                        <span>{getText('tenant.plugins.installedPage.installedDate', 'Installed')}: {new Date(installation.installedAt).toLocaleDateString()}</span>
                        {installation.subscription && (
                          <>
                            <span>•</span>
                            <span>{getText('tenant.plugins.installedPage.plan', 'Plan')}: {installation.subscription.planId}</span>
                          </>
                        )}
                      </div>
                      {/* Plugin Usage Info */}
                      <PluginUsageInfo slug={installation.plugin.slug} getText={getText} />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Enable/Disable Toggle */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {installation.enabled ? getText('tenant.plugins.installedPage.enabled', 'Enabled') : getText('tenant.plugins.disabled', 'Disabled')}
                      </span>
                      <Switch
                        checked={installation.enabled}
                        onCheckedChange={() =>
                          handleToggle(installation.plugin.slug, installation.enabled)
                        }
                        disabled={toggleMutation.isPending}
                      />
                    </div>

                    {/* Configure Button */}
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/plugins/installed/${installation.plugin.slug}`}>
                        <Settings className="w-4 h-4 mr-2" />
                        {getText('tenant.plugins.configure', 'Configure')}
                      </Link>
                    </Button>

                    {/* Uninstall Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUninstallClick(installation)}
                      disabled={uninstallMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {getText('tenant.plugins.uninstall', 'Uninstall')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Uninstall Confirmation Dialog */}
      <Dialog open={uninstallDialogOpen} onOpenChange={setUninstallDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getText('tenant.plugins.installedPage.uninstallTitle', 'Uninstall Plugin')}</DialogTitle>
            <DialogDescription>
              {getText('tenant.plugins.installedPage.uninstallConfirm', 'Are you sure you want to uninstall')}{' '}
              <span className="font-semibold">{selectedPlugin?.plugin.name}</span>?
              {getText('tenant.plugins.installedPage.uninstallWarning', 'This action cannot be undone and all plugin data will be removed.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUninstallDialogOpen(false)}
              disabled={uninstallMutation.isPending}
            >
              {getText('tenant.plugins.installedPage.cancel', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleUninstallConfirm}
              disabled={uninstallMutation.isPending}
            >
              {uninstallMutation.isPending ? getText('tenant.plugins.installedPage.uninstalling', 'Uninstalling...') : getText('tenant.plugins.uninstall', 'Uninstall')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

