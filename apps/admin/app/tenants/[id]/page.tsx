/**
 * Tenant Detail Page - Super Admin
 *
 * 详情页承担所有操作：查看、编辑、状态切换、删除
 * 列表页 /tenants 只做入口
 */
'use client'

import { ArrowLeft, Building2, Calendar, Check, CheckCircle, Clock, DollarSign, Mail, Pencil, Phone, ShoppingCart, Trash2, User, X, XCircle } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

import { tenantManagementApi, pluginManagementApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { showSuccess, showError } from '@/lib/utils'
// Removed I18n import

interface TenantDetails {
  id: string
  companyName: string
  contactName: string
  contactEmail: string
  contactPhone?: string
  agencyLevel: 'basic' | 'industry' | 'global'
  // 状态统一使用大写：PENDING/ACTIVE/SUSPENDED/TERMINATED
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED'
  domain?: string
  subdomain?: string
  createdAt: string
  activatedAt?: string
  lastLoginAt?: string
  branding?: {
    logo?: string
    primaryColor?: string
    secondaryColor?: string
  }
  stats: {
    userCount: number
    productCount: number
    orderCount: number
    totalRevenue: number
  }
}

interface StripeSubscription {
  id: string
  status: string
  planId: string
  amount: number
  currency: string
  currentPeriodEnd: string
  createdAt: string
  canceledAt?: string
  usage?: {
    api_calls: {
      current: number
      limit: number
    }
    transactions: {
      current: number
      limit: number
    }
  }
}

interface StripePluginInfo {
  currentPlan: string
  currentSubscription?: StripeSubscription
  subscriptionHistory: StripeSubscription[]
  usage: {
    apiCalls: number
    apiCallsLimit: number
    transactions: number
    transactionsLimit: number
  }
}

// 🆕 Resend Email Plugin Info Interface
interface ResendPluginInfo {
  currentPlan: string
  currentSubscription?: {
    id: string
    status: string
    planId: string
    amount: number
    currency: string
    currentPeriodEnd: string
    createdAt: string
    canceledAt?: string
  }
  usage: {
    apiCalls: number
    apiCallsLimit: number
    emailsSent: number
    emailsSentLimit: number
  }
}

// 🆕 Google OAuth Plugin Info Interface
interface GoogleOAuthPluginInfo {
  currentPlan: string
  currentSubscription?: {
    id: string
    status: string
    planId: string
    amount: number
    currency: string
    currentPeriodEnd: string
    createdAt: string
    canceledAt?: string
  }
  usage: {
    apiCalls: number
    apiCallsLimit: number
    loginAttempts: number
    loginAttemptsLimit: number
  }
}

// 编辑表单接口
interface TenantEditForm {
  companyName: string
  contactName: string
  contactEmail: string
  contactPhone: string
  agencyLevel: string
  domain: string
  subdomain: string
}

export default function TenantDetailPage() {
  // Removed useI18n hook
  const params = useParams()
  const router = useRouter()
  const tenantId = params.id as string

  const [tenant, setTenant] = useState<TenantDetails | null>(null)
  const [stripeInfo, setStripeInfo] = useState<StripePluginInfo | null>(null)
  const [resendInfo, setResendInfo] = useState<ResendPluginInfo | null>(null)
  const [googleOAuthInfo, setGoogleOAuthInfo] = useState<GoogleOAuthPluginInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [stripeLoading, setStripeLoading] = useState(true)
  const [resendLoading, setResendLoading] = useState(true)
  const [googleOAuthLoading, setGoogleOAuthLoading] = useState(true)
  const [showSubscriptionHistory, setShowSubscriptionHistory] = useState(false)
  const [showResendHistory, setShowResendHistory] = useState(false)
  const [showGoogleOAuthHistory, setShowGoogleOAuthHistory] = useState(false)

  // 编辑模式状态
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<TenantEditForm>({
    companyName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    agencyLevel: 'basic',
    domain: '',
    subdomain: ''
  })

  // 删除对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleting, setDeleting] = useState(false)

  // 状态操作对话框
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [statusAction, setStatusAction] = useState<'suspend' | 'terminate' | null>(null)
  const [statusReason, setStatusReason] = useState('')
  const [statusUpdating, setStatusUpdating] = useState(false)

  const fetchTenantDetails = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch real tenant data from API
      const response = await tenantManagementApi.getTenant(tenantId)
      const apiResponse = response.data

      console.log('Tenant API response:', JSON.stringify(apiResponse, null, 2))

      // Extract tenant data from API response (API returns {tenant: {...}})
      const tenantData = apiResponse.tenant || apiResponse

      // Transform API response to match our interface
      const tenant: TenantDetails = {
        id: tenantData.id,
        companyName: tenantData.companyName || tenantData.name || 'Unknown Company',
        contactName: tenantData.contactName || tenantData.contactPerson || 'Unknown Contact',
        contactEmail: tenantData.contactEmail || tenantData.email || 'unknown@example.com',
        contactPhone: tenantData.contactPhone || tenantData.phone,
        agencyLevel: tenantData.agencyLevel || 'basic',
        status: tenantData.status || 'ACTIVE',
        domain: tenantData.domain,
        subdomain: tenantData.subdomain,
        createdAt: tenantData.createdAt || new Date().toISOString(),
        activatedAt: tenantData.activatedAt,
        lastLoginAt: tenantData.lastLoginAt,
        branding: tenantData.branding,
        stats: {
          userCount: tenantData.stats?.userCount || 0,
          productCount: tenantData.stats?.productCount || 0,
          orderCount: tenantData.stats?.orderCount || 0,
          totalRevenue: tenantData.stats?.totalRevenue || 0
        }
      }

      setTenant(tenant)
      // 初始化编辑表单数据
      setFormData({
        companyName: tenant.companyName,
        contactName: tenant.contactName,
        contactEmail: tenant.contactEmail,
        contactPhone: tenant.contactPhone || '',
        agencyLevel: tenant.agencyLevel,
        domain: tenant.domain || '',
        subdomain: tenant.subdomain || ''
      })
    } catch (error) {
      console.error('Failed to fetch tenant details:', error)
      // For all errors (including 404 and network errors), show null state
      // This will display the "Tenant not found" error message
      setTenant(null)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  const fetchStripeInfo = useCallback(async () => {
    try {
      setStripeLoading(true)

      // Use the tenant plugin details API to get complete information including real usage data
      const detailsResponse = await pluginManagementApi.getTenantPluginDetails('stripe', tenantId)
      console.log('Tenant plugin details response:', detailsResponse)

      if (detailsResponse.success && detailsResponse.data) {
        const data = detailsResponse.data

        // Extract current subscription
        const currentSubscription = data.currentSubscription
        if (currentSubscription) {
          const planId = currentSubscription.planId || 'free'
          const currentPlan = planId.charAt(0).toUpperCase() + planId.slice(1)

          // Transform subscription history - keep usage data from backend
          const transformedHistory: StripeSubscription[] = (data.subscriptionHistory || []).map((sub: any) => ({
            id: sub.id,
            status: sub.status,
            planId: sub.planId,
            amount: sub.amount,
            currency: sub.currency,
            currentPeriodEnd: sub.currentPeriodEnd,
            createdAt: sub.createdAt,
            canceledAt: sub.canceledAt,
            usage: sub.usage // Keep usage data from backend
          }))

          // Get real usage data from API response - backend returns currentUsage object
          const currentUsage = data.currentUsage || {}
          const apiCallsData = currentUsage.api_calls || {}
          const transactionsData = currentUsage.transactions || {}

          setStripeInfo({
            currentPlan: currentPlan,
            currentSubscription: {
              id: currentSubscription.id,
              status: currentSubscription.status,
              planId: currentSubscription.planId,
              amount: currentSubscription.amount,
              currency: currentSubscription.currency,
              currentPeriodEnd: currentSubscription.currentPeriodEnd,
              createdAt: currentSubscription.createdAt,
              canceledAt: currentSubscription.canceledAt
            },
            subscriptionHistory: transformedHistory,
            usage: {
              apiCalls: apiCallsData.current || 0,
              apiCallsLimit: apiCallsData.limit || 0,
              transactions: transactionsData.current || 0,
              transactionsLimit: transactionsData.limit || 0
            }
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch Stripe info:', error)
    } finally {
      setStripeLoading(false)
    }
  }, [tenantId])

  // 🆕 Fetch Resend Email Plugin Info
  const fetchResendInfo = useCallback(async () => {
    try {
      setResendLoading(true)

      const detailsResponse = await pluginManagementApi.getTenantPluginDetails('resend', tenantId)
      console.log('Resend plugin details response:', detailsResponse)

      if (detailsResponse.success && detailsResponse.data) {
        const data = detailsResponse.data
        const currentSubscription = data.currentSubscription

        if (currentSubscription) {
          const planId = currentSubscription.planId || 'free'
          const currentPlan = planId.charAt(0).toUpperCase() + planId.slice(1)

          const currentUsage = data.currentUsage || {}
          const apiCallsData = currentUsage.api_calls || {}
          const emailsSentData = currentUsage.emails_sent || {}

          setResendInfo({
            currentPlan: currentPlan,
            currentSubscription: {
              id: currentSubscription.id,
              status: currentSubscription.status,
              planId: currentSubscription.planId,
              amount: currentSubscription.amount,
              currency: currentSubscription.currency,
              currentPeriodEnd: currentSubscription.currentPeriodEnd,
              createdAt: currentSubscription.createdAt,
              canceledAt: currentSubscription.canceledAt
            },
            usage: {
              apiCalls: apiCallsData.current || 0,
              apiCallsLimit: apiCallsData.limit || 0,
              emailsSent: emailsSentData.current || 0,
              emailsSentLimit: emailsSentData.limit || 0
            }
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch Resend info:', error)
    } finally {
      setResendLoading(false)
    }
  }, [tenantId])

  // 🆕 Fetch Google OAuth Plugin Info
  const fetchGoogleOAuthInfo = useCallback(async () => {
    try {
      setGoogleOAuthLoading(true)

      const detailsResponse = await pluginManagementApi.getTenantPluginDetails('google', tenantId)
      console.log('Google OAuth plugin details response:', detailsResponse)

      if (detailsResponse.success && detailsResponse.data) {
        const data = detailsResponse.data
        const currentSubscription = data.currentSubscription

        if (currentSubscription) {
          const planId = currentSubscription.planId || 'free'
          const currentPlan = planId.charAt(0).toUpperCase() + planId.slice(1)

          const currentUsage = data.currentUsage || {}
          const apiCallsData = currentUsage.api_calls || {}
          const loginAttemptsData = currentUsage.login_attempts || {}

          setGoogleOAuthInfo({
            currentPlan: currentPlan,
            currentSubscription: {
              id: currentSubscription.id,
              status: currentSubscription.status,
              planId: currentSubscription.planId,
              amount: currentSubscription.amount,
              currency: currentSubscription.currency,
              currentPeriodEnd: currentSubscription.currentPeriodEnd,
              createdAt: currentSubscription.createdAt,
              canceledAt: currentSubscription.canceledAt
            },
            usage: {
              apiCalls: apiCallsData.current || 0,
              apiCallsLimit: apiCallsData.limit || 0,
              loginAttempts: loginAttemptsData.current || 0,
              loginAttemptsLimit: loginAttemptsData.limit || 0
            }
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch Google OAuth info:', error)
    } finally {
      setGoogleOAuthLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    if (tenantId) {
      fetchTenantDetails()
      fetchStripeInfo()
      fetchResendInfo()
      fetchGoogleOAuthInfo()
    }
  }, [tenantId, fetchTenantDetails, fetchStripeInfo, fetchResendInfo, fetchGoogleOAuthInfo])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'PENDING':
        return <Clock className="h-5 w-5 text-yellow-500" />
      case 'SUSPENDED':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'TERMINATED':
        return <XCircle className="h-5 w-5 text-gray-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    switch (status) {
      case 'ACTIVE':
        return `${baseClasses} bg-green-100 text-green-800`
      case 'PENDING':
        return `${baseClasses} bg-yellow-100 text-yellow-800`
      case 'SUSPENDED':
        return `${baseClasses} bg-red-100 text-red-800`
      case 'TERMINATED':
        return `${baseClasses} bg-gray-100 text-gray-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const getAgencyLevelBadge = (level: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    switch (level) {
      case 'global':
        return `${baseClasses} bg-purple-100 text-purple-800`
      case 'industry':
        return `${baseClasses} bg-blue-100 text-blue-800`
      case 'basic':
        return `${baseClasses} bg-gray-100 text-gray-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 表单输入处理
  const handleInputChange = (field: keyof TenantEditForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!tenant) return

    try {
      setSaving(true)
      await tenantManagementApi.updateTenant(tenant.id, formData)
      showSuccess('Tenant updated successfully')
      setIsEditing(false)
      await fetchTenantDetails() // 刷新数据
    } catch (error) {
      console.error('Failed to update tenant:', error)
      showError('Failed to update tenant')
    } finally {
      setSaving(false)
    }
  }

  // 取消编辑
  const handleCancelEdit = () => {
    if (tenant) {
      setFormData({
        companyName: tenant.companyName,
        contactName: tenant.contactName,
        contactEmail: tenant.contactEmail,
        contactPhone: tenant.contactPhone || '',
        agencyLevel: tenant.agencyLevel,
        domain: tenant.domain || '',
        subdomain: tenant.subdomain || ''
      })
    }
    setIsEditing(false)
  }

  // 激活租户
  const handleActivate = async () => {
    if (!tenant) return

    try {
      setStatusUpdating(true)
      await tenantManagementApi.activateTenant(tenant.id)
      showSuccess('Tenant activated successfully')
      await fetchTenantDetails()
    } catch (error) {
      console.error('Failed to activate tenant:', error)
      showError('Failed to activate tenant')
    } finally {
      setStatusUpdating(false)
    }
  }

  // 打开状态操作对话框
  const openStatusDialog = (action: 'suspend' | 'terminate') => {
    setStatusAction(action)
    setStatusReason('')
    setStatusDialogOpen(true)
  }

  // 执行状态操作（暂停/终止）
  const handleStatusAction = async () => {
    if (!tenant || !statusAction) return

    try {
      setStatusUpdating(true)
      if (statusAction === 'suspend') {
        await tenantManagementApi.suspendTenant(tenant.id, statusReason)
        showSuccess('Tenant suspended successfully')
      } else if (statusAction === 'terminate') {
        await tenantManagementApi.terminateTenant(tenant.id, statusReason)
        showSuccess('Tenant terminated successfully')
      }
      setStatusDialogOpen(false)
      await fetchTenantDetails()
    } catch (error) {
      console.error(`Failed to ${statusAction} tenant:`, error)
      showError(`Failed to ${statusAction} tenant`)
    } finally {
      setStatusUpdating(false)
    }
  }

  // 删除租户
  const handleDelete = async () => {
    if (!tenant) return

    try {
      setDeleting(true)
      await tenantManagementApi.deleteTenant(tenant.id)
      showSuccess('Tenant deleted successfully')
      setDeleteDialogOpen(false)
      router.push('/tenants')
    } catch (error) {
      console.error('Failed to delete tenant:', error)
      showError('Failed to delete tenant')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Tenant not found</p>
        <Button 
          variant="outline" 
          onClick={() => router.push('/tenants')}
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tenants
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            onClick={() => router.push('/tenants')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {tenant.companyName}
            </h1>
            <p className="text-gray-600 mt-2">
              Tenant Details and Management
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* 编辑按钮 */}
          {!isEditing ? (
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Check className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}

          {/* 状态操作按钮 */}
          {!isEditing && (
            <>
              {tenant.status === 'PENDING' && (
                <Button
                  onClick={handleActivate}
                  disabled={statusUpdating}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {statusUpdating ? 'Activating...' : 'Activate'}
                </Button>
              )}

              {tenant.status === 'ACTIVE' && (
                <>
                  <Button
                    onClick={() => openStatusDialog('suspend')}
                    variant="outline"
                    className="text-yellow-600 hover:text-yellow-700"
                  >
                    Suspend
                  </Button>
                  <Button
                    onClick={() => openStatusDialog('terminate')}
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                  >
                    Terminate
                  </Button>
                </>
              )}

              {tenant.status === 'SUSPENDED' && (
                <>
                  <Button
                    onClick={handleActivate}
                    disabled={statusUpdating}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {statusUpdating ? 'Reactivating...' : 'Reactivate'}
                  </Button>
                  <Button
                    onClick={() => openStatusDialog('terminate')}
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                  >
                    Terminate
                  </Button>
                </>
              )}

              {/* 删除按钮 - 只有 SUSPENDED 或 TERMINATED 状态可删除 */}
              {(tenant.status === 'SUSPENDED' || tenant.status === 'TERMINATED') && (
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tenant Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Information - 查看/编辑模式 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building2 className="h-5 w-5 mr-2" />
              Tenant Information
              {isEditing && <span className="ml-2 text-sm text-blue-600">(Editing)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              /* 编辑模式 */
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e) => handleInputChange('companyName', e.target.value)}
                      placeholder="Enter company name"
                      required
                    />
                  </div>

                  <div>
                    <Label>Status</Label>
                    <div className="flex items-center space-x-2 mt-2">
                      {getStatusIcon(tenant.status)}
                      <span className={getStatusBadge(tenant.status)}>
                        {tenant.status}
                      </span>
                      <span className="text-xs text-gray-500">(Use buttons above to change)</span>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="agencyLevel">Agency Level</Label>
                    <Select
                      value={formData.agencyLevel}
                      onValueChange={(value) => handleInputChange('agencyLevel', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select agency level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="industry">Industry</SelectItem>
                        <SelectItem value="global">Global</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="domain">Domain</Label>
                    <Input
                      id="domain"
                      value={formData.domain}
                      onChange={(e) => handleInputChange('domain', e.target.value)}
                      placeholder="Enter custom domain"
                    />
                  </div>

                  <div>
                    <Label htmlFor="subdomain">Subdomain</Label>
                    <Input
                      id="subdomain"
                      value={formData.subdomain}
                      onChange={(e) => handleInputChange('subdomain', e.target.value)}
                      placeholder="Enter subdomain"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-600 mb-3">Contact Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contactName">Contact Name *</Label>
                      <Input
                        id="contactName"
                        value={formData.contactName}
                        onChange={(e) => handleInputChange('contactName', e.target.value)}
                        placeholder="Enter contact person name"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="contactEmail">Contact Email *</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        value={formData.contactEmail}
                        onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                        placeholder="Enter contact email"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="contactPhone">Contact Phone</Label>
                      <Input
                        id="contactPhone"
                        value={formData.contactPhone}
                        onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                        placeholder="Enter contact phone"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* 查看模式 */
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Company Name</label>
                    <p className="text-lg font-semibold text-gray-900">{tenant.companyName}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">Status</label>
                    <div className="flex items-center space-x-2 mt-1">
                      {getStatusIcon(tenant.status)}
                      <span className={getStatusBadge(tenant.status)}>
                        {tenant.status}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">Agency Level</label>
                    <div className="mt-1">
                      <span className={getAgencyLevelBadge(tenant.agencyLevel)}>
                        {tenant.agencyLevel}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">Domain</label>
                    <p className="text-gray-900">{tenant.domain || 'Not configured'}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">Subdomain</label>
                    <p className="text-gray-900">{tenant.subdomain || 'Not configured'}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-600 mb-3">Contact Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900">{tenant.contactName}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900">{tenant.contactEmail}</span>
                    </div>

                    {tenant.contactPhone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-900">{tenant.contactPhone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">{tenant.stats.userCount}</p>
                </div>
                <User className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Products</p>
                  <p className="text-2xl font-bold text-gray-900">{tenant.stats.productCount}</p>
                </div>
                <Building2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{tenant.stats.orderCount}</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(tenant.stats.totalRevenue)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stripe Payment Plugin Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <DollarSign className="h-5 w-5 mr-2" />
              Stripe Payment Plugin
            </div>
            <div className="flex items-center space-x-2">
              {stripeLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              )}
              {stripeInfo && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/plugins/stripe/tenants/${tenantId}`)}
                >
                  Manage Customizations
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stripeLoading ? (
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 animate-pulse"></div>
            </div>
          ) : stripeInfo ? (
            <div className="space-y-6">
              {/* Current Plan */}
              <div>
                <label className="text-sm font-medium text-gray-600">Current Plan</label>
                <div className="mt-2">
                  <Badge
                    variant={
                      stripeInfo.currentPlan === 'Enterprise' ? 'default' :
                      stripeInfo.currentPlan === 'Business' ? 'secondary' :
                      'outline'
                    }
                    className="text-lg px-4 py-1"
                  >
                    {stripeInfo.currentPlan}
                  </Badge>
                </div>
              </div>

              {/* Current Subscription Details */}
              {stripeInfo.currentSubscription && (
                <div className="border-t pt-4">
                  <label className="text-sm font-medium text-gray-600 mb-3 block">
                    {stripeInfo.currentSubscription.status === 'active' ? 'Current Subscription' : 'Latest Subscription (Canceled)'}
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Amount</p>
                      <p className="text-lg font-semibold text-gray-900">
                        ${stripeInfo.currentSubscription.amount.toFixed(2)}/{stripeInfo.currentSubscription.currency}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <Badge variant={stripeInfo.currentSubscription.status === 'active' ? 'default' : 'secondary'}>
                        {stripeInfo.currentSubscription.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">
                        {stripeInfo.currentSubscription.status === 'active' ? 'Renews' : 'Expires'}
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(stripeInfo.currentSubscription.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {stripeInfo.currentSubscription.canceledAt && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">
                        <strong>Canceled on:</strong> {new Date(stripeInfo.currentSubscription.canceledAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Subscription History - Collapsible */}
              {stripeInfo.subscriptionHistory && stripeInfo.subscriptionHistory.length > 0 && (
                <div className="border-t pt-4">
                  <button
                    onClick={() => setShowSubscriptionHistory(!showSubscriptionHistory)}
                    className="flex items-center justify-between w-full text-sm font-medium text-gray-600 mb-3 hover:text-gray-900 transition-colors"
                  >
                    <span>Subscription History ({stripeInfo.subscriptionHistory.length})</span>
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
                      {stripeInfo.subscriptionHistory.map((sub) => (
                        <div key={sub.id} className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                              <p className="text-xs text-gray-500">Plan</p>
                              <p className="text-sm font-medium text-gray-900">
                                {sub.planId.charAt(0).toUpperCase() + sub.planId.slice(1)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Amount</p>
                              <p className="text-sm font-medium text-gray-900">
                                ${sub.amount.toFixed(2)}/{sub.currency}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Status</p>
                              <Badge variant="outline" className="text-xs">
                                {sub.status}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Created</p>
                              <p className="text-sm font-medium text-gray-900">
                                {new Date(sub.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          {sub.canceledAt && (
                            <p className="text-xs text-gray-500 mt-2">
                              Canceled: {new Date(sub.canceledAt).toLocaleDateString()}
                            </p>
                          )}
                          {/* Display usage data if available */}
                          {sub.usage && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-xs text-gray-500 mb-2">Usage During Subscription</p>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <p className="text-xs text-gray-500">API Calls</p>
                                  <p className="text-sm font-medium text-gray-900">
                                    {sub.usage.api_calls.current.toLocaleString()} / {sub.usage.api_calls.limit === -1 ? 'Unlimited' : sub.usage.api_calls.limit.toLocaleString()}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Transactions</p>
                                  <p className="text-sm font-medium text-gray-900">
                                    {sub.usage.transactions.current.toLocaleString()} / {sub.usage.transactions.limit === -1 ? 'Unlimited' : sub.usage.transactions.limit.toLocaleString()}
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

              {/* Usage Statistics */}
              <div className="border-t pt-4">
                <label className="text-sm font-medium text-gray-600 mb-3 block">Usage This Month</label>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">API Calls</span>
                      <span className="text-sm font-medium text-gray-900">
                        {stripeInfo.usage.apiCalls.toLocaleString()} / {stripeInfo.usage.apiCallsLimit === -1 ? 'Unlimited' : stripeInfo.usage.apiCallsLimit.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          stripeInfo.usage.apiCallsLimit === -1 ? 'bg-green-500' :
                          (stripeInfo.usage.apiCalls / stripeInfo.usage.apiCallsLimit) > 0.9 ? 'bg-red-500' :
                          (stripeInfo.usage.apiCalls / stripeInfo.usage.apiCallsLimit) > 0.7 ? 'bg-yellow-500' :
                          'bg-blue-500'
                        }`}
                        style={{
                          width: stripeInfo.usage.apiCallsLimit === -1 ? '100%' :
                            `${Math.min((stripeInfo.usage.apiCalls / stripeInfo.usage.apiCallsLimit) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">Transactions</span>
                      <span className="text-sm font-medium text-gray-900">
                        {stripeInfo.usage.transactions.toLocaleString()} / {stripeInfo.usage.transactionsLimit === -1 ? 'Unlimited' : stripeInfo.usage.transactionsLimit.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          stripeInfo.usage.transactionsLimit === -1 ? 'bg-green-500' :
                          (stripeInfo.usage.transactions / stripeInfo.usage.transactionsLimit) > 0.9 ? 'bg-red-500' :
                          (stripeInfo.usage.transactions / stripeInfo.usage.transactionsLimit) > 0.7 ? 'bg-yellow-500' :
                          'bg-blue-500'
                        }`}
                        style={{
                          width: stripeInfo.usage.transactionsLimit === -1 ? '100%' :
                            `${Math.min((stripeInfo.usage.transactions / stripeInfo.usage.transactionsLimit) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No Stripe plugin information available</p>
              <p className="text-sm text-gray-400 mt-2">
                The tenant has not installed the Stripe Payment plugin yet
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 🆕 Resend Email Plugin Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Mail className="h-5 w-5 mr-2 text-purple-600" />
              Resend Email Plugin
            </div>
            <div className="flex items-center space-x-2">
              {resendLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
              )}
              {resendInfo && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/plugins/resend/tenants/${tenantId}`)}
                >
                  Manage Customizations
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {resendLoading ? (
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 animate-pulse"></div>
            </div>
          ) : resendInfo ? (
            <div className="space-y-6">
              {/* Current Plan */}
              <div>
                <label className="text-sm font-medium text-gray-600">Current Plan</label>
                <div className="mt-2">
                  <Badge
                    variant={
                      resendInfo.currentPlan === 'Enterprise' ? 'default' :
                      resendInfo.currentPlan === 'Business' ? 'secondary' :
                      'outline'
                    }
                    className="text-lg px-4 py-1 bg-purple-100 text-purple-800"
                  >
                    {resendInfo.currentPlan}
                  </Badge>
                </div>
              </div>

              {/* Current Subscription Details */}
              {resendInfo.currentSubscription && (
                <div className="border-t pt-4">
                  <label className="text-sm font-medium text-gray-600 mb-3 block">
                    {resendInfo.currentSubscription.status === 'active' ? 'Current Subscription' : 'Latest Subscription (Canceled)'}
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Amount</p>
                      <p className="text-lg font-semibold text-gray-900">
                        ${resendInfo.currentSubscription.amount.toFixed(2)}/{resendInfo.currentSubscription.currency}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <Badge variant={resendInfo.currentSubscription.status === 'active' ? 'default' : 'secondary'}>
                        {resendInfo.currentSubscription.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">
                        {resendInfo.currentSubscription.status === 'active' ? 'Renews' : 'Expires'}
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(resendInfo.currentSubscription.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {resendInfo.currentSubscription.canceledAt && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">
                        <strong>Canceled on:</strong> {new Date(resendInfo.currentSubscription.canceledAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Usage Statistics - 🎯 Resend 特色指标: emails_sent */}
              <div className="border-t pt-4">
                <label className="text-sm font-medium text-gray-600 mb-3 block">Email Usage This Month</label>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">📧 Emails Sent</span>
                      <span className="text-sm font-medium text-gray-900">
                        {resendInfo.usage.emailsSent.toLocaleString()} / {resendInfo.usage.emailsSentLimit === -1 ? 'Unlimited' : resendInfo.usage.emailsSentLimit.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          resendInfo.usage.emailsSentLimit === -1 ? 'bg-green-500' :
                          (resendInfo.usage.emailsSent / resendInfo.usage.emailsSentLimit) > 0.9 ? 'bg-red-500' :
                          (resendInfo.usage.emailsSent / resendInfo.usage.emailsSentLimit) > 0.7 ? 'bg-yellow-500' :
                          'bg-purple-500'
                        }`}
                        style={{
                          width: resendInfo.usage.emailsSentLimit === -1 ? '100%' :
                            `${Math.min((resendInfo.usage.emailsSent / resendInfo.usage.emailsSentLimit) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">API Calls</span>
                      <span className="text-sm font-medium text-gray-900">
                        {resendInfo.usage.apiCalls.toLocaleString()} / {resendInfo.usage.apiCallsLimit === -1 ? 'Unlimited' : resendInfo.usage.apiCallsLimit.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          resendInfo.usage.apiCallsLimit === -1 ? 'bg-green-500' :
                          (resendInfo.usage.apiCalls / resendInfo.usage.apiCallsLimit) > 0.9 ? 'bg-red-500' :
                          (resendInfo.usage.apiCalls / resendInfo.usage.apiCallsLimit) > 0.7 ? 'bg-yellow-500' :
                          'bg-blue-500'
                        }`}
                        style={{
                          width: resendInfo.usage.apiCallsLimit === -1 ? '100%' :
                            `${Math.min((resendInfo.usage.apiCalls / resendInfo.usage.apiCallsLimit) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No Resend Email plugin information available</p>
              <p className="text-sm text-gray-400 mt-2">
                The tenant has not installed the Resend Email plugin yet
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 🆕 Google OAuth Plugin Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <User className="h-5 w-5 mr-2 text-red-600" />
              Google OAuth Plugin
            </div>
            <div className="flex items-center space-x-2">
              {googleOAuthLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
              )}
              {googleOAuthInfo && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/plugins/google/tenants/${tenantId}`)}
                >
                  Manage Customizations
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {googleOAuthLoading ? (
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 animate-pulse"></div>
            </div>
          ) : googleOAuthInfo ? (
            <div className="space-y-6">
              {/* Current Plan */}
              <div>
                <label className="text-sm font-medium text-gray-600">Current Plan</label>
                <div className="mt-2">
                  <Badge
                    variant={
                      googleOAuthInfo.currentPlan === 'Enterprise' ? 'default' :
                      googleOAuthInfo.currentPlan === 'Business' ? 'secondary' :
                      'outline'
                    }
                    className="text-lg px-4 py-1 bg-red-100 text-red-800"
                  >
                    {googleOAuthInfo.currentPlan}
                  </Badge>
                </div>
              </div>

              {/* Current Subscription Details */}
              {googleOAuthInfo.currentSubscription && (
                <div className="border-t pt-4">
                  <label className="text-sm font-medium text-gray-600 mb-3 block">
                    {googleOAuthInfo.currentSubscription.status === 'active' ? 'Current Subscription' : 'Latest Subscription (Canceled)'}
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Amount</p>
                      <p className="text-lg font-semibold text-gray-900">
                        ${googleOAuthInfo.currentSubscription.amount.toFixed(2)}/{googleOAuthInfo.currentSubscription.currency}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <Badge variant={googleOAuthInfo.currentSubscription.status === 'active' ? 'default' : 'secondary'}>
                        {googleOAuthInfo.currentSubscription.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">
                        {googleOAuthInfo.currentSubscription.status === 'active' ? 'Renews' : 'Expires'}
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(googleOAuthInfo.currentSubscription.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {googleOAuthInfo.currentSubscription.canceledAt && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">
                        <strong>Canceled on:</strong> {new Date(googleOAuthInfo.currentSubscription.canceledAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Usage Statistics - 🎯 Google OAuth 特色指标: login_attempts */}
              <div className="border-t pt-4">
                <label className="text-sm font-medium text-gray-600 mb-3 block">Authentication Usage This Month</label>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">🔐 Login Attempts</span>
                      <span className="text-sm font-medium text-gray-900">
                        {googleOAuthInfo.usage.loginAttempts.toLocaleString()} / {googleOAuthInfo.usage.loginAttemptsLimit === -1 ? 'Unlimited' : googleOAuthInfo.usage.loginAttemptsLimit.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          googleOAuthInfo.usage.loginAttemptsLimit === -1 ? 'bg-green-500' :
                          (googleOAuthInfo.usage.loginAttempts / googleOAuthInfo.usage.loginAttemptsLimit) > 0.9 ? 'bg-red-500' :
                          (googleOAuthInfo.usage.loginAttempts / googleOAuthInfo.usage.loginAttemptsLimit) > 0.7 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{
                          width: googleOAuthInfo.usage.loginAttemptsLimit === -1 ? '100%' :
                            `${Math.min((googleOAuthInfo.usage.loginAttempts / googleOAuthInfo.usage.loginAttemptsLimit) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">API Calls</span>
                      <span className="text-sm font-medium text-gray-900">
                        {googleOAuthInfo.usage.apiCalls.toLocaleString()} / {googleOAuthInfo.usage.apiCallsLimit === -1 ? 'Unlimited' : googleOAuthInfo.usage.apiCallsLimit.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          googleOAuthInfo.usage.apiCallsLimit === -1 ? 'bg-green-500' :
                          (googleOAuthInfo.usage.apiCalls / googleOAuthInfo.usage.apiCallsLimit) > 0.9 ? 'bg-red-500' :
                          (googleOAuthInfo.usage.apiCalls / googleOAuthInfo.usage.apiCallsLimit) > 0.7 ? 'bg-yellow-500' :
                          'bg-blue-500'
                        }`}
                        style={{
                          width: googleOAuthInfo.usage.apiCallsLimit === -1 ? '100%' :
                            `${Math.min((googleOAuthInfo.usage.apiCalls / googleOAuthInfo.usage.apiCallsLimit) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No Google OAuth plugin information available</p>
              <p className="text-sm text-gray-400 mt-2">
                The tenant has not installed the Google OAuth plugin yet
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full"></div>
              <div>
                <p className="text-sm font-medium text-gray-900">Tenant Created</p>
                <p className="text-sm text-gray-500">{formatDate(tenant.createdAt)}</p>
              </div>
            </div>

            {tenant.activatedAt && (
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Tenant Activated</p>
                  <p className="text-sm text-gray-500">{formatDate(tenant.activatedAt)}</p>
                </div>
              </div>
            )}

            {tenant.lastLoginAt && (
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-2 h-2 bg-gray-400 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Last Login</p>
                  <p className="text-sm text-gray-500">{formatDate(tenant.lastLoginAt)}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 状态操作对话框 (暂停/终止) */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusAction === 'suspend' ? 'Suspend Tenant' : 'Terminate Tenant'}
            </DialogTitle>
            <DialogDescription>
              {statusAction === 'suspend'
                ? 'Suspending a tenant will temporarily disable their access. All users under this tenant will be affected.'
                : 'Terminating a tenant is a serious action. The tenant will lose access permanently. This action cannot be easily undone.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="statusReason">Reason {statusAction === 'terminate' ? '*' : '(optional)'}</Label>
              <Input
                id="statusReason"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder={`Enter reason for ${statusAction === 'suspend' ? 'suspension' : 'termination'}`}
                required={statusAction === 'terminate'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)} disabled={statusUpdating}>
              Cancel
            </Button>
            <Button
              onClick={handleStatusAction}
              disabled={statusUpdating || (statusAction === 'terminate' && !statusReason)}
              className={statusAction === 'suspend' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {statusUpdating
                ? (statusAction === 'suspend' ? 'Suspending...' : 'Terminating...')
                : (statusAction === 'suspend' ? 'Suspend Tenant' : 'Terminate Tenant')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Tenant</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this tenant? This action cannot be undone.
              All data associated with this tenant will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> Deleting tenant "{tenant.companyName}" will remove:
              </p>
              <ul className="text-sm text-red-700 mt-2 list-disc list-inside">
                <li>All user accounts ({tenant.stats.userCount} users)</li>
                <li>All products ({tenant.stats.productCount} products)</li>
                <li>All orders ({tenant.stats.orderCount} orders)</li>
                <li>All plugin subscriptions and configurations</li>
              </ul>
            </div>
            <div>
              <Label htmlFor="deleteReason">Reason for deletion (optional)</Label>
              <Input
                id="deleteReason"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Enter reason for deletion"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete Tenant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
