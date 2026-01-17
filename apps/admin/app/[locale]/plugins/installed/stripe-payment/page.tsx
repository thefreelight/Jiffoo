'use client'

import { AlertTriangle, ArrowLeft, CreditCard, Settings as Cog6ToothIcon } from 'lucide-react'
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
import { pluginsApi, stripePluginApi } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UpgradeConfirmationDialog } from '@/components/plugins/upgrade-confirmation-dialog'
import { DowngradeConfirmationDialog } from '@/components/plugins/downgrade-confirmation-dialog'
import { useT } from 'shared/src/i18n/react'

const PLUGIN_SLUG = 'stripe-payment'

export default function StripePaymentPluginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const [configData, setConfigData] = useState<Record<string, any>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [activeTab, setActiveTab] = useState('subscription')
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

  // BYOK configuration states
  const [byokMode, setByokMode] = useState('platform')
  const [byokSecretKey, setByokSecretKey] = useState('')
  const [byokPublishableKey, setByokPublishableKey] = useState('')
  const [byokWebhookSecret, setByokWebhookSecret] = useState('')
  const [byokSecretKeyVisible, setByokSecretKeyVisible] = useState(false)
  const [byokPublishableKeyVisible, setByokPublishableKeyVisible] = useState(false)
  const [byokWebhookSecretVisible, setByokWebhookSecretVisible] = useState(false)
  const [byokSaved, setByokSaved] = useState(false)

  const { data: configResponse, isLoading: configLoading } = usePluginConfig(PLUGIN_SLUG)
  const { data: installedData } = useInstalledPlugins()
  const updateMutation = useUpdatePluginConfig()

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['plugin-usage', PLUGIN_SLUG],
    queryFn: async () => {
      try {
        const response = await pluginsApi.getPluginUsage(PLUGIN_SLUG)
        return response.data || null
      } catch (error) {
        console.warn('Failed to fetch plugin usage:', error)
        return null
      }
    },
  })

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

      if (data.immediate) {
        return { ...data, type: 'immediate' }
      }

      if (data.requiresPayment) {
        const successUrl = `${window.location.origin}/plugins/installed/stripe?upgrade=success`
        const cancelUrl = `${window.location.origin}/plugins/installed/stripe?upgrade=cancelled`

        const checkoutResponse = await stripePluginApi.createUpgradeCheckout(
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
        console.log('Redirecting to Stripe Checkout:', data.checkoutUrl)
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
      const response = await stripePluginApi.downgradePlan(planId)
      return response.data || response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['plugin-subscription', PLUGIN_SLUG] })
      queryClient.invalidateQueries({ queryKey: ['plugin-usage', PLUGIN_SLUG] })

      if (data && data.immediate) {
        alert('Plan downgraded successfully!')
      } else if (data && data.targetPlan) {
        alert(`Downgrade scheduled! Your plan will change to ${data.targetPlan} on ${new Date(data.effectiveDate).toLocaleDateString()}. You have ${data.daysRemaining} days remaining on your current plan.`)
      } else {
        alert('Downgrade request submitted successfully!')
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
      const response = await stripePluginApi.cancelDowngrade()
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

  // BYOK configuration mutation
  const byokMutation = useMutation({
    mutationFn: async () => {
      if (byokMode === 'byok') {
        if (!byokSecretKey) {
          throw new Error('Please enter your Stripe Secret Key')
        }
        if (!byokPublishableKey) {
          throw new Error('Please enter your Stripe Publishable Key')
        }
      }
      const response = await pluginsApi.updateConfig(PLUGIN_SLUG, {
        mode: byokMode,
        stripeSecretKey: byokMode === 'byok' ? byokSecretKey : undefined,
        stripePublishableKey: byokMode === 'byok' ? byokPublishableKey : undefined,
        stripeWebhookSecret: byokMode === 'byok' ? byokWebhookSecret : undefined,
      })
      return response.data || response
    },
    onSuccess: () => {
      setByokSaved(true)
      alert('Configuration saved successfully!')
      setTimeout(() => setByokSaved(false), 3000)
    },
    onError: (error: any) => {
      console.error('Configuration failed:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save configuration'
      alert(errorMessage)
    },
  })

  const handleUpgradeClick = async (planId: string) => {
    try {
      const response = await stripePluginApi.getUpgradePreview(planId)
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
      isImmediate: planId !== 'free',
      isPaidDowngrade: planId !== 'free' && currentAmount > targetAmount
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

  const handleCancelDowngradeClick = () => {
    setCancelDowngradeDialogOpen(true)
  }

  const handleCancelDowngradeConfirm = () => {
    cancelDowngradeMutation.mutate()
  }

  const handleCancelDowngradeCancel = () => {
    setCancelDowngradeDialogOpen(false)
  }

  const installation = (installedData?.plugins || []).find(
    (p: any) => p.plugin.slug === PLUGIN_SLUG
  )

  useEffect(() => {
    if (configResponse?.configData) {
      setConfigData(configResponse.configData)
      // Initialize BYOK configuration
      const config = configResponse.configData
      if (config.mode) {
        setByokMode(config.mode)
      }
      if (config.stripeSecretKey) {
        setByokSecretKey(config.stripeSecretKey)
      }
      if (config.stripePublishableKey) {
        setByokPublishableKey(config.stripePublishableKey)
      }
      if (config.stripeWebhookSecret) {
        setByokWebhookSecret(config.stripeWebhookSecret)
      }
    }
  }, [configResponse])

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    const upgrade = searchParams.get('upgrade')

    if (sessionId) {
      console.log('Verifying checkout session:', sessionId)

      pluginsApi.verifyCheckoutSession(PLUGIN_SLUG, sessionId)
        .then((response) => {
          console.log('Checkout verification successful:', response)
          setShowSuccessAlert(true)
          setActiveTab('subscription')
          queryClient.invalidateQueries({ queryKey: ['plugin-subscription', PLUGIN_SLUG] })
          queryClient.invalidateQueries({ queryKey: ['plugin-usage', PLUGIN_SLUG] })

          setTimeout(() => {
            setShowSuccessAlert(false)
            router.replace(`/plugins/installed/stripe`)
          }, 5000)
        })
        .catch((error) => {
          console.error('Checkout verification failed:', error)
          setShowCancelAlert(true)
          setActiveTab('subscription')

          setTimeout(() => {
            setShowCancelAlert(false)
            router.replace(`/plugins/installed/stripe`)
          }, 5000)
        })
    } else if (upgrade === 'success') {
      setShowSuccessAlert(true)
      setActiveTab('subscription')
      queryClient.invalidateQueries({ queryKey: ['plugin-subscription', PLUGIN_SLUG] })
      queryClient.invalidateQueries({ queryKey: ['plugin-usage', PLUGIN_SLUG] })

      setTimeout(() => {
        setShowSuccessAlert(false)
        router.replace(`/plugins/installed/stripe`)
      }, 5000)
    } else if (upgrade === 'cancelled') {
      setShowCancelAlert(true)
      setActiveTab('subscription')

      setTimeout(() => {
        setShowCancelAlert(false)
        router.replace(`/plugins/installed/stripe`)
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
          <p className="mt-2 text-gray-600">{getText('merchant.plugins.loadingConfiguration', 'Loading configuration...')}</p>
        </div>
      </div>
    )
  }

  if (!installation) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{getText('merchant.plugins.stripeNotFound', 'Stripe Payment plugin not found or not installed')}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/plugins/installed')}>
            {getText('merchant.plugins.backToInstalled', 'Back to Installed Plugins')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {showSuccessAlert && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">{getText('merchant.plugins.paymentSuccessful', 'Payment Successful!')}</h3>
              <p className="mt-1 text-sm text-green-700">
                {getText('merchant.plugins.subscriptionUpgraded', 'Your subscription has been upgraded successfully. Your new plan is now active.')}
              </p>
            </div>
            <button
              onClick={() => setShowSuccessAlert(false)}
              className="ml-auto flex-shrink-0 text-green-500 hover:text-green-700"
            >
              <span className="sr-only">{getText('common.close', 'Close')}</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {showCancelAlert && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">{getText('merchant.plugins.paymentCancelled', 'Payment Cancelled')}</h3>
              <p className="mt-1 text-sm text-yellow-700">
                {getText('merchant.plugins.paymentCancelledDesc', 'Your payment was cancelled. You can try again anytime by clicking the upgrade button below.')}
              </p>
            </div>
            <button
              onClick={() => setShowCancelAlert(false)}
              className="ml-auto flex-shrink-0 text-yellow-500 hover:text-yellow-700"
            >
              <span className="sr-only">{getText('common.close', 'Close')}</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <Button variant="outline" onClick={() => router.push('/plugins/installed')}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        {getText('merchant.plugins.backToInstalled', 'Back to Installed Plugins')}
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Cog6ToothIcon className="w-8 h-8 text-blue-600" />
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
          {/* BYOK Configuration Section */}
          <Card>
            <CardHeader>
              <CardTitle>{getText('merchant.plugins.apiConfiguration', 'API Configuration')}</CardTitle>
              <CardDescription>
                {getText('merchant.plugins.stripeApiConfigDesc', 'Configure your Stripe API settings (BYOK - Bring Your Own Key)')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="byok-mode">{getText('merchant.plugins.configurationMode', 'Configuration Mode')}</Label>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="mode-platform"
                      name="byok-mode"
                      value="platform"
                      checked={byokMode === 'platform'}
                      onChange={(e) => setByokMode(e.target.value)}
                      className="mr-2"
                    />
                    <label htmlFor="mode-platform" className="text-sm cursor-pointer">
                      <strong>{getText('merchant.plugins.platformMode', 'Platform Mode')}</strong> - {getText('merchant.plugins.platformModeDesc', 'Use shared Stripe API keys')}
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="mode-byok"
                      name="byok-mode"
                      value="byok"
                      checked={byokMode === 'byok'}
                      onChange={(e) => setByokMode(e.target.value)}
                      className="mr-2"
                    />
                    <label htmlFor="mode-byok" className="text-sm cursor-pointer">
                      <strong>{getText('merchant.plugins.byokMode', 'BYOK Mode')}</strong> - {getText('merchant.plugins.byokModeDesc', 'Use your own Stripe API keys')}
                    </label>
                  </div>
                </div>
              </div>

              {byokMode === 'byok' && (
                <>
                  <div>
                    <Label htmlFor="byok-secret-key">{getText('merchant.plugins.stripeSecretKey', 'Stripe Secret Key')}</Label>
                    <div className="mt-1 flex gap-2">
                      <Input
                        id="byok-secret-key"
                        type={byokSecretKeyVisible ? 'text' : 'password'}
                        placeholder="sk_live_your_stripe_secret_key_here"
                        value={byokSecretKey}
                        onChange={(e) => setByokSecretKey(e.target.value)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setByokSecretKeyVisible(!byokSecretKeyVisible)}
                      >
                        {byokSecretKeyVisible ? getText('common.hide', 'Hide') : getText('common.show', 'Show')}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {getText('merchant.plugins.getSecretKeyFrom', 'Get your Secret Key from')} <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Stripe Dashboard</a>
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="byok-publishable-key">{getText('merchant.plugins.stripePublishableKey', 'Stripe Publishable Key')}</Label>
                    <div className="mt-1 flex gap-2">
                      <Input
                        id="byok-publishable-key"
                        type={byokPublishableKeyVisible ? 'text' : 'password'}
                        placeholder="pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={byokPublishableKey}
                        onChange={(e) => setByokPublishableKey(e.target.value)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setByokPublishableKeyVisible(!byokPublishableKeyVisible)}
                      >
                        {byokPublishableKeyVisible ? getText('common.hide', 'Hide') : getText('common.show', 'Show')}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="byok-webhook-secret">{getText('merchant.plugins.stripeWebhookSecret', 'Stripe Webhook Secret (Optional)')}</Label>
                    <div className="mt-1 flex gap-2">
                      <Input
                        id="byok-webhook-secret"
                        type={byokWebhookSecretVisible ? 'text' : 'password'}
                        placeholder="whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={byokWebhookSecret}
                        onChange={(e) => setByokWebhookSecret(e.target.value)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setByokWebhookSecretVisible(!byokWebhookSecretVisible)}
                      >
                        {byokWebhookSecretVisible ? getText('common.hide', 'Hide') : getText('common.show', 'Show')}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {getText('merchant.plugins.webhookSecretDesc', 'Optional: Configure webhook signing secret for enhanced security')}
                    </p>
                  </div>
                </>
              )}

              {byokSaved && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">✓ {getText('merchant.plugins.configSavedSuccess', 'Configuration saved successfully!')}</p>
                </div>
              )}

              <Button
                onClick={() => byokMutation.mutate()}
                disabled={byokMutation.isPending}
                className="w-full"
              >
                {byokMutation.isPending ? getText('common.saving', 'Saving...') : getText('merchant.plugins.saveConfiguration', 'Save Configuration')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="h-5 w-5 mr-2" />
                {getText('merchant.plugins.stripePaymentPlugin', 'Stripe Payment Plugin')}
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
                              {getText('merchant.plugins.subscriptionCancelNotice', 'Your subscription will be canceled at the end of the current billing period.')}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelDowngradeClick}
                            disabled={cancelDowngradeMutation.isPending}
                            className="ml-2 flex-shrink-0"
                          >
                            {cancelDowngradeMutation.isPending ? getText('common.canceling', 'Canceling...') : getText('common.undo', 'Undo')}
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
                                  data.percentage > 90 ? 'bg-red-500' :
                                  data.percentage > 70 ? 'bg-yellow-500' :
                                  'bg-blue-500'
                                }`}
                                style={{
                                  width: data.limit === -1 ? '100%' :
                                    `${Math.min(data.percentage, 100)}%`
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
                                    {sub.planId.charAt(0).toUpperCase() + sub.planId.slice(1)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">{getText('merchant.plugins.amount', 'Amount')}</p>
                                  <p className="text-sm font-medium text-gray-900">
                                    ${sub.amount.toFixed(2)}/{sub.currency}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">{getText('common.status', 'Status')}</p>
                                  <Badge variant="outline" className="text-xs">
                                    {sub.status}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">{getText('common.created', 'Created')}</p>
                                  <p className="text-sm font-medium text-gray-900">
                                    {new Date(sub.createdAt).toLocaleDateString()}
                                  </p>
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
                                      <p className="text-xs text-gray-500">{getText('merchant.plugins.apiCalls', 'API Calls')}</p>
                                      <p className="text-sm font-medium text-gray-900">
                                        {sub.usage.api_calls.current.toLocaleString()} / {sub.usage.api_calls.limit === -1 ? getText('common.unlimited', 'Unlimited') : sub.usage.api_calls.limit.toLocaleString()}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">{getText('merchant.plugins.transactions', 'Transactions')}</p>
                                      <p className="text-sm font-medium text-gray-900">
                                        {sub.usage.transactions.current.toLocaleString()} / {sub.usage.transactions.limit === -1 ? getText('common.unlimited', 'Unlimited') : sub.usage.transactions.limit.toLocaleString()}
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
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-gray-900">{plan.name}</h4>
                                {plan.isCurrent && (
                                  <Badge variant="default" className="text-xs">{getText('common.current', 'Current')}</Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 mt-1">{plan.description}</p>
                            </div>
                            <div>
                              <p className="text-2xl font-bold text-gray-900">
                                ${plan.amount}
                                <span className="text-sm font-normal text-gray-600">/{plan.billingCycle}</span>
                              </p>
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
      </Tabs>

      {upgradePreviewData && (
        <UpgradeConfirmationDialog
          open={upgradeDialogOpen}
          onOpenChange={setUpgradeDialogOpen}
          currentPlan={upgradePreviewData.currentPlan}
          targetPlan={upgradePreviewData.targetPlan}
          upgradePreview={upgradePreviewData.upgradePreview}
          onConfirm={handleUpgradeConfirm}
          onCancel={handleUpgradeCancel}
          isLoading={upgradeMutation.isPending}
        />
      )}

      {downgradePreviewData && (
        <DowngradeConfirmationDialog
          open={downgradeDialogOpen}
          onOpenChange={setDowngradeDialogOpen}
          currentPlan={downgradePreviewData.currentPlan}
          targetPlan={downgradePreviewData.targetPlan}
          currentAmount={downgradePreviewData.currentAmount}
          targetAmount={downgradePreviewData.targetAmount}
          isImmediate={downgradePreviewData.isImmediate}
          isPaidDowngrade={downgradePreviewData.isPaidDowngrade}
          onConfirm={handleDowngradeConfirm}
          onCancel={handleDowngradeCancel}
          isLoading={downgradeMutation.isPending}
        />
      )}

      {/* Cancel Downgrade Confirmation Dialog */}
      <DialogPrimitive.Root open={cancelDowngradeDialogOpen} onOpenChange={setCancelDowngradeDialogOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
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
                onClick={handleCancelDowngradeCancel}
                disabled={cancelDowngradeMutation.isPending}
              >
                {getText('merchant.plugins.keepDowngrade', 'Keep Downgrade')}
              </Button>
              <Button
                onClick={handleCancelDowngradeConfirm}
                disabled={cancelDowngradeMutation.isPending}
              >
                {cancelDowngradeMutation.isPending ? getText('common.canceling', 'Canceling...') : getText('merchant.plugins.cancelDowngrade', 'Cancel Downgrade')}
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

