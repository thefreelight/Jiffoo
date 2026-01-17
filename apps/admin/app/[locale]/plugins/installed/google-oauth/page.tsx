'use client'

/**
 * Google OAuth Plugin Configuration Page
 * Allows tenants to configure Google OAuth settings and manage subscriptions
 */

import { AlertTriangle, ArrowLeft, CreditCard, Eye, Trash2, User, Settings as Cog6ToothIcon } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { PluginStatusBadge } from '@/components/plugins/PluginStatusBadge'
import { usePluginConfig, useUpdatePluginConfig, useInstalledPlugins } from '@/lib/hooks/use-api'
import { pluginsApi, googleOAuthPluginApi } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { X, Search, Users, Shield, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UpgradeConfirmationDialog } from '@/components/plugins/upgrade-confirmation-dialog'
import { DowngradeConfirmationDialog } from '@/components/plugins/downgrade-confirmation-dialog'
import { useT, useLocale } from 'shared/src/i18n/react'

const PLUGIN_SLUG = 'google-oauth'

export default function GoogleOAuthPluginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const t = useT()
  const locale = useLocale()
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const [configData, setConfigData] = useState<Record<string, any>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [activeTab, setActiveTab] = useState('config')
  const [showSuccessAlert, setShowSuccessAlert] = useState(false)
  const [showCancelAlert, setShowCancelAlert] = useState(false)
  const [showSubscriptionHistory, setShowSubscriptionHistory] = useState(false)

  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false)
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<string | null>(null)
  const [upgradePreviewData, setUpgradePreviewData] = useState<any>(null)

  const [downgradeDialogOpen, setDowngradeDialogOpen] = useState(false)
  const [selectedDowngradePlan, setSelectedDowngradePlan] = useState<string | null>(null)
  const [downgradePreviewData, setDowngradePreviewData] = useState<any>(null)

  const [cancelDowngradeDialogOpen, setCancelDowngradeDialogOpen] = useState(false)

  // OAuth configuration states
  const [oauthMode, setOauthMode] = useState('platform')
  const [oauthClientId, setOauthClientId] = useState('')
  const [oauthClientSecret, setOauthClientSecret] = useState('')
  const [oauthRedirectUri, setOauthRedirectUri] = useState('')
  const [oauthClientSecretVisible, setOauthClientSecretVisible] = useState(false)
  const [oauthSaved, setOauthSaved] = useState(false)

  const { data: configResponse, isLoading: configLoading } = usePluginConfig(PLUGIN_SLUG)
  const { data: installedData } = useInstalledPlugins()
  const updateMutation = useUpdatePluginConfig()

  const installation = (installedData?.plugins || []).find(
    (p: any) => p.plugin.slug === PLUGIN_SLUG
  )

  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['plugin-subscription', PLUGIN_SLUG],
    queryFn: async () => {
      try {
        const response = await pluginsApi.getPluginSubscription(PLUGIN_SLUG)
        return response.data || null
      } catch (error) {
        console.warn('Failed to fetch plugin subscription:', error)
        return null
      }
    },
  })

  const upgradeMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await pluginsApi.upgradeSubscription(PLUGIN_SLUG, planId)
      const data = response.data

      if (data.isDowngrade) {
        throw new Error('This is a downgrade. Please use the downgrade button.')
      }

      if (data.requiresPayment) {
        const successUrl = `${window.location.origin}/plugins/installed/google-oauth?upgrade=success`
        const cancelUrl = `${window.location.origin}/plugins/installed/google-oauth?upgrade=cancelled`

        const checkoutResponse = await googleOAuthPluginApi.createUpgradeCheckout(
          data.planDetails.planId,
          successUrl,
          cancelUrl
        )

        const checkoutData = checkoutResponse.data || checkoutResponse

        return {
          ...data,
          type: 'payment',
          checkoutUrl: checkoutData.url || checkoutData.checkoutUrl,
          sessionId: checkoutData.sessionId,
        }
      }

      return { ...data, type: 'proration' }
    },
    onSuccess: (data) => {
      if (data.type === 'immediate') {
        queryClient.invalidateQueries({ queryKey: ['plugin-subscription', PLUGIN_SLUG] })
        queryClient.invalidateQueries({ queryKey: ['plugin-usage', PLUGIN_SLUG] })
        alert('Plan upgraded successfully!')
      } else if (data.type === 'proration') {
        queryClient.invalidateQueries({ queryKey: ['plugin-subscription', PLUGIN_SLUG] })
        queryClient.invalidateQueries({ queryKey: ['plugin-usage', PLUGIN_SLUG] })

        const planName = data.planDetails?.name || 'plan'
        alert(`🎉 Upgrade Complete!\n\nYour ${planName} is now active with:\n• Updated usage limits\n• New features unlocked\n• Immediate access to all benefits\n\nThe page will refresh to show your new plan details.`)

        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else if (data.type === 'payment' && data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }
    },
    onError: (error: any) => {
      console.error('Upgrade failed:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to upgrade subscription'
      alert(errorMessage)
    },
  })

  const downgradeMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await googleOAuthPluginApi.downgradePlan(planId)
      return response.data || response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['plugin-subscription', PLUGIN_SLUG] })
      queryClient.invalidateQueries({ queryKey: ['plugin-usage', PLUGIN_SLUG] })

      if (data && data.immediate) {
        alert('Plan downgraded successfully!')
      } else if (data && data.targetPlan) {
        const planName = data.targetPlan.name || data.targetPlan
        alert(`Downgrade request submitted successfully!`)
      }
    },
    onError: (error: any) => {
      console.error('Downgrade failed:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to downgrade subscription'
      alert(errorMessage)
    },
  })

  const cancelDowngradeMutation = useMutation({
    mutationFn: async () => {
      const response = await googleOAuthPluginApi.cancelDowngrade()
      return response.data || response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['plugin-subscription', PLUGIN_SLUG] })
      queryClient.invalidateQueries({ queryKey: ['plugin-usage', PLUGIN_SLUG] })
      setCancelDowngradeDialogOpen(false)
      alert('Downgrade cancelled successfully! Your subscription will continue.')
    },
    onError: (error: any) => {
      console.error('Cancel downgrade failed:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to cancel downgrade'
      alert(errorMessage)
    },
  })

  // OAuth configuration mutation
  const oauthMutation = useMutation({
    mutationFn: async () => {
      if (oauthMode === 'byok') {
        if (!oauthClientId) {
          throw new Error('Please enter your Google OAuth Client ID')
        }
        if (!oauthClientSecret) {
          throw new Error('Please enter your Google OAuth Client Secret')
        }
      }
      const response = await pluginsApi.updateConfig(PLUGIN_SLUG, {
        mode: oauthMode,
        googleClientId: oauthMode === 'byok' ? oauthClientId : undefined,
        googleClientSecret: oauthMode === 'byok' ? oauthClientSecret : undefined,
        googleRedirectUri: oauthMode === 'byok' ? oauthRedirectUri : undefined,
        customSettings: {}
      })
      return response.data || response
    },
    onSuccess: () => {
      setOauthSaved(true)
      alert('Configuration saved successfully!')
      setTimeout(() => setOauthSaved(false), 3000)
    },
    onError: (error: any) => {
      console.error('Configuration failed:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save configuration'
      alert(errorMessage)
    },
  })

  const handleUpgradeClick = async (planId: string) => {
    try {
      const response = await googleOAuthPluginApi.getUpgradePreview(planId)
      if (response.success && response.data) {
        setUpgradePreviewData(response.data)
        setSelectedUpgradePlan(planId)
        setUpgradeDialogOpen(true)
      } else {
        alert('Failed to get upgrade preview')
      }
    } catch (error: any) {
      console.error('Failed to get upgrade preview:', error)
      alert('Failed to get upgrade preview: ' + (error.message || 'Unknown error'))
    }
  }

  const handleUpgradeConfirm = () => {
    if (selectedUpgradePlan) {
      upgradeMutation.mutate(selectedUpgradePlan)
      setUpgradeDialogOpen(false)
    }
  }

  const handleUpgradeCancel = () => {
    setUpgradeDialogOpen(false)
    setSelectedUpgradePlan(null)
    setUpgradePreviewData(null)
  }

  const handleDowngradeClick = async (planId: string) => {
    const currentPlan = subscriptionData?.subscription?.planId || 'free'
    const currentAmount = subscriptionData?.subscription?.amount || 0
    const targetAmount = subscriptionData?.plans?.find((p: any) => p.planId === planId)?.amount || 0

    const downgradeData = {
      currentPlan,
      targetPlan: planId,
      currentAmount,
      targetAmount,
      effectiveDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }

    setDowngradePreviewData(downgradeData)
    setSelectedDowngradePlan(planId)
    setDowngradeDialogOpen(true)
  }

  const handleDowngradeConfirm = () => {
    if (selectedDowngradePlan) {
      downgradeMutation.mutate(selectedDowngradePlan)
      setDowngradeDialogOpen(false)
    }
  }

  const handleDowngradeCancel = () => {
    setDowngradeDialogOpen(false)
    setSelectedDowngradePlan(null)
    setDowngradePreviewData(null)
  }





  useEffect(() => {
    if (configResponse?.configData) {
      setConfigData(configResponse.configData)
      // Initialize OAuth configuration
      const config = configResponse.configData
      if (config.mode) {
        setOauthMode(config.mode)
      }
      if (config.googleClientId) {
        setOauthClientId(config.googleClientId)
      }
      if (config.googleClientSecret) {
        setOauthClientSecret(config.googleClientSecret)
      }
      if (config.googleRedirectUri) {
        setOauthRedirectUri(config.googleRedirectUri)
      }
    }
  }, [configResponse])

  // Handle URL parameters for upgrade success/cancel
  useEffect(() => {
    const upgrade = searchParams.get('upgrade')
    const sessionId = searchParams.get('session_id')

    if (sessionId) {
      // Verify checkout session
      pluginsApi.verifyCheckoutSession(PLUGIN_SLUG, sessionId)
        .then((response) => {
          console.log('Checkout verification successful:', response)
          setShowSuccessAlert(true)
          setActiveTab('subscription')
          queryClient.invalidateQueries({ queryKey: ['plugin-subscription', PLUGIN_SLUG] })
          queryClient.invalidateQueries({ queryKey: ['plugin-usage', PLUGIN_SLUG] })

          setTimeout(() => {
            setShowSuccessAlert(false)
            router.replace(`/plugins/installed/google-oauth`)
          }, 5000)
        })
        .catch((error) => {
          console.error('Checkout verification failed:', error)
          setShowCancelAlert(true)
          setActiveTab('subscription')

          setTimeout(() => {
            setShowCancelAlert(false)
            router.replace(`/plugins/installed/google-oauth`)
          }, 5000)
        })
    } else if (upgrade === 'success') {
      setShowSuccessAlert(true)
      setActiveTab('subscription')
      queryClient.invalidateQueries({ queryKey: ['plugin-subscription', PLUGIN_SLUG] })
      queryClient.invalidateQueries({ queryKey: ['plugin-usage', PLUGIN_SLUG] })

      setTimeout(() => {
        setShowSuccessAlert(false)
        router.replace(`/plugins/installed/google-oauth`)
      }, 5000)
    } else if (upgrade === 'cancelled') {
      setShowCancelAlert(true)
      setActiveTab('subscription')

      setTimeout(() => {
        setShowCancelAlert(false)
        router.replace(`/plugins/installed/google-oauth`)
      }, 5000)
    }
  }, [searchParams, queryClient, router])

  // Handle URL parameters for upgrade success/cancel
  useEffect(() => {
    const upgrade = searchParams.get('upgrade')
    const sessionId = searchParams.get('session_id')

    if (sessionId) {
      // Verify checkout session
      pluginsApi.verifyCheckoutSession(PLUGIN_SLUG, sessionId)
        .then((response) => {
          console.log('Checkout verification successful:', response)
          setShowSuccessAlert(true)
          setActiveTab('subscription')
          queryClient.invalidateQueries({ queryKey: ['plugin-subscription', PLUGIN_SLUG] })
          queryClient.invalidateQueries({ queryKey: ['plugin-usage', PLUGIN_SLUG] })

          setTimeout(() => {
            setShowSuccessAlert(false)
            router.replace(`/plugins/installed/google-oauth`)
          }, 5000)
        })
        .catch((error) => {
          console.error('Checkout verification failed:', error)
          setShowCancelAlert(true)
          setActiveTab('subscription')

          setTimeout(() => {
            setShowCancelAlert(false)
            router.replace(`/plugins/installed/google-oauth`)
          }, 5000)
        })
    } else if (upgrade === 'success') {
      setShowSuccessAlert(true)
      setActiveTab('subscription')
      queryClient.invalidateQueries({ queryKey: ['plugin-subscription', PLUGIN_SLUG] })
      queryClient.invalidateQueries({ queryKey: ['plugin-usage', PLUGIN_SLUG] })

      setTimeout(() => {
        setShowSuccessAlert(false)
        router.replace(`/plugins/installed/google-oauth`)
      }, 5000)
    } else if (upgrade === 'cancelled') {
      setShowCancelAlert(true)
      setActiveTab('subscription')

      setTimeout(() => {
        setShowCancelAlert(false)
        router.replace(`/plugins/installed/google-oauth`)
      }, 5000)
    }
  }, [searchParams, queryClient, router])

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
        slug: PLUGIN_SLUG,
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
          <p className="mt-2 text-gray-600">{getText('common.loadingConfiguration', 'Loading configuration...')}</p>
        </div>
      </div>
    )
  }

  if (!installation) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{getText('merchant.plugins.googleOAuthNotFound', 'Google OAuth plugin not found or not installed')}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push(`/${locale}/plugins/installed`)}>
            {getText('merchant.plugins.backToInstalledPlugins', 'Back to Installed Plugins')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push(`/${locale}/plugins/installed`)}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        {getText('merchant.plugins.backToInstalledPlugins', 'Back to Installed Plugins')}
      </Button>

      {/* Success Alert */}
      {showSuccessAlert && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">{getText('merchant.plugins.paymentSuccessful', 'Payment Successful!')}</h3>
              <p className="mt-1 text-sm text-green-700">
                {getText('merchant.plugins.subscriptionUpgradedSuccess', 'Your subscription has been upgraded successfully. Your new plan is now active.')}
              </p>
            </div>
            <button
              onClick={() => setShowSuccessAlert(false)}
              className="ml-auto flex-shrink-0 text-green-500 hover:text-green-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Cancel Alert */}
      {showCancelAlert && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{getText('merchant.plugins.paymentCancelled', 'Payment Cancelled')}</h3>
              <p className="mt-1 text-sm text-red-700">
                {getText('merchant.plugins.subscriptionUpgradeCancelled', 'Your subscription upgrade was cancelled. No changes have been made to your account.')}
              </p>
            </div>
            <button
              onClick={() => setShowCancelAlert(false)}
              className="ml-auto flex-shrink-0 text-red-500 hover:text-red-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <User className="w-8 h-8 text-blue-600" />
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
                    {getText('merchant.plugins.version', 'Version')}: {installation.plugin.version}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="config">
            <Cog6ToothIcon className="w-4 h-4 mr-2" />
            {getText('merchant.plugins.configuration', 'Configuration')}
          </TabsTrigger>
          <TabsTrigger value="subscription">
            <CreditCard className="w-4 h-4 mr-2" />
            {getText('merchant.plugins.subscriptionManagement', 'Subscription Management')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          {/* OAuth Configuration Section */}
          <Card>
            <CardHeader>
              <CardTitle>{getText('merchant.plugins.apiConfiguration', 'API Configuration')}</CardTitle>
              <CardDescription>
                {getText('merchant.plugins.googleOAuthApiDesc', 'Configure your Google OAuth API settings (BYOK - Bring Your Own Key)')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="oauth-mode">{getText('merchant.plugins.configurationMode', 'Configuration Mode')}</Label>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="mode-platform"
                      name="oauth-mode"
                      value="platform"
                      checked={oauthMode === 'platform'}
                      onChange={(e) => setOauthMode(e.target.value)}
                      className="mr-2"
                    />
                    <label htmlFor="mode-platform" className="text-sm">
                      {getText('merchant.plugins.platformModeGoogle', "Platform Mode (Recommended) - Use Jiffoo's Google OAuth configuration")}
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="mode-byok"
                      name="oauth-mode"
                      value="byok"
                      checked={oauthMode === 'byok'}
                      onChange={(e) => setOauthMode(e.target.value)}
                      className="mr-2"
                    />
                    <label htmlFor="mode-byok" className="text-sm">
                      {getText('merchant.plugins.byokModeGoogle', 'BYOK Mode - Use your own Google OAuth credentials')}
                    </label>
                  </div>
                </div>
              </div>

              {oauthMode === 'byok' && (
                <>
                  <div>
                    <Label htmlFor="oauth-client-id">{getText('merchant.plugins.googleClientId', 'Google OAuth Client ID')}</Label>
                    <Input
                      id="oauth-client-id"
                      type="text"
                      value={oauthClientId}
                      onChange={(e) => setOauthClientId(e.target.value)}
                      placeholder={getText('merchant.plugins.enterGoogleClientId', 'Enter your Google OAuth Client ID')}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="oauth-client-secret">{getText('merchant.plugins.googleClientSecret', 'Google OAuth Client Secret')}</Label>
                    <div className="relative mt-1">
                      <Input
                        id="oauth-client-secret"
                        type={oauthClientSecretVisible ? 'text' : 'password'}
                        value={oauthClientSecret}
                        onChange={(e) => setOauthClientSecret(e.target.value)}
                        placeholder={getText('merchant.plugins.enterGoogleClientSecret', 'Enter your Google OAuth Client Secret')}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setOauthClientSecretVisible(!oauthClientSecretVisible)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {oauthClientSecretVisible ? (
                          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="oauth-redirect-uri">{getText('merchant.plugins.redirectUri', 'Redirect URI')}</Label>
                    <Input
                      id="oauth-redirect-uri"
                      type="text"
                      value={oauthRedirectUri}
                      onChange={(e) => setOauthRedirectUri(e.target.value)}
                      placeholder="https://yourdomain.com/auth/google/callback"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {getText('merchant.plugins.redirectUriHint', 'This should match the redirect URI configured in your Google OAuth app')}
                    </p>
                  </div>
                </>
              )}

              {oauthSaved && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">✓ {getText('merchant.plugins.configSavedSuccess', 'Configuration saved successfully!')}</p>
                </div>
              )}

              <Button
                onClick={() => oauthMutation.mutate()}
                disabled={oauthMutation.isPending}
                className="w-full"
              >
                {oauthMutation.isPending ? getText('common.saving', 'Saving...') : getText('merchant.plugins.saveConfiguration', 'Save Configuration')}
              </Button>
            </CardContent>
          </Card>

          {/* 🆕 OAuth Users Management Section */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                {getText('merchant.plugins.oauthUsersManagement', 'OAuth Users Management')}
              </CardTitle>
              <CardDescription>
                {getText('merchant.plugins.oauthUsersManagementDesc', 'Manage users who have connected their Google accounts')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OAuthUsersSection pluginSlug={PLUGIN_SLUG} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                {getText('merchant.plugins.googleOAuthPlugin', 'Google OAuth Plugin')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {subscriptionLoading ? (
                <div className="space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                </div>
              ) : subscriptionData && subscriptionData.hasSubscription ? (
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium text-gray-600">{getText('merchant.plugins.currentPlan', 'Current Plan')}</label>
                    <div className="mt-2">
                      <Badge
                        variant={
                          subscriptionData.subscription.planId === 'enterprise' ? 'default' :
                          subscriptionData.subscription.planId === 'business' ? 'secondary' :
                          'outline'
                        }
                        className="text-lg px-4 py-1"
                      >
                        {subscriptionData.subscription.plan?.name || subscriptionData.subscription.planId}
                      </Badge>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-gray-600 mb-3 block">
                      {getText('merchant.plugins.currentSubscription', 'Current Subscription')}
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">{getText('merchant.plugins.amount', 'Amount')}</p>
                        <p className="text-lg font-semibold text-gray-900">
                          ${subscriptionData.subscription.amount.toFixed(2)}/{subscriptionData.subscription.currency}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">{getText('common.status', 'Status')}</p>
                        <Badge variant={subscriptionData.subscription.status === 'active' ? 'default' : 'secondary'}>
                          {subscriptionData.subscription.status}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">{getText('merchant.plugins.renews', 'Renews')}</p>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(subscriptionData.subscription.currentPeriodEnd).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {subscriptionData.subscription.cancelAtPeriodEnd && subscriptionData.pendingChange && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm text-yellow-800">
                              <strong>{getText('merchant.plugins.canceledOn', 'Canceled on')}:</strong> {new Date(subscriptionData.pendingChange.effectiveDate).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-yellow-700 mt-1">
                              {getText('merchant.plugins.subscriptionCancelAtPeriodEnd', 'Your subscription will be canceled at the end of the current billing period.')}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCancelDowngradeDialogOpen(true)}
                            disabled={cancelDowngradeMutation.isPending}
                          >
                            {cancelDowngradeMutation.isPending ? getText('common.canceling', 'Cancelling...') : getText('merchant.plugins.cancelDowngrade', 'Cancel Downgrade')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-gray-600 mb-3 block">{getText('merchant.plugins.usageThisMonth', 'Usage This Month')}</label>
                    {subscriptionData.usage && (
                      <div className="space-y-4">
                        {Object.entries(subscriptionData.usage).map(([metric, data]: [string, any]) => (
                          <div key={metric}>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-600 capitalize">{metric.replace(/_/g, ' ')}</span>
                              <span className="text-sm font-medium text-gray-900">
                                {data.current.toLocaleString()} / {data.limit === -1 ? getText('common.unlimited', 'Unlimited') : data.limit.toLocaleString()}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  data.limit === -1 ? 'bg-green-500' :
                                  data.current / data.limit > 0.8 ? 'bg-red-500' :
                                  data.current / data.limit > 0.6 ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`}
                                style={{
                                  width: data.limit === -1 ? '100%' : `${Math.min((data.current / data.limit) * 100, 100)}%`
                                }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {subscriptionData.subscriptionHistory && subscriptionData.subscriptionHistory.length > 0 && (
                    <div className="border-t pt-4">
                      <button
                        onClick={() => setShowSubscriptionHistory(!showSubscriptionHistory)}
                        className="flex items-center justify-between w-full text-sm font-medium text-gray-600 mb-3 hover:text-gray-900 transition-colors"
                      >
                        <span>{getText('merchant.plugins.subscriptionHistory', 'Subscription History')} ({subscriptionData.subscriptionHistory.length})</span>
                        <svg
                          className={`w-5 h-5 transition-transform ${showSubscriptionHistory ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {showSubscriptionHistory && (
                        <div className="space-y-3 mt-3">
                          {subscriptionData.subscriptionHistory.map((sub: any) => (
                            <div key={sub.id} className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div>
                                  <p className="text-xs text-gray-500">{getText('merchant.plugins.plan', 'Plan')}</p>
                                  <p className="text-sm font-medium text-gray-900">
                                    {sub.plan?.name || sub.planId}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">{getText('merchant.plugins.amount', 'Amount')}</p>
                                  <p className="text-sm font-medium text-gray-900">
                                    ${sub.amount.toFixed(2)}/{sub.currency}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">{getText('merchant.plugins.period', 'Period')}</p>
                                  <p className="text-sm font-medium text-gray-900">
                                    {new Date(sub.startDate).toLocaleDateString()} - {new Date(sub.endDate).toLocaleDateString()}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">{getText('common.status', 'Status')}</p>
                                  <Badge variant={sub.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                                    {sub.status}
                                  </Badge>
                                </div>
                              </div>
                              {sub.canceledAt && (
                                <p className="text-xs text-gray-500 mt-2">
                                  {getText('common.canceled', 'Canceled')}: {new Date(sub.canceledAt).toLocaleDateString()}
                                </p>
                              )}
                              {sub.usage && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <p className="text-xs text-gray-500 mb-2">{getText('merchant.plugins.usageDuringSubscription', 'Usage During Subscription')}</p>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <p className="text-xs text-gray-500">{getText('merchant.plugins.loginAttempts', 'Login Attempts')}</p>
                                      <p className="text-sm font-medium text-gray-900">
                                        {sub.usage.login_attempts.current.toLocaleString()} / {sub.usage.login_attempts.limit === -1 ? getText('common.unlimited', 'Unlimited') : sub.usage.login_attempts.limit.toLocaleString()}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">{getText('merchant.plugins.apiCalls', 'API Calls')}</p>
                                      <p className="text-sm font-medium text-gray-900">
                                        {sub.usage.api_calls.current.toLocaleString()} / {sub.usage.api_calls.limit === -1 ? getText('common.unlimited', 'Unlimited') : sub.usage.api_calls.limit.toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-gray-600 mb-3 block">{getText('merchant.plugins.availablePlans', 'Available Plans')}</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {subscriptionData.availablePlans?.map((plan: any) => (
                        <div
                          key={plan.id}
                          className={`p-4 border rounded-lg ${plan.isCurrent ? 'border-blue-500 border-2 bg-blue-50' : 'bg-gray-50'}`}
                        >
                          <div className="space-y-3">
                            <div>
                              <h3 className="font-semibold text-lg">{plan.name}</h3>
                              <p className="text-2xl font-bold text-blue-600">
                                ${plan.amount.toFixed(2)}
                                <span className="text-sm font-normal text-gray-600">/{plan.currency}</span>
                              </p>
                            </div>
                            <div className="text-sm text-gray-600">
                              <p>• {getText('merchant.plugins.loginAttempts', 'Login Attempts')}: {plan.limits?.login_attempts === -1 ? getText('common.unlimited', 'Unlimited') : plan.limits?.login_attempts?.toLocaleString()}</p>
                              <p>• {getText('merchant.plugins.apiCalls', 'API Calls')}: {plan.limits?.api_calls === -1 ? getText('common.unlimited', 'Unlimited') : plan.limits?.api_calls?.toLocaleString()}</p>
                            </div>
                            {!plan.isCurrent && (
                              <Button
                                className="w-full"
                                size="sm"
                                variant={plan.amount > (subscriptionData.subscription?.amount || 0) ? 'default' : 'outline'}
                                onClick={() => {
                                  const currentAmount = subscriptionData.subscription?.amount || 0
                                  if (plan.amount > currentAmount) {
                                    handleUpgradeClick(plan.planId)
                                  } else {
                                    handleDowngradeClick(plan.planId)
                                  }
                                }}
                                disabled={upgradeMutation.isPending || downgradeMutation.isPending}
                              >
                                {(upgradeMutation.isPending || downgradeMutation.isPending) ? getText('common.processing', 'Processing...') :
                                 plan.amount > (subscriptionData.subscription?.amount || 0) ? getText('merchant.plugins.upgrade', 'Upgrade') : getText('merchant.plugins.downgrade', 'Downgrade')}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">{getText('merchant.plugins.noSubscriptionData', 'No subscription data available')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>{getText('merchant.plugins.pluginConfiguration', 'Plugin Configuration')}</CardTitle>
              <CardDescription>
                {getText('merchant.plugins.pluginConfigurationDesc', 'Configure the Google OAuth plugin settings below. Changes will be saved immediately.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.keys(configData).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">{getText('merchant.plugins.noConfigOptions', 'No configuration options available for this plugin.')}</p>
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
        </TabsContent>
      </Tabs>

      {/* Upgrade Confirmation Dialog */}
      {upgradePreviewData && (
        <UpgradeConfirmationDialog
          open={upgradeDialogOpen}
          onOpenChange={setUpgradeDialogOpen}
          currentPlan={{
            name: upgradePreviewData.currentPlan?.name || subscriptionData?.subscription?.plan?.name || subscriptionData?.subscription?.planId || getText('merchant.plugins.currentPlan', 'Current Plan'),
            amount: upgradePreviewData.currentPlan?.amount || subscriptionData?.subscription?.amount || 0,
            currency: upgradePreviewData.currentPlan?.currency || subscriptionData?.subscription?.currency || 'USD',
            billingCycle: upgradePreviewData.currentPlan?.billingCycle || 'month'
          }}
          targetPlan={{
            name: upgradePreviewData.targetPlan?.name || selectedUpgradePlan || getText('merchant.plugins.targetPlan', 'Target Plan'),
            amount: upgradePreviewData.targetPlan?.amount || 0,
            currency: upgradePreviewData.targetPlan?.currency || 'USD',
            billingCycle: upgradePreviewData.targetPlan?.billingCycle || 'month',
            features: upgradePreviewData.targetPlan?.features || [],
            limits: upgradePreviewData.targetPlan?.limits || {}
          }}
          upgradePreview={upgradePreviewData.upgradePreview || {}}
          onConfirm={handleUpgradeConfirm}
          onCancel={handleUpgradeCancel}
          isLoading={upgradeMutation.isPending}
        />
      )}

      {/* Downgrade Confirmation Dialog */}
      {downgradePreviewData && (
        <DowngradeConfirmationDialog
          open={downgradeDialogOpen}
          onOpenChange={setDowngradeDialogOpen}
          currentPlan={downgradePreviewData.currentPlan?.name || getText('merchant.plugins.currentPlan', 'Current Plan')}
          targetPlan={downgradePreviewData.targetPlan?.name || getText('merchant.plugins.targetPlan', 'Target Plan')}
          currentAmount={downgradePreviewData.currentPlan?.amount || 0}
          targetAmount={downgradePreviewData.targetPlan?.amount || 0}
          isImmediate={true}
          isPaidDowngrade={false}
          onConfirm={handleDowngradeConfirm}
          onCancel={handleDowngradeCancel}
          isLoading={downgradeMutation.isPending}
        />
      )}

      {/* Cancel Downgrade Dialog */}
      <DialogPrimitive.Root open={cancelDowngradeDialogOpen} onOpenChange={setCancelDowngradeDialogOpen}>
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">
              {getText('merchant.plugins.cancelDowngradeQuestion', 'Cancel Downgrade?')}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              {getText('merchant.plugins.cancelDowngradeDesc', 'Are you sure you want to cancel the scheduled downgrade? Your subscription will continue at the current plan.')}
            </DialogPrimitive.Description>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setCancelDowngradeDialogOpen(false)}
              disabled={cancelDowngradeMutation.isPending}
            >
              {getText('merchant.plugins.keepDowngrade', 'Keep Downgrade')}
            </Button>
            <Button
              onClick={() => cancelDowngradeMutation.mutate()}
              disabled={cancelDowngradeMutation.isPending}
            >
              {cancelDowngradeMutation.isPending ? getText('common.canceling', 'Cancelling...') : getText('merchant.plugins.cancelDowngrade', 'Cancel Downgrade')}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Root>
    </div>
  )
}

// 🆕 OAuth Users Management Component
function OAuthUsersSection({ pluginSlug }: { pluginSlug: string }) {
  const t = useT()
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)

  // Query OAuth users
  const { data: oauthUsersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['oauth-users', pluginSlug, searchTerm],
    queryFn: async () => {
      try {
        const response = await googleOAuthPluginApi.getOAuthUsers({
          page: 1,
          limit: 50,
          search: searchTerm || undefined
        })
        return response.data || response
      } catch (error) {
        console.warn('Failed to fetch OAuth users:', error)
        return { data: [], pagination: { total: 0 } }
      }
    },
  })

  // Query OAuth sessions
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['oauth-sessions', pluginSlug],
    queryFn: async () => {
      try {
        const response = await googleOAuthPluginApi.getOAuthSessions()
        return response.data || response
      } catch (error) {
        console.warn('Failed to fetch OAuth sessions:', error)
        return { data: [], total: 0 }
      }
    },
  })

  // Revoke OAuth mutation
  const revokeMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      const response = await googleOAuthPluginApi.revokeOAuthUsers(userIds)
      return response.data || response
    },
    onSuccess: (data) => {
      const successCount = data.summary?.success || 0
      const failedCount = data.summary?.failed || 0

      if (successCount > 0) {
        alert(getText('merchant.plugins.oauthRevokeSuccess', `Successfully revoked OAuth access for ${successCount} user(s)`))
      }
      if (failedCount > 0) {
        alert(getText('merchant.plugins.oauthRevokeFailed', `Failed to revoke OAuth access for ${failedCount} user(s)`))
      }

      setSelectedUsers([])
      setShowRevokeDialog(false)
      refetchUsers()
    },
    onError: (error: any) => {
      alert(getText('merchant.plugins.oauthRevokeError', `Failed to revoke OAuth access: ${error.message}`))
    },
  })

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSelectAll = () => {
    if (selectedUsers.length === oauthUsersData?.data?.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(oauthUsersData?.data?.map((user: any) => user.user.id) || [])
    }
  }

  const handleRevokeSelected = () => {
    if (selectedUsers.length > 0) {
      setShowRevokeDialog(true)
    }
  }

  const confirmRevoke = () => {
    revokeMutation.mutate(selectedUsers)
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-600">{getText('merchant.plugins.oauthUsers', 'OAuth Users')}</p>
              <p className="text-2xl font-bold text-blue-900">
                {oauthUsersData?.pagination?.total || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-600">{getText('merchant.plugins.activeSessions', 'Active Sessions')}</p>
              <p className="text-2xl font-bold text-green-900">
                {sessionsData?.total || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-yellow-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-600">{getText('common.selected', 'Selected')}</p>
              <p className="text-2xl font-bold text-yellow-900">
                {selectedUsers.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder={getText('merchant.plugins.searchUsersPlaceholder', 'Search users by email or username...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={!oauthUsersData?.data?.length}
          >
            {selectedUsers.length === oauthUsersData?.data?.length ? getText('common.deselectAll', 'Deselect All') : getText('common.selectAll', 'Select All')}
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={handleRevokeSelected}
            disabled={selectedUsers.length === 0 || revokeMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {getText('merchant.plugins.revokeSelected', 'Revoke Selected')} ({selectedUsers.length})
          </Button>
        </div>
      </div>

      {/* Users List */}
      <div className="border rounded-lg">
        {usersLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">{getText('merchant.plugins.loadingOAuthUsers', 'Loading OAuth users...')}</p>
          </div>
        ) : oauthUsersData?.data?.length > 0 ? (
          <div className="divide-y">
            {oauthUsersData.data.map((account: any) => (
              <div key={account.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(account.user.id)}
                      onChange={() => handleSelectUser(account.user.id)}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300"
                    />

                    <div className="flex-shrink-0">
                      {account.user.avatar ? (
                        <img
                          src={account.user.avatar}
                          alt={account.user.username}
                          className="h-10 w-10 rounded-full"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <User className="h-6 w-6 text-gray-600" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {account.user.username}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {account.user.email}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {account.user.role}
                        </Badge>
                        <Badge
                          variant={account.hasValidToken ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {account.hasValidToken ? getText('merchant.plugins.activeToken', 'Active Token') : getText('merchant.plugins.expiredToken', 'Expired Token')}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-sm text-gray-500">
                    <p>{getText('merchant.plugins.linked', 'Linked')}: {new Date(account.linkedAt).toLocaleDateString()}</p>
                    <p>{getText('merchant.plugins.googleId', 'Google ID')}: {account.providerId}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>{getText('merchant.plugins.noOAuthUsersFound', 'No OAuth users found')}</p>
            <p className="text-sm mt-1">{getText('merchant.plugins.noOAuthUsersDesc', 'Users will appear here after they connect their Google accounts')}</p>
          </div>
        )}
      </div>

      {/* Revoke Confirmation Dialog */}
      <DialogPrimitive.Root open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
            <div className="flex flex-col space-y-1.5 text-center sm:text-left">
              <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">
                {getText('merchant.plugins.revokeOAuthAccess', 'Revoke OAuth Access')}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground">
                {getText('merchant.plugins.revokeOAuthAccessDesc', `Are you sure you want to revoke OAuth access for ${selectedUsers.length} user(s)? This will disconnect their Google accounts and they will need to re-authorize to use Google login.`)}
              </DialogPrimitive.Description>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowRevokeDialog(false)}
                disabled={revokeMutation.isPending}
              >
                {getText('common.cancel', 'Cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={confirmRevoke}
                disabled={revokeMutation.isPending}
              >
                {revokeMutation.isPending ? getText('merchant.plugins.revoking', 'Revoking...') : getText('merchant.plugins.revokeAccess', 'Revoke Access')}
              </Button>
            </div>
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">{getText('common.close', 'Close')}</span>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  )
}

