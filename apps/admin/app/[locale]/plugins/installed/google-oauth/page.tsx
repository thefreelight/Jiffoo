'use client'

import { ArrowLeft, User, Settings as Cog6ToothIcon } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PluginStatusBadge } from '@/components/plugins/PluginStatusBadge'
import { usePluginConfig, useUpdatePluginConfig, useInstalledPlugins } from '@/lib/hooks/use-api'
import { pluginsApi } from '@/lib/api'
import { useT, useLocale } from 'shared/src/i18n/react'

const PLUGIN_SLUG = 'google-oauth'

export default function GoogleOAuthPluginPage() {
  const router = useRouter()
  const t = useT()
  const locale = useLocale()
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const [oauthMode, setOauthMode] = useState('platform')
  const [oauthClientId, setOauthClientId] = useState('')
  const [oauthClientSecret, setOauthClientSecret] = useState('')
  const [oauthRedirectUri, setOauthRedirectUri] = useState('')
  const [oauthClientSecretVisible, setOauthClientSecretVisible] = useState(false)
  const [oauthSaved, setOauthSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const { data: configResponse, isLoading: configLoading } = usePluginConfig(PLUGIN_SLUG)
  const { data: installedData } = useInstalledPlugins()

  const installation = (installedData?.plugins || []).find(
    (p: any) => p.plugin.slug === PLUGIN_SLUG
  )

  useEffect(() => {
    if (configResponse?.data) {
      const config = configResponse.data
      if (config.mode) setOauthMode(config.mode)
      if (config.googleClientId) setOauthClientId(config.googleClientId)
      if (config.googleClientSecret) setOauthClientSecret(config.googleClientSecret)
      if (config.googleRedirectUri) setOauthRedirectUri(config.googleRedirectUri)
    }
  }, [configResponse])

  const handleSave = async () => {
    try {
      setIsSaving(true)
      await pluginsApi.updateConfig(PLUGIN_SLUG, {
        mode: oauthMode,
        googleClientId: oauthMode === 'byok' ? oauthClientId : undefined,
        googleClientSecret: oauthMode === 'byok' ? oauthClientSecret : undefined,
        googleRedirectUri: oauthMode === 'byok' ? oauthRedirectUri : undefined,
      })
      setOauthSaved(true)
      setTimeout(() => setOauthSaved(false), 3000)
    } catch (error) {
      console.error('Failed to save config:', error)
      alert('Failed to save configuration')
    } finally {
      setIsSaving(false)
    }
  }

  if (configLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>

  if (!installation) {
    return (
      <div className="p-8 text-center">
        <p>Plugin not found.</p>
        <Button onClick={() => router.push(`/${locale}/plugins/installed`)}>Back</Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <Button variant="outline" onClick={() => router.push(`/${locale}/plugins/installed`)}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Installed Plugins
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-lg"><User className="w-8 h-8 text-blue-600" /></div>
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
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Configure Google OAuth settings (Alpha)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Mode</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="mode" checked={oauthMode === 'platform'} onChange={() => setOauthMode('platform')} /> Platform
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="mode" checked={oauthMode === 'byok'} onChange={() => setOauthMode('byok')} /> BYOK
              </label>
            </div>
          </div>

          {oauthMode === 'byok' && (
            <div className="space-y-4">
              <div>
                <Label>Client ID</Label>
                <Input value={oauthClientId} onChange={(e) => setOauthClientId(e.target.value)} />
              </div>
              <div>
                <Label>Client Secret</Label>
                <div className="relative">
                  <Input type={oauthClientSecretVisible ? 'text' : 'password'} value={oauthClientSecret} onChange={(e) => setOauthClientSecret(e.target.value)} />
                  <Button variant="ghost" size="sm" className="absolute right-0 top-0" onClick={() => setOauthClientSecretVisible(!oauthClientSecretVisible)}>
                    {oauthClientSecretVisible ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </div>
              <div>
                <Label>Redirect URI</Label>
                <Input value={oauthRedirectUri} onChange={(e) => setOauthRedirectUri(e.target.value)} />
              </div>
            </div>
          )}

          {oauthSaved && <p className="text-green-600 text-sm font-medium">✓ Configuration saved successfully</p>}
          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
