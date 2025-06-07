'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeftIcon,
  ShieldCheckIcon,
  CogIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline'
import { apiClient, type AuthProvider } from '@/lib/api-client'

export default function AuthProviderConfigPage() {
  const params = useParams()
  const router = useRouter()
  const providerId = params.providerId as string

  const [provider, setProvider] = useState<AuthProvider | null>(null)
  const [config, setConfig] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showSecrets, setShowSecrets] = useState(false)

  // Load provider data and config
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        console.log('Loading data for provider:', providerId)

        // Load provider info
        const providersResponse = await apiClient.getAuthProviders()
        console.log('Providers response:', providersResponse)

        if (providersResponse.success && providersResponse.data) {
          const foundProvider = providersResponse.data.find(p => p.id === providerId)
          console.log('Found provider:', foundProvider)

          if (foundProvider) {
            setProvider(foundProvider)
          } else {
            console.error('Provider not found:', providerId, 'Available:', providersResponse.data.map(p => p.id))
            setError('Authentication provider not found')
            return
          }
        } else {
          console.error('Failed to load providers:', providersResponse)
          setError('Failed to load authentication providers')
          return
        }

        // Load existing config
        const configResponse = await apiClient.getAuthProviderConfig(providerId)
        console.log('Config response:', configResponse)

        if (configResponse.success && configResponse.data) {
          setConfig(configResponse.data)
        }

      } catch (err) {
        console.error('Failed to load provider config:', err)
        setError('Failed to load provider configuration')
      } finally {
        setLoading(false)
      }
    }

    if (providerId) {
      loadData()
    }
  }, [providerId])

  const handleSaveConfig = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const response = await apiClient.updateAuthProviderConfig(providerId, config)
      if (response.success) {
        setSuccess('Configuration saved successfully!')
        // Reload provider data to get updated status
        const providersResponse = await apiClient.getAuthProviders()
        if (providersResponse.success && providersResponse.data) {
          const updatedProvider = providersResponse.data.find(p => p.id === providerId)
          if (updatedProvider) {
            setProvider(updatedProvider)
          }
        }
      } else {
        setError(response.error || 'Failed to save configuration')
      }
    } catch (err) {
      console.error('Failed to save config:', err)
      setError('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleTestProvider = async () => {
    try {
      setTesting(true)
      setError(null)
      setSuccess(null)

      const response = await apiClient.testAuthProvider(providerId)
      if (response.success && response.data) {
        setSuccess('Test successful! You can now use this authentication provider.')
        // Open auth URL in new tab for testing
        if (response.data.authUrl) {
          window.open(response.data.authUrl, '_blank')
        }
      } else {
        setError(response.error || 'Test failed')
      }
    } catch (err) {
      console.error('Failed to test provider:', err)
      setError('Failed to test provider')
    } finally {
      setTesting(false)
    }
  }

  const getProviderIcon = (providerId: string) => {
    switch (providerId) {
      case 'wechat':
        return '💬'
      case 'google':
        return '🔍'
      case 'github':
        return '🐙'
      case 'facebook':
        return '📘'
      case 'twitter':
        return '🐦'
      default:
        return '🔐'
    }
  }

  const getProviderInstructions = (providerId: string) => {
    switch (providerId) {
      case 'wechat':
        return {
          title: 'WeChat Open Platform Setup',
          steps: [
            'Go to WeChat Open Platform (open.weixin.qq.com)',
            'Create a new application or use existing one',
            'Get your App ID and App Secret from the application settings',
            'Add your redirect URI to the authorized domains',
            'Copy the credentials below'
          ],
          docs: 'https://developers.weixin.qq.com/doc/oplatform/en/Website_App/WeChat_Login/Wechat_Login.html'
        }
      case 'google':
        return {
          title: 'Google Cloud Console Setup',
          steps: [
            'Go to Google Cloud Console (console.cloud.google.com)',
            'Create a new project or select existing one',
            'Enable Google+ API',
            'Create OAuth 2.0 credentials',
            'Add authorized redirect URIs',
            'Copy the Client ID and Client Secret'
          ],
          docs: 'https://developers.google.com/identity/protocols/oauth2'
        }
      case 'github':
        return {
          title: 'GitHub OAuth App Setup',
          steps: [
            'Go to GitHub Settings > Developer settings > OAuth Apps',
            'Click "New OAuth App"',
            'Fill in application details',
            'Set Authorization callback URL',
            'Copy the Client ID and Client Secret'
          ],
          docs: 'https://docs.github.com/en/developers/apps/building-oauth-apps'
        }
      default:
        return {
          title: 'OAuth Provider Setup',
          steps: [
            'Go to your OAuth provider\'s developer console',
            'Create a new application',
            'Configure OAuth settings',
            'Copy the credentials'
          ],
          docs: '#'
        }
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading configuration...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!provider) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Authentication provider not found</p>
            <Link href="/marketplace">
              <Button>Back to Marketplace</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const instructions = getProviderInstructions(providerId)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Link href="/marketplace">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{getProviderIcon(providerId)}</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{provider.name} Configuration</h1>
              <p className="text-gray-600">Configure OAuth 2.0 authentication settings</p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Badge
            className={
              provider.isLicensed
                ? "bg-green-100 text-green-800"
                : provider.isConfigured
                ? "bg-blue-100 text-blue-800"
                : "bg-gray-100 text-gray-800"
            }
          >
            {provider.isLicensed ? 'Licensed' : provider.isConfigured ? 'Configured' : 'Not Configured'}
          </Badge>
          <Badge variant="outline">v{provider.version}</Badge>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <CheckCircleIcon className="w-5 h-5 text-green-500 mr-2" />
            <p className="text-green-700">{success}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configuration Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CogIcon className="w-5 h-5 mr-2" />
                OAuth Configuration
              </CardTitle>
              <CardDescription>
                Configure your {provider.name} OAuth 2.0 credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  value={config.clientId || ''}
                  onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
                  placeholder="Enter your OAuth Client ID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientSecret">Client Secret</Label>
                <div className="relative">
                  <Input
                    id="clientSecret"
                    type={showSecrets ? 'text' : 'password'}
                    value={config.clientSecret || ''}
                    onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
                    placeholder="Enter your OAuth Client Secret"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                    onClick={() => setShowSecrets(!showSecrets)}
                  >
                    {showSecrets ? (
                      <EyeSlashIcon className="w-4 h-4" />
                    ) : (
                      <EyeIcon className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="redirectUri">Redirect URI</Label>
                <Input
                  id="redirectUri"
                  value={config.redirectUri || (typeof window !== 'undefined' ? `${window.location.origin}/auth/${providerId}/callback` : `/auth/${providerId}/callback`)}
                  onChange={(e) => setConfig({ ...config, redirectUri: e.target.value })}
                  placeholder="OAuth redirect URI"
                />
                <p className="text-sm text-gray-500">
                  Copy this URL to your OAuth provider's configuration
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={config.enabled || false}
                  onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                />
                <Label htmlFor="enabled">Enable this authentication provider</Label>
              </div>

              <div className="flex space-x-3 pt-4">
                <Button
                  onClick={handleSaveConfig}
                  disabled={saving || !config.clientId || !config.clientSecret}
                  className="flex-1"
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTestProvider}
                  disabled={testing || !provider.isConfigured}
                >
                  {testing ? 'Testing...' : 'Test'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Setup Instructions</CardTitle>
              <CardDescription>{instructions.title}</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm">
                {instructions.steps.map((step, index) => (
                  <li key={index} className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">
                      {index + 1}
                    </span>
                    <span className="text-gray-700">{step}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-6 pt-4 border-t">
                <a
                  href={instructions.docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  View Official Documentation →
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
