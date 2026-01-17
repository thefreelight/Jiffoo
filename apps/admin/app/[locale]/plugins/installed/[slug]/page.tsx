'use client'

import { ArrowLeft, Box, Save, Settings } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PluginStatusBadge } from '@/components/plugins/PluginStatusBadge'
import { usePluginConfig, useInstalledPlugins } from '@/lib/hooks/use-api'
import { pluginsApi } from '@/lib/api'
import { useT, useLocale } from 'shared/src/i18n/react'

export default function GenericPluginConfigPage() {
  const router = useRouter()
  const { slug } = useParams()
  const t = useT()
  const locale = useLocale()
  const getText = (key: string, fallback: string): string => t ? t(key) : fallback

  const [configData, setConfigData] = useState<Record<string, any>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const { data: configResponse, isLoading: configLoading } = usePluginConfig(slug as string)
  const { data: installedData } = useInstalledPlugins()

  const installation = (installedData?.plugins || []).find(
    (p: any) => p.plugin.slug === slug
  )

  useEffect(() => {
    if (configResponse?.data) {
      setConfigData(configResponse.data)
    }
  }, [configResponse])

  const handleSave = async () => {
    try {
      setIsSaving(true)
      await pluginsApi.updateConfig(slug as string, configData)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save config:', error)
      alert('Failed to save configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (key: string, value: any) => {
    setConfigData(prev => ({ ...prev, [key]: value }))
  }

  if (configLoading) return <div className="p-8 text-center text-gray-500">Loading Configuration...</div>

  if (!installation) {
    return (
      <div className="p-8 text-center">
        <p>Plugin "{slug}" not found or not installed.</p>
        <Button className="mt-4" onClick={() => router.push(`/${locale}/plugins/installed`)}>Back to List</Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <Button variant="outline" onClick={() => router.push(`/${locale}/plugins/installed`)}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Installed Plugins
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Box className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-2xl">{installation.plugin.name}</CardTitle>
              <CardDescription>{installation.plugin.description}</CardDescription>
              <div className="mt-3 flex items-center gap-3">
                <PluginStatusBadge status={installation.status} enabled={installation.enabled} />
                <span className="text-sm text-gray-500">Version: {installation.plugin.version}</span>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configuration
              </CardTitle>
              <CardDescription>Manage plugin-specific settings and parameters</CardDescription>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {saveSuccess && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded-md text-sm font-medium">
              ✓ Configuration saved successfully
            </div>
          )}

          <div className="space-y-6">
            {Object.keys(configData).length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed rounded-lg text-gray-400">
                No configuration keys found for this plugin.
              </div>
            ) : (
              <div className="grid gap-6">
                {Object.entries(configData).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label className="capitalize">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</Label>
                    {typeof value === 'boolean' ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => handleInputChange(key, e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600">Enable {key}</span>
                      </div>
                    ) : typeof value === 'string' && value.length > 50 ? (
                      <Textarea
                        value={value}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        placeholder={`Enter ${key}`}
                      />
                    ) : (
                      <Input
                        value={value}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        placeholder={`Enter ${key}`}
                        type={key.toLowerCase().includes('secret') || key.toLowerCase().includes('key') ? 'password' : 'text'}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
