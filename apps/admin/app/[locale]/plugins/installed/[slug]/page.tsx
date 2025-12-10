/**
 * Generic Plugin Configuration Page
 *
 * Displays plugin configuration for installed plugins that don't have
 * dedicated pages (like Stripe, Resend, Google OAuth).
 * Handles install success/cancel URL parameters for OAuth-based installations.
 */
'use client'

import { AlertTriangle, ArrowLeft, CheckCircle, XCircle, Settings } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { PluginStatusBadge } from '@/components/plugins/PluginStatusBadge'
import { usePluginConfig, useUpdatePluginConfig, useInstalledPlugins } from '@/lib/hooks/use-api'
import { useT } from 'shared/src/i18n'

export default function PluginConfigPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const [configData, setConfigData] = useState<Record<string, any>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [showSuccessAlert, setShowSuccessAlert] = useState(false)
  const [showCancelAlert, setShowCancelAlert] = useState(false)

  const { data: configResponse, isLoading: configLoading } = usePluginConfig(slug)
  const { data: installedData } = useInstalledPlugins()
  const updateMutation = useUpdatePluginConfig()

  // Handle install success/cancel URL parameters
  useEffect(() => {
    const install = searchParams.get('install')

    if (install === 'success') {
      setShowSuccessAlert(true)
      // Clear the URL parameter after showing the alert
      setTimeout(() => {
        setShowSuccessAlert(false)
        router.replace(`/plugins/installed/${slug}`)
      }, 5000)
    } else if (install === 'cancelled' || install === 'error') {
      setShowCancelAlert(true)
      setTimeout(() => {
        setShowCancelAlert(false)
        router.replace(`/plugins/installed/${slug}`)
      }, 5000)
    }
  }, [searchParams, router, slug])

  // Note: Stripe, Resend, and Google OAuth have their own dedicated pages
  // This page is for other generic plugins that don't have specialized pages
  // These plugins typically don't support upgrade/downgrade functionality

  const installation = (installedData?.plugins || []).find(
    (p: any) => p.plugin.slug === slug
  )

  useEffect(() => {
    if (configResponse?.configData) {
      setConfigData(configResponse.configData)
    }
  }, [configResponse])



  const handleConfigChange = (key: string, value: any) => {
    setConfigData((prev) => ({
      ...prev,
      [key]: value,
    }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        slug,
        configData,
      })
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to update configuration:', error)
    }
  }

  const handleReset = () => {
    if (configResponse?.configData) {
      setConfigData(configResponse.configData)
      setHasChanges(false)
    }
  }

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">{getText('tenant.plugins.loadingConfiguration', 'Loading configuration...')}</p>
        </div>
      </div>
    )
  }

  if (!installation) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{getText('tenant.plugins.pluginNotFound', 'Plugin not found or not installed')}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/plugins/installed')}>
            {getText('tenant.plugins.backToInstalled', 'Back to Installed Plugins')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Installation Success Alert */}
      {showSuccessAlert && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <CheckCircle className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-green-800">{getText('tenant.plugins.installationSuccessful', 'Installation Successful!')}</h3>
              <p className="mt-1 text-sm text-green-700">
                {getText('tenant.plugins.installationSuccessfulDesc', 'The plugin has been installed and configured successfully. You can now configure additional settings below.')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Installation Cancel/Error Alert */}
      {showCancelAlert && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <XCircle className="w-5 h-5 text-red-400 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">{getText('tenant.plugins.installationIssue', 'Installation Issue')}</h3>
              <p className="mt-1 text-sm text-red-700">
                {getText('tenant.plugins.installationIssueDesc', 'There was an issue during the installation process. Please try again or contact support.')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Back Button */}
      <Button variant="outline" onClick={() => router.push('/plugins/installed')}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        {getText('tenant.plugins.backToInstalled', 'Back to Installed Plugins')}
      </Button>

      {/* Plugin Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Settings className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-2xl">{installation.plugin.name}</CardTitle>
                <CardDescription className="text-base mt-1">
                  {installation.plugin.description}
                </CardDescription>
                <div className="flex items-center gap-3 mt-3">
                  <PluginStatusBadge
                    status={installation.status}
                    enabled={installation.enabled}
                  />
                  <span className="text-sm text-gray-600">
                    {getText('tenant.plugins.version', 'Version')}: {installation.plugin.version}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>{getText('tenant.plugins.pluginConfiguration', 'Plugin Configuration')}</CardTitle>
              <CardDescription>
                {getText('tenant.plugins.pluginConfigurationDesc', 'Configure the plugin settings below. Changes will be saved immediately.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
          <div className="space-y-6">
            {/* Dynamic Configuration Fields */}
            {Object.keys(configData).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">{getText('tenant.plugins.noConfigOptions', 'No configuration options available for this plugin.')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(configData).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key} className="capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </Label>
                    {typeof value === 'boolean' ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={key}
                          checked={value}
                          onChange={(e) => handleConfigChange(key, e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-600">
                          {value ? getText('common.enabled', 'Enabled') : getText('common.disabled', 'Disabled')}
                        </span>
                      </div>
                    ) : typeof value === 'object' ? (
                      <Textarea
                        id={key}
                        value={JSON.stringify(value, null, 2)}
                        onChange={(e) => {
                          try {
                            handleConfigChange(key, JSON.parse(e.target.value))
                          } catch {
                            // Invalid JSON, don't update
                          }
                        }}
                        rows={6}
                        className="font-mono text-sm"
                      />
                    ) : (
                      <Input
                        id={key}
                        type={typeof value === 'number' ? 'number' : 'text'}
                        value={value}
                        onChange={(e) =>
                          handleConfigChange(
                            key,
                            typeof value === 'number'
                              ? parseFloat(e.target.value)
                              : e.target.value
                          )
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            {Object.keys(configData).length > 0 && (
              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={!hasChanges || updateMutation.isPending}
                >
                  {getText('common.reset', 'Reset')}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!hasChanges || updateMutation.isPending}
                >
                  {updateMutation.isPending ? getText('common.saving', 'Saving...') : getText('common.saveChanges', 'Save Changes')}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  )
}

