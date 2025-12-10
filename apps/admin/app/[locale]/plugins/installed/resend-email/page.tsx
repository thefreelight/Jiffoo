'use client'

import { AlertTriangle, ArrowLeft, CheckCircle, CreditCard, Mail, Settings as Cog6ToothIcon } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { PluginStatusBadge } from '@/components/plugins/PluginStatusBadge'
import { usePluginConfig, useUpdatePluginConfig, useInstalledPlugins } from '@/lib/hooks/use-api'
import { pluginsApi, resendEmailPluginApi } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { UpgradeConfirmationDialog } from '@/components/plugins/upgrade-confirmation-dialog'
import { DowngradeConfirmationDialog } from '@/components/plugins/downgrade-confirmation-dialog'
import { useT } from 'shared/src/i18n'

const PLUGIN_SLUG = 'resend-email'

export default function ResendEmailPluginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const [activeTab, setActiveTab] = useState('configuration')
  const [showSuccessAlert, setShowSuccessAlert] = useState(false)
  const [showCancelAlert, setShowCancelAlert] = useState(false)
  const [showSubscriptionHistory, setShowSubscriptionHistory] = useState(false)

  // Upgrade/Downgrade dialog states
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false)
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<string | null>(null)
  const [upgradePreviewData, setUpgradePreviewData] = useState<any>(null)

  const [downgradeDialogOpen, setDowngradeDialogOpen] = useState(false)
  const [selectedDowngradePlan, setSelectedDowngradePlan] = useState<string | null>(null)
  const [downgradePreviewData, setDowngradePreviewData] = useState<any>(null)

  // Test email states
  const [testEmailTo, setTestEmailTo] = useState('')
  const [testEmailSubject, setTestEmailSubject] = useState('Test Email from Resend')
  const [testEmailHtml, setTestEmailHtml] = useState('<p>This is a test email from Resend plugin.</p>')
  const [testEmailMessageId, setTestEmailMessageId] = useState<string | null>(null)

  // BYOK configuration states
  const [byokMode, setByokMode] = useState('platform')
  const [byokApiKey, setByokApiKey] = useState('')
  const [byokApiKeyVisible, setByokApiKeyVisible] = useState(false)
  const [byokSaved, setByokSaved] = useState(false)

  // Email logs states
  const [emailLogsPage, setEmailLogsPage] = useState(1)
  const [emailLogsLimit, setEmailLogsLimit] = useState(20)
  const [emailLogsStatus, setEmailLogsStatus] = useState<string | undefined>(undefined)

  // Fetch plugin data
  const { data: configResponse, isLoading: configLoading } = usePluginConfig(PLUGIN_SLUG)
  const { data: installedData } = useInstalledPlugins()
  const updateMutation = useUpdatePluginConfig()

  // Usage and subscription queries
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

  // Upgrade mutation
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
        const successUrl = `${window.location.origin}/plugins/installed/resend-email?upgrade=success`
        const cancelUrl = `${window.location.origin}/plugins/installed/resend-email?upgrade=cancelled`

        const checkoutResponse = await resendEmailPluginApi.createUpgradeCheckout(
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
        alert('Plan upgraded successfully!')
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

  // Downgrade mutation
  const downgradeMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await resendEmailPluginApi.downgradePlan(planId)
      return response.data || response
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['plugin-subscription', PLUGIN_SLUG] })
      queryClient.invalidateQueries({ queryKey: ['plugin-usage', PLUGIN_SLUG] })
      alert('Downgrade request submitted successfully!')
    },
    onError: (error: any) => {
      console.error('Downgrade failed:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to downgrade subscription'
      alert(errorMessage)
    },
  })

  // Cancel downgrade mutation
  const cancelDowngradeMutation = useMutation({
    mutationFn: async () => {
      const response = await resendEmailPluginApi.cancelDowngrade()
      return response.data || response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugin-subscription', PLUGIN_SLUG] })
      alert('Downgrade cancelled successfully!')
    },
    onError: (error: any) => {
      console.error('Cancel downgrade failed:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to cancel downgrade'
      alert(errorMessage)
    },
  })

  // Test email mutation
  const testEmailMutation = useMutation({
    mutationFn: async () => {
      if (!testEmailTo) {
        throw new Error('Please enter a recipient email address')
      }
      const response = await resendEmailPluginApi.sendTestEmail(
        testEmailTo,
        testEmailSubject,
        testEmailHtml
      )
      return response.data || response
    },
    onSuccess: (data) => {
      setTestEmailMessageId(data.messageId)
      alert(`Test email sent successfully! Message ID: ${data.messageId}`)
      setTestEmailTo('')
    },
    onError: (error: any) => {
      console.error('Test email failed:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to send test email'
      alert(errorMessage)
    },
  })

  // Email logs query
  const { data: emailLogsResponse, isLoading: emailLogsLoading } = useQuery({
    queryKey: ['email-logs', emailLogsPage, emailLogsLimit, emailLogsStatus],
    queryFn: async () => {
      try {
        const response = await resendEmailPluginApi.getEmailLogs({
          page: emailLogsPage,
          limit: emailLogsLimit,
          status: emailLogsStatus,
          provider: 'resend'
        })
        return response
      } catch (error) {
        console.warn('Failed to fetch email logs:', error)
        return null
      }
    },
  })

  const emailLogsData = emailLogsResponse?.data || []
  const emailLogsPagination = (emailLogsResponse as any)?.pagination

  // BYOK configuration mutation
  const byokMutation = useMutation({
    mutationFn: async () => {
      if (byokMode === 'byok' && !byokApiKey) {
        throw new Error('Please enter your Resend API Key')
      }
      const response = await pluginsApi.updateConfig(PLUGIN_SLUG, {
        mode: byokMode,
        resendApiKey: byokMode === 'byok' ? byokApiKey : undefined,
        customSettings: {}
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

  // Handle upgrade click
  const handleUpgradeClick = async (planId: string) => {
    try {
      const response = await resendEmailPluginApi.getUpgradePreview(planId)
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

  // Handle upgrade confirmation
  const handleUpgradeConfirm = () => {
    if (selectedUpgradePlan) {
      upgradeMutation.mutate(selectedUpgradePlan)
      setUpgradeDialogOpen(false)
    }
  }

  // Handle upgrade cancellation
  const handleUpgradeCancel = () => {
    setUpgradeDialogOpen(false)
    setSelectedUpgradePlan(null)
    setUpgradePreviewData(null)
  }

  // Handle downgrade click
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

  // Handle downgrade confirmation
  const handleDowngradeConfirm = () => {
    if (selectedDowngradePlan) {
      downgradeMutation.mutate(selectedDowngradePlan)
      setDowngradeDialogOpen(false)
    }
  }

  // Handle downgrade cancellation
  const handleDowngradeCancel = () => {
    setDowngradeDialogOpen(false)
    setSelectedDowngradePlan(null)
    setDowngradePreviewData(null)
  }

  // Get installation data
  const plugins = installedData?.plugins || []
  const installation = plugins.find((p: any) => p.plugin.slug === PLUGIN_SLUG)

  if (!installation) {
    return (
      <div className="p-6">
        <Button variant="outline" onClick={() => router.push('/plugins/installed')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {getText('tenant.plugins.backToInstalled', 'Back to Installed Plugins')}
        </Button>
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">{getText('tenant.plugins.resendNotInstalled', 'Resend Email plugin is not installed.')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Success Alert */}
      {showSuccessAlert && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-green-800">{getText('tenant.plugins.paymentSuccessful', 'Payment Successful!')}</h3>
              <p className="mt-1 text-sm text-green-700">
                {getText('tenant.plugins.subscriptionUpgradedSuccess', 'Your subscription has been upgraded successfully.')}
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
                <Mail className="w-8 h-8 text-blue-600" />
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="configuration">
            <Cog6ToothIcon className="w-4 h-4 mr-2" />
            {getText('tenant.plugins.configuration', 'Configuration')}
          </TabsTrigger>
          <TabsTrigger value="subscription">
            <CreditCard className="w-4 h-4 mr-2" />
            {getText('tenant.plugins.subscriptionManagement', 'Subscription Management')}
          </TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-4">
          {/* BYOK Configuration Section */}
          <Card>
            <CardHeader>
              <CardTitle>{getText('tenant.plugins.apiConfiguration', 'API Configuration')}</CardTitle>
              <CardDescription>
                {getText('tenant.plugins.resendApiConfigDesc', 'Configure your Resend API settings (BYOK - Bring Your Own Key)')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="byok-mode">{getText('tenant.plugins.configurationMode', 'Configuration Mode')}</Label>
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
                      <strong>{getText('tenant.plugins.platformMode', 'Platform Mode')}</strong> - {getText('tenant.plugins.resendPlatformModeDesc', 'Use shared Resend API key')}
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
                      <strong>{getText('tenant.plugins.byokMode', 'BYOK Mode')}</strong> - {getText('tenant.plugins.resendByokModeDesc', 'Use your own Resend API key')}
                    </label>
                  </div>
                </div>
              </div>

              {byokMode === 'byok' && (
                <div>
                  <Label htmlFor="byok-api-key">{getText('tenant.plugins.resendApiKey', 'Resend API Key')}</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      id="byok-api-key"
                      type={byokApiKeyVisible ? 'text' : 'password'}
                      placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={byokApiKey}
                      onChange={(e) => setByokApiKey(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setByokApiKeyVisible(!byokApiKeyVisible)}
                    >
                      {byokApiKeyVisible ? getText('common.hide', 'Hide') : getText('common.show', 'Show')}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {getText('tenant.plugins.getApiKeyFrom', 'Get your API key from')} <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Resend Dashboard</a>
                  </p>
                </div>
              )}

              {byokSaved && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">✓ {getText('tenant.plugins.configSavedSuccess', 'Configuration saved successfully!')}</p>
                </div>
              )}

              <Button
                onClick={() => byokMutation.mutate()}
                disabled={byokMutation.isPending}
                className="w-full"
              >
                {byokMutation.isPending ? getText('common.saving', 'Saving...') : getText('tenant.plugins.saveConfiguration', 'Save Configuration')}
              </Button>
            </CardContent>
          </Card>

          {/* Test Email Section */}
          <Card>
            <CardHeader>
              <CardTitle>{getText('tenant.plugins.sendTestEmail', 'Send Test Email')}</CardTitle>
              <CardDescription>
                {getText('tenant.plugins.sendTestEmailDesc', 'Send a test email to verify your Resend configuration')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="test-email-to">{getText('tenant.plugins.recipientEmail', 'Recipient Email')}</Label>
                <Input
                  id="test-email-to"
                  type="email"
                  placeholder="test@example.com"
                  value={testEmailTo}
                  onChange={(e) => setTestEmailTo(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="test-email-subject">{getText('tenant.plugins.subject', 'Subject')}</Label>
                <Input
                  id="test-email-subject"
                  value={testEmailSubject}
                  onChange={(e) => setTestEmailSubject(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="test-email-html">{getText('tenant.plugins.emailContentHtml', 'Email Content (HTML)')}</Label>
                <Textarea
                  id="test-email-html"
                  value={testEmailHtml}
                  onChange={(e) => setTestEmailHtml(e.target.value)}
                  rows={6}
                  className="mt-1 font-mono text-sm"
                />
              </div>

              {testEmailMessageId && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">
                    <strong>{getText('tenant.plugins.messageId', 'Message ID')}:</strong> {testEmailMessageId}
                  </p>
                </div>
              )}

              <Button
                onClick={() => testEmailMutation.mutate()}
                disabled={testEmailMutation.isPending}
                className="w-full"
              >
                {testEmailMutation.isPending ? getText('tenant.plugins.sending', 'Sending...') : getText('tenant.plugins.sendTestEmail', 'Send Test Email')}
              </Button>
            </CardContent>
          </Card>

          {/* Email Logs Section */}
          <Card>
            <CardHeader>
              <CardTitle>{getText('tenant.plugins.emailLogs', 'Email Logs')}</CardTitle>
              <CardDescription>
                {getText('tenant.plugins.emailLogsDesc', 'View your recent email sending history')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="log-status" className="text-xs">{getText('common.status', 'Status')}</Label>
                  <select
                    id="log-status"
                    value={emailLogsStatus || ''}
                    onChange={(e) => {
                      setEmailLogsStatus(e.target.value || undefined)
                      setEmailLogsPage(1)
                    }}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">{getText('tenant.plugins.allStatus', 'All Status')}</option>
                    <option value="delivered">{getText('tenant.plugins.delivered', 'Delivered')}</option>
                    <option value="bounced">{getText('tenant.plugins.bounced', 'Bounced')}</option>
                    <option value="opened">{getText('tenant.plugins.opened', 'Opened')}</option>
                    <option value="clicked">{getText('tenant.plugins.clicked', 'Clicked')}</option>
                    <option value="failed">{getText('tenant.plugins.failed', 'Failed')}</option>
                  </select>
                </div>
              </div>

              {/* Logs Table */}
              {emailLogsLoading ? (
                <div className="space-y-2">
                  <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ) : emailLogsData && Array.isArray(emailLogsData) && emailLogsData.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left py-2 px-2">{getText('tenant.plugins.to', 'To')}</th>
                          <th className="text-left py-2 px-2">{getText('tenant.plugins.subject', 'Subject')}</th>
                          <th className="text-left py-2 px-2">{getText('common.status', 'Status')}</th>
                          <th className="text-left py-2 px-2">{getText('tenant.plugins.sentAt', 'Sent At')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {emailLogsData.map((log: any, idx: number) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-2 text-gray-600">{log.to}</td>
                            <td className="py-2 px-2 text-gray-600 truncate max-w-xs">{log.subject}</td>
                            <td className="py-2 px-2">
                              <Badge
                                variant={
                                  log.status === 'delivered' ? 'default' :
                                  log.status === 'bounced' ? 'destructive' :
                                  log.status === 'failed' ? 'destructive' :
                                  'secondary'
                                }
                              >
                                {log.status}
                              </Badge>
                            </td>
                            <td className="py-2 px-2 text-gray-600 text-xs">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {emailLogsData && emailLogsData.length > 0 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-xs text-gray-600">
                        {getText('tenant.plugins.showingEmailLogs', 'Showing')} {emailLogsData.length} {getText('tenant.plugins.emailLogs', 'email logs')}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEmailLogsPage(Math.max(1, emailLogsPage - 1))}
                          disabled={emailLogsPage === 1}
                        >
                          {getText('common.previous', 'Previous')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEmailLogsPage(emailLogsPage + 1)}
                          disabled={!emailLogsPagination || emailLogsPage >= emailLogsPagination.totalPages}
                        >
                          {getText('common.next', 'Next')}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">{getText('tenant.plugins.noEmailLogsFound', 'No email logs found')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscription Management Tab */}
        <TabsContent value="subscription">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="h-5 w-5 mr-2" />
                {getText('tenant.plugins.resendEmailPlugin', 'Resend Email Plugin')}
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
                  {/* Current Plan */}
                  <div>
                    <label className="text-sm font-medium text-gray-600">{getText('tenant.plugins.currentPlan', 'Current Plan')}</label>
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

                  {/* Current Subscription Details */}
                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-gray-600 mb-3 block">
                      {getText('tenant.plugins.currentSubscription', 'Current Subscription')}
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">{getText('tenant.plugins.amount', 'Amount')}</p>
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
                        <p className="text-sm text-gray-500">{getText('tenant.plugins.renews', 'Renews')}</p>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(subscriptionData.subscription.currentPeriodEnd).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {subscriptionData.subscription.cancelAtPeriodEnd && subscriptionData.pendingChange && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-yellow-800">
                            <strong>{getText('tenant.plugins.canceledOn', 'Canceled on')}:</strong> {new Date(subscriptionData.pendingChange.effectiveDate).toLocaleDateString()}
                          </p>
                          <button
                            onClick={() => cancelDowngradeMutation.mutate()}
                            disabled={cancelDowngradeMutation.isPending}
                            className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {cancelDowngradeMutation.isPending ? getText('common.canceling', 'Cancelling...') : getText('tenant.plugins.cancelDowngrade', 'Cancel Downgrade')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Usage Statistics */}
                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-gray-600 mb-3 block">{getText('tenant.plugins.usageThisMonth', 'Usage This Month')}</label>
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

                  {/* Subscription History - Collapsible */}
                  {subscriptionData.subscriptionHistory && subscriptionData.subscriptionHistory.length > 0 && (
                    <div className="border-t pt-4">
                      <button
                        onClick={() => setShowSubscriptionHistory(!showSubscriptionHistory)}
                        className="flex items-center justify-between w-full text-sm font-medium text-gray-600 mb-3 hover:text-gray-900 transition-colors"
                      >
                        <span>{getText('tenant.plugins.subscriptionHistory', 'Subscription History')} ({subscriptionData.subscriptionHistory.length})</span>
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
                                  <p className="text-xs text-gray-500">{getText('tenant.plugins.plan', 'Plan')}</p>
                                  <p className="text-sm font-medium text-gray-900">
                                    {sub.planId.charAt(0).toUpperCase() + sub.planId.slice(1)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">{getText('tenant.plugins.amount', 'Amount')}</p>
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
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Available Plans */}
                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-gray-600 mb-3 block">{getText('tenant.plugins.availablePlans', 'Available Plans')}</label>
                    {subscriptionData.availablePlans && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {subscriptionData.availablePlans.map((plan: any) => (
                          <div key={plan.planId} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-semibold text-lg">{plan.name}</h3>
                              {plan.planId === subscriptionData.subscription.planId && (
                                <Badge variant="default" className="text-xs">{getText('common.current', 'Current')}</Badge>
                              )}
                            </div>
                            <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                            <p className="text-2xl font-bold mb-4">
                              ${plan.amount.toFixed(2)}
                              <span className="text-sm text-gray-600 font-normal">/{getText('tenant.plugins.monthly', 'monthly')}</span>
                            </p>
                            <ul className="space-y-2 mb-4 text-sm text-gray-600">
                              {plan.features?.map((feature: string, idx: number) => (
                                <li key={idx}>✓ {feature}</li>
                              ))}
                            </ul>
                            {plan.planId === subscriptionData.subscription.planId ? (
                              <Button disabled className="w-full">{getText('tenant.plugins.currentPlan', 'Current Plan')}</Button>
                            ) : plan.amount > subscriptionData.subscription.amount ? (
                              <Button onClick={() => handleUpgradeClick(plan.planId)} className="w-full">
                                {getText('tenant.plugins.upgrade', 'Upgrade')}
                              </Button>
                            ) : (
                              <Button variant="outline" onClick={() => handleDowngradeClick(plan.planId)} className="w-full">
                                {getText('tenant.plugins.downgrade', 'Downgrade')}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-gray-600">{getText('tenant.plugins.noSubscriptionData', 'No subscription data available.')}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
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
    </div>
  )
}

