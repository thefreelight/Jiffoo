/**
 * Installed Plugins Page
 *
 * Displays and manages all installed plugins including enabling/disabling
 * and uninstalling functionality.
 * Uses in-page navigation (Shopify style).
 */
'use client'

import { AlertTriangle, Box, CheckCircle, Plus, Settings, Trash2 } from 'lucide-react'
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
import { useT } from 'shared/src/i18n/react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Plugin usage tracking removed for Alpha Gate (not needed in open-source version)

export default function InstalledPluginsPage() {
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    // If translation returns the key itself, use fallback
    return translated === key ? fallback : translated
  }

  const navItems = [
    { label: getText('merchant.plugins.overview', 'Overview'), href: '/plugins', exact: true },
    { label: getText('merchant.plugins.installed', 'Installed'), href: '/plugins/installed' },
  ]
  const [uninstallDialogOpen, setUninstallDialogOpen] = useState(false)
  const [selectedPlugin, setSelectedPlugin] = useState<any>(null)
  const [installSuccess, setInstallSuccess] = useState(false)

  // Upload State
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const searchParams = useSearchParams()

  const { data: installedData, isLoading, error } = useInstalledPlugins()

  // Handle OAuth installation success callback
  useEffect(() => {
    if (searchParams.get('install') === 'success') {
      setInstallSuccess(true)
      // Auto hide success toast after 3 seconds
      const timer = setTimeout(() => setInstallSuccess(false), 5000)
      // Clear URL parameters
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

  const handleUpload = async () => {
    if (!uploadFile) return

    try {
      setIsUploading(true)
      const response = await pluginsApi.installFromZip(uploadFile)

      if (response.success) {
        setInstallSuccess(true)
        setUploadDialogOpen(false)
        setUploadFile(null)
        // Auto hide success toast after 3 seconds
        const timer = setTimeout(() => setInstallSuccess(false), 5000)
        // Ideally reload data here
        // window.location.reload()
      } else {
        console.error('Upload failed:', response.message)
      }
    } catch (error) {
      console.error('Plugin upload failed:', error)
    } finally {
      setIsUploading(false)
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
          <p className="mt-2 text-gray-600">{getText('merchant.plugins.installedPage.loading', 'Loading installed plugins...')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{getText('merchant.plugins.installedPage.loadFailed', 'Failed to load installed plugins')}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            {getText('merchant.plugins.installedPage.retry', 'Retry')}
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
              <p className="font-medium text-green-800">{getText('merchant.plugins.installedPage.installSuccess', 'Plugin installed successfully!')}</p>
              <p className="text-sm text-green-600">{getText('merchant.plugins.installedPage.installSuccessDesc', 'The plugin has been installed and is ready to use.')}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setInstallSuccess(false)}>
            {getText('merchant.plugins.installedPage.dismiss', 'Dismiss')}
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getText('merchant.plugins.installedPage.title', 'Installed Plugins')}</h1>
            <p className="text-gray-600 mt-1">
              {getText('merchant.plugins.installedPage.subtitle', 'Manage your installed plugins and their configurations')}
            </p>
          </div>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {getText('merchant.plugins.uploadZip', 'Upload ZIP')}
          </Button>
        </div>
        {/* In-page Navigation */}
        <PageNav items={navItems} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{getText('merchant.plugins.installedPage.totalInstalled', 'Total Installed')}</CardTitle>
            <Box className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plugins.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{getText('merchant.plugins.installedPage.activePlugins', 'Active Plugins')}</CardTitle>
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
            <CardTitle className="text-sm font-medium">{getText('merchant.plugins.installedPage.disabledPlugins', 'Disabled Plugins')}</CardTitle>
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
              <h3 className="text-lg font-semibold mb-2">{getText('merchant.plugins.installedPage.noPlugins', 'No Plugins Installed')}</h3>
              <p className="text-gray-600 mb-4">
                {getText('merchant.plugins.installedPage.getStarted', 'Get started by using Offline ZIP Installation')}
              </p>
              <p className="text-sm text-gray-500">
                {getText('merchant.plugins.installedPage.offlineInstallHint', 'Use offline ZIP upload to install plugins')}
              </p>
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
                        <span>{getText('merchant.plugins.installedPage.version', 'Version')}: {installation.plugin.version}</span>
                        <span>•</span>
                        <span>{getText('merchant.plugins.installedPage.installedDate', 'Installed')}: {new Date(installation.installedAt).toLocaleDateString()}</span>
                        {/* Subscription Info - Removed for Alpha Gate */}
                      </div>
                      {/* Plugin Usage Info - Removed for Alpha Gate */}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Enable/Disable Toggle */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {installation.enabled ? getText('merchant.plugins.installedPage.enabled', 'Enabled') : getText('merchant.plugins.disabled', 'Disabled')}
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
                        {getText('merchant.plugins.configure', 'Configure')}
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
                      {getText('merchant.plugins.uninstall', 'Uninstall')}
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
            <DialogTitle>{getText('merchant.plugins.installedPage.uninstallTitle', 'Uninstall Plugin')}</DialogTitle>
            <DialogDescription>
              {getText('merchant.plugins.installedPage.uninstallConfirm', 'Are you sure you want to uninstall')}{' '}
              <span className="font-semibold">{selectedPlugin?.plugin.name}</span>?
              {getText('merchant.plugins.installedPage.uninstallWarning', 'This action cannot be undone and all plugin data will be removed.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUninstallDialogOpen(false)}
              disabled={uninstallMutation.isPending}
            >
              {getText('merchant.plugins.installedPage.cancel', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleUninstallConfirm}
              disabled={uninstallMutation.isPending}
            >
              {uninstallMutation.isPending ? getText('merchant.plugins.installedPage.uninstalling', 'Uninstalling...') : getText('merchant.plugins.uninstall', 'Uninstall')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload ZIP Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getText('merchant.plugins.uploadZipTitle', 'Install Plugin from ZIP')}</DialogTitle>
            <DialogDescription>
              {getText('merchant.plugins.uploadZipDesc', 'Upload a plugin ZIP bundle to install it offline.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <input
                type="file"
                accept=".zip"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-gray-600 file:border-0 file:bg-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-md file:text-sm file:font-semibold hover:file:bg-gray-200"
              />
            </div>
            {uploadFile && (
              <p className="text-sm text-gray-500">
                Selected: {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              {getText('merchant.plugins.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleUpload} disabled={!uploadFile || isUploading}>
              {isUploading ? 'Uploading...' : getText('merchant.plugins.install', 'Install')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
