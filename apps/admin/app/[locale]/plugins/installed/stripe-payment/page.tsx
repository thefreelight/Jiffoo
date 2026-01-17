'use client'

import { ArrowLeft, CreditCard, Settings as Cog6ToothIcon } from 'lucide-react'
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

const PLUGIN_SLUG = 'stripe-payment'

export default function StripePaymentPluginPage() {
  const router = useRouter()
  const t = useT()
  const locale = useLocale()
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const [publishableKey, setPublishableKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [secretKeyVisible, setSecretKeyVisible] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const { data: configResponse, isLoading: configLoading } = usePluginConfig(PLUGIN_SLUG)
  const { data: installedData } = useInstalledPlugins()

  const installation = (installedData?.plugins || []).find(
    (p: any) => p.plugin.slug === PLUGIN_SLUG
  )

  useEffect(() => {
    if (configResponse?.data) {
      const config = configResponse.data
      if (config.publishableKey) setPublishableKey(config.publishableKey)
      if (config.secretKey) setSecretKey(config.secretKey)
      if (config.webhookSecret) setWebhookSecret(config.webhookSecret)
    }
  }, [configResponse])

  const handleSave = async () => {
    try {
      setIsSaving(true)
      await pluginsApi.updateConfig(PLUGIN_SLUG, {
        publishableKey,
        secretKey,
        webhookSecret,
      })
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 3000)
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
            <div className="p-3 bg-purple-100 rounded-lg"><CreditCard className="w-8 h-8 text-purple-600" /></div>
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
          <CardDescription>Configure Stripe API settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label>Publishable Key</Label>
              <Input className="mt-1" value={publishableKey} onChange={(e) => setPublishableKey(e.target.value)} placeholder="pk_test_..." />
            </div>
            <div>
              <Label>Secret Key</Label>
              <div className="relative mt-1">
                <Input type={secretKeyVisible ? 'text' : 'password'} value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder="sk_test_..." />
                <Button variant="ghost" size="sm" className="absolute right-0 top-0" onClick={() => setSecretKeyVisible(!secretKeyVisible)}>
                  {secretKeyVisible ? 'Hide' : 'Show'}
                </Button>
              </div>
            </div>
            <div>
              <Label>Webhook Secret</Label>
              <Input className="mt-1" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder="whsec_..." />
            </div>
          </div>

          {isSaved && <p className="text-green-600 text-sm font-medium">✓ Configuration saved successfully</p>}
          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
