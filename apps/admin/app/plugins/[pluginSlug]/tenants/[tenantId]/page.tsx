'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { pluginManagementApi } from '@/lib/api';
import {
  ArrowLeft,
  Plus,
  Trash2,
  AlertCircle,
  Building2,
  Package,
  Settings,
  TrendingUp,
  Calendar,
  History,
  ChevronDown,
  ChevronRight,
  Clock,
  Activity
} from 'lucide-react';

interface TenantPluginDetails {
  tenant: {
    id: number;
    companyName: string;
    contactEmail: string;
  };
  plugin: {
    id: string;
    name: string;
    slug: string;
  };
  currentSubscription?: {
    id: string;
    planId: string;
    status: string;
    amount: number;
    currency: string;
    currentPeriodEnd: string;
  };
  // 🔧 动态currentUsage对象（支持不同插件的不同指标）
  currentUsage?: Record<string, number> & {
    apiCalls?: number;
    apiCallsLimit?: number;
    transactions?: number;
    transactionsLimit?: number;
    emailsSent?: number;
    emailsSentLimit?: number;
  };
  customizations?: {
    customPricing?: any;
    featureOverrides?: any[];
    usageOverrides?: any[];
  };
}

interface UsageOverride {
  id: string;
  metricName: string;
  limitValue: number;
  reason?: string;
  validFrom?: string;
  validTo?: string;
  createdAt: string;
}

interface SubscriptionChange {
  id: string;
  changeType: string;
  fromPlanId?: string;
  toPlanId?: string;
  fromAmount?: number;
  toAmount?: number;
  effectiveDate: string;
  reason?: string;
  initiatedBy?: string;
  createdAt: string;
}

interface SubscriptionHistoryItem {
  id: string;
  planId: string;
  status: string;
  amount: number;
  currency: string;
  billingCycle: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  canceledAt?: string;
  createdAt: string;
  updatedAt: string;
  changes: SubscriptionChange[];
  usage?: {
    api_calls: number;
    transactions: number;
  };
}

export default function TenantPluginCustomizationPage() {
  const params = useParams();
  const router = useRouter();
  const pluginSlug = params.pluginSlug as string;
  const tenantId = params.tenantId as string;

  const [details, setDetails] = useState<TenantPluginDetails | null>(null);
  const [usageOverrides, setUsageOverrides] = useState<UsageOverride[]>([]);
  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionHistoryItem[]>([]);
  const [expandedSubscriptions, setExpandedSubscriptions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [showFeatureDialog, setShowFeatureDialog] = useState(false);
  const [showUsageDialog, setShowUsageDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showUsageUpdateDialog, setShowUsageUpdateDialog] = useState(false);
  const [showCreateSubscriptionDialog, setShowCreateSubscriptionDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [pricingForm, setPricingForm] = useState({
    planId: '',
    features: '',
    limits: '',
    validFrom: '',
    validTo: '',
    reason: ''
  });

  const [featureForm, setFeatureForm] = useState({
    feature: '',
    enabled: true,
    reason: ''
  });

  const [usageForm, setUsageForm] = useState({
    metricName: '',
    limitValue: '',
    reason: '',
    validFrom: '',
    validTo: ''
  });

  // New form states for subscription management
  const [statusForm, setStatusForm] = useState({
    status: '',
    reason: ''
  });

  const [usageUpdateForm, setUsageUpdateForm] = useState({
    metricName: '',
    action: '',
    value: ''
  });

  // 🔧 动态获取可用的usage指标（根据pluginSlug）
  const getUsageMetrics = () => {
    if (pluginSlug === 'stripe') {
      return [
        { key: 'api_calls', label: 'API Calls' },
        { key: 'transactions', label: '💳 Transactions' }
      ];
    } else if (pluginSlug === 'resend-email') {
      return [
        { key: 'api_calls', label: 'API Calls' },
        { key: 'emails_sent', label: '📧 Emails Sent' }
      ];
    } else if (pluginSlug === 'google-oauth') {
      return [
        { key: 'api_calls', label: 'API Calls' },
        { key: 'login_attempts', label: '🔐 Login Attempts' }
      ];
    }
    // 默认只显示API Calls
    return [
      { key: 'api_calls', label: 'API Calls' }
    ];
  };

  // Create subscription form state
  const [createSubscriptionForm, setCreateSubscriptionForm] = useState({
    planId: '',
    reason: '',
    startDate: '',
    replaceExisting: true
  });

  const loadTenantPluginDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await pluginManagementApi.getTenantPluginDetails(pluginSlug, tenantId);

      if (response.success && response.data) {
        // 🔧 动态转换backend数据（支持不同插件的不同指标）
        const backendData = response.data;
        const transformedData: TenantPluginDetails = {
          tenant: backendData.tenant,
          plugin: backendData.plugin,
          currentSubscription: backendData.currentSubscription,
          currentUsage: backendData.currentUsage ? {
            apiCalls: backendData.currentUsage.api_calls?.current || 0,
            apiCallsLimit: backendData.currentUsage.api_calls?.limit || 0,
            transactions: backendData.currentUsage.transactions?.current || 0,
            transactionsLimit: backendData.currentUsage.transactions?.limit || 0,
            emailsSent: backendData.currentUsage.emails_sent?.current || 0,
            emailsSentLimit: backendData.currentUsage.emails_sent?.limit || 0
          } : undefined,
          customizations: backendData.customizations
        };
        setDetails(transformedData);
      }

      // Load usage overrides
      const overridesResponse = await pluginManagementApi.getUsageOverrides(pluginSlug, tenantId);
      if (overridesResponse.success && overridesResponse.data) {
        setUsageOverrides(overridesResponse.data.overrides || []);
      }

      // Load subscription history
      const historyResponse = await pluginManagementApi.getTenantSubscriptionHistory(pluginSlug, tenantId, {
        includeUsage: true,
        includeChanges: true
      });
      if (historyResponse.success && historyResponse.data) {
        setSubscriptionHistory(historyResponse.data.subscriptionHistory || []);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to load tenant plugin details';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [pluginSlug, tenantId]);

  useEffect(() => {
    loadTenantPluginDetails();
  }, [loadTenantPluginDetails]);

  // 处理订阅详情展开/折叠
  const toggleSubscriptionExpansion = (subscriptionId: string) => {
    const newExpanded = new Set(expandedSubscriptions);
    if (newExpanded.has(subscriptionId)) {
      newExpanded.delete(subscriptionId);
    } else {
      newExpanded.add(subscriptionId);
    }
    setExpandedSubscriptions(newExpanded);
  };

  // 格式化状态显示
  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'default';
      case 'trialing':
        return 'secondary';
      case 'past_due':
        return 'destructive';
      case 'canceled':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  // 格式化变更类型
  const getChangeTypeDisplay = (changeType: string) => {
    switch (changeType) {
      case 'plan_change':
        return 'Plan Change';
      case 'status_change':
        return 'Status Change';
      case 'cancellation':
        return 'Cancellation';
      case 'creation':
        return 'Creation';
      default:
        return changeType;
    }
  };

  const handleCreateCustomPricing = async () => {
    try {
      setSubmitting(true);

      // Convert date strings to ISO 8601 datetime format
      const convertToDateTime = (dateStr: string) => {
        if (!dateStr) return undefined;
        // dateStr is in format YYYY-MM-DD from date input
        // Convert to ISO 8601 datetime: YYYY-MM-DDTHH:mm:ss.sssZ
        return new Date(dateStr + 'T00:00:00Z').toISOString();
      };

      const data: any = {
        planId: pricingForm.planId,
        features: pricingForm.features ? pricingForm.features.split('\n').filter(f => f.trim()) : undefined,
        limits: pricingForm.limits ? JSON.parse(pricingForm.limits) : undefined,
        validFrom: convertToDateTime(pricingForm.validFrom),
        validTo: convertToDateTime(pricingForm.validTo),
        reason: pricingForm.reason || undefined
      };

      const response = await pluginManagementApi.createCustomPricing(pluginSlug, tenantId, data);

      if (response.success) {
        setShowPricingDialog(false);
        setPricingForm({ planId: '', features: '', limits: '', validFrom: '', validTo: '', reason: '' });
        loadTenantPluginDetails();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create custom pricing');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateFeatureOverride = async () => {
    try {
      setSubmitting(true);

      const data = {
        feature: featureForm.feature,
        enabled: featureForm.enabled,
        reason: featureForm.reason || undefined
      };

      const response = await pluginManagementApi.createFeatureOverride(pluginSlug, tenantId, data);

      if (response.success) {
        setShowFeatureDialog(false);
        setFeatureForm({ feature: '', enabled: true, reason: '' });
        loadTenantPluginDetails();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create feature override');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateUsageOverride = async () => {
    try {
      setSubmitting(true);

      // Convert date strings to ISO 8601 datetime format
      const convertToDateTime = (dateStr: string) => {
        if (!dateStr) return undefined;
        // dateStr is in format YYYY-MM-DD from date input
        // Convert to ISO 8601 datetime: YYYY-MM-DDTHH:mm:ss.sssZ
        return new Date(dateStr + 'T00:00:00Z').toISOString();
      };

      const data: any = {
        metricName: usageForm.metricName,
        limitValue: parseInt(usageForm.limitValue),
        reason: usageForm.reason || undefined,
        validFrom: convertToDateTime(usageForm.validFrom),
        validTo: convertToDateTime(usageForm.validTo)
      };

      const response = await pluginManagementApi.createUsageOverride(pluginSlug, tenantId, data);

      if (response.success) {
        setShowUsageDialog(false);
        setUsageForm({ metricName: '', limitValue: '', reason: '', validFrom: '', validTo: '' });
        loadTenantPluginDetails();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create usage override');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUsageOverride = async (overrideId: string) => {
    if (!confirm('Are you sure you want to delete this usage override?')) return;

    try {
      const response = await pluginManagementApi.deleteUsageOverride(pluginSlug, tenantId, overrideId);

      if (response.success) {
        loadTenantPluginDetails();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete usage override');
    }
  };

  // New handlers for subscription management
  const handleUpdateSubscriptionStatus = async () => {
    if (!details?.currentSubscription) return;

    try {
      setSubmitting(true);

      const response = await pluginManagementApi.updateSubscriptionStatus(
        pluginSlug,
        details.currentSubscription.id,
        {
          status: statusForm.status,
          reason: statusForm.reason || undefined
        }
      );

      if (response.success) {
        setShowStatusDialog(false);
        setStatusForm({ status: '', reason: '' });
        loadTenantPluginDetails();
        alert(`Subscription status updated to ${statusForm.status} successfully`);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update subscription status');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSubscriptionUsage = async () => {
    if (!details?.currentSubscription) return;

    if (!usageUpdateForm.metricName || !usageUpdateForm.action) {
      alert('Please fill in all required fields');
      return;
    }

    if (usageUpdateForm.action === 'set' && !usageUpdateForm.value) {
      alert('Please enter a value for set action');
      return;
    }

    try {
      setSubmitting(true);

      const response = await pluginManagementApi.updateSubscriptionUsage(
        pluginSlug,
        details.currentSubscription.id,
        {
          metricName: usageUpdateForm.metricName, // 支持所有插件的指标
          action: usageUpdateForm.action as 'set' | 'reset',
          value: usageUpdateForm.action === 'set' ? parseInt(usageUpdateForm.value) : undefined
        }
      );

      if (response.success) {
        setShowUsageUpdateDialog(false);
        setUsageUpdateForm({ metricName: '', action: '', value: '' });
        loadTenantPluginDetails();
        const actionText = usageUpdateForm.action === 'reset' ? 'reset to 0' : `set to ${usageUpdateForm.value}`;
        alert(`${usageUpdateForm.metricName} ${actionText} successfully`);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update subscription usage');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSubscription = async () => {
    if (!createSubscriptionForm.planId) return;

    try {
      setSubmitting(true);

      const response = await pluginManagementApi.createTenantSubscription(
        pluginSlug,
        tenantId,
        {
          planId: createSubscriptionForm.planId as 'free' | 'business' | 'enterprise',
          reason: createSubscriptionForm.reason || undefined,
          startDate: createSubscriptionForm.startDate || undefined,
          replaceExisting: createSubscriptionForm.replaceExisting
        }
      );

      if (response.success) {
        setShowCreateSubscriptionDialog(false);
        setCreateSubscriptionForm({ planId: '', reason: '', startDate: '', replaceExisting: true });
        loadTenantPluginDetails();
        alert(response.data.message || `Successfully created ${createSubscriptionForm.planId} subscription`);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create subscription');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tenant plugin details...</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error || 'Details not found'}</p>
          <Button onClick={loadTenantPluginDetails} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/plugins/${pluginSlug}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Plugin
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Tenant Plugin Customization</h1>
            <p className="text-gray-600">{details.tenant.companyName} • {details.plugin.name}</p>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tenant</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{details.tenant.companyName}</div>
            <p className="text-xs text-muted-foreground mt-1">{details.tenant.contactEmail}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => router.push(`/tenants/${details.tenant.id}`)}
            >
              View Tenant
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plugin</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{details.plugin.name}</div>
            <p className="text-xs text-muted-foreground mt-1">{details.plugin.slug}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => router.push(`/plugins/${pluginSlug}`)}
            >
              View Plugin
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Subscription</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {details.currentSubscription ? (
              <>
                <div className="text-2xl font-bold">{details.currentSubscription.planId}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  ${details.currentSubscription.amount} {details.currentSubscription.currency.toUpperCase()}
                </p>
                <Badge className="mt-3" variant={details.currentSubscription.status === 'active' ? 'default' : 'secondary'}>
                  {details.currentSubscription.status}
                </Badge>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowStatusDialog(true)}
                  >
                    Update Status
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.push(`/plugins/${pluginSlug}/subscriptions/${details.currentSubscription?.id}`)}
                  >
                    View Details
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  className="w-full mt-2"
                  onClick={() => setShowCreateSubscriptionDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Subscription
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-3">No active subscription</p>
                <Button
                  size="sm"
                  variant="default"
                  className="w-full"
                  onClick={() => setShowCreateSubscriptionDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Subscription
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Current Usage */}
      {details.currentUsage && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Current Usage
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowUsageUpdateDialog(true)}
              disabled={!details.currentSubscription}
            >
              Update Usage
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 🔧 动态渲染usage指标 */}
              {pluginSlug === 'stripe' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-600">API Calls</label>
                    <div className="mt-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{details.currentUsage.apiCalls?.toLocaleString() || 0}</span>
                        <span className="text-gray-500">
                          {details.currentUsage.apiCallsLimit === -1 ? 'Unlimited' : details.currentUsage.apiCallsLimit?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: details.currentUsage.apiCallsLimit === -1
                              ? '0%'
                              : `${Math.min(((details.currentUsage.apiCalls || 0) / (details.currentUsage.apiCallsLimit || 1)) * 100, 100)}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Transactions</label>
                    <div className="mt-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{details.currentUsage.transactions?.toLocaleString() || 0}</span>
                        <span className="text-gray-500">
                          {details.currentUsage.transactionsLimit === -1 ? 'Unlimited' : details.currentUsage.transactionsLimit?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{
                            width: details.currentUsage.transactionsLimit === -1
                              ? '0%'
                              : `${Math.min(((details.currentUsage.transactions || 0) / (details.currentUsage.transactionsLimit || 1)) * 100, 100)}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {pluginSlug === 'resend-email' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-600">API Calls</label>
                    <div className="mt-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{details.currentUsage.apiCalls?.toLocaleString() || 0}</span>
                        <span className="text-gray-500">
                          {details.currentUsage.apiCallsLimit === -1 ? 'Unlimited' : details.currentUsage.apiCallsLimit?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: details.currentUsage.apiCallsLimit === -1
                              ? '0%'
                              : `${Math.min(((details.currentUsage.apiCalls || 0) / (details.currentUsage.apiCallsLimit || 1)) * 100, 100)}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">📧 Emails Sent</label>
                    <div className="mt-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{details.currentUsage.emailsSent?.toLocaleString() || 0}</span>
                        <span className="text-gray-500">
                          {details.currentUsage.emailsSentLimit === -1 ? 'Unlimited' : details.currentUsage.emailsSentLimit?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full"
                          style={{
                            width: details.currentUsage.emailsSentLimit === -1
                              ? '0%'
                              : `${Math.min(((details.currentUsage.emailsSent || 0) / (details.currentUsage.emailsSentLimit || 1)) * 100, 100)}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {pluginSlug === 'google-oauth' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-600">API Calls</label>
                    <div className="mt-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{details.currentUsage.apiCalls?.toLocaleString() || 0}</span>
                        <span className="text-gray-500">
                          {details.currentUsage.apiCallsLimit === -1 ? 'Unlimited' : details.currentUsage.apiCallsLimit?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: details.currentUsage.apiCallsLimit === -1
                              ? '0%'
                              : `${Math.min(((details.currentUsage.apiCalls || 0) / (details.currentUsage.apiCallsLimit || 1)) * 100, 100)}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">🔐 Login Attempts</label>
                    <div className="mt-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span>{details.currentUsage.loginAttempts?.toLocaleString() || 0}</span>
                        <span className="text-gray-500">
                          {details.currentUsage.loginAttemptsLimit === -1 ? 'Unlimited' : details.currentUsage.loginAttemptsLimit?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-red-600 h-2 rounded-full"
                          style={{
                            width: details.currentUsage.loginAttemptsLimit === -1
                              ? '0%'
                              : `${Math.min(((details.currentUsage.loginAttempts || 0) / (details.currentUsage.loginAttemptsLimit || 1)) * 100, 100)}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscription History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <History className="h-5 w-5 mr-2" />
            Subscription History
          </CardTitle>
          <CardDescription>
            Complete history of all subscription changes and usage for this tenant
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscriptionHistory.length > 0 ? (
            <div className="space-y-4">
              {subscriptionHistory.map((subscription, index) => (
                <div key={subscription.id} className="border rounded-lg p-4">
                  {/* Subscription Header */}
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleSubscriptionExpansion(subscription.id)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center">
                        {expandedSubscriptions.has(subscription.id) ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-lg">{subscription.planId}</span>
                          <Badge variant={getStatusBadgeVariant(subscription.status)}>
                            {subscription.status}
                          </Badge>
                          {index === 0 && (
                            <Badge variant="secondary">Current</Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          ${subscription.amount} {subscription.currency} / {subscription.billingCycle}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">
                        <Clock className="h-4 w-4 inline mr-1" />
                        {new Date(subscription.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(subscription.currentPeriodStart).toLocaleDateString()} - {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedSubscriptions.has(subscription.id) && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {/* Basic Info */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-600">Subscription ID</label>
                          <p className="text-sm font-mono bg-gray-100 p-1 rounded">{subscription.id}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600">Status</label>
                          <div className="text-sm">
                            <Badge variant={getStatusBadgeVariant(subscription.status)}>
                              {subscription.status}
                            </Badge>
                            {subscription.canceledAt && (
                              <span className="text-xs text-gray-500 ml-2">
                                Canceled: {new Date(subscription.canceledAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600">Last Updated</label>
                          <p className="text-sm">{new Date(subscription.updatedAt).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {/* Usage Data */}
                      {subscription.usage && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">Usage During This Period</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-blue-50 p-3 rounded-lg">
                              <div className="flex items-center">
                                <Activity className="h-4 w-4 text-blue-600 mr-2" />
                                <span className="text-sm font-medium">API Calls</span>
                              </div>
                              <p className="text-lg font-semibold text-blue-600">
                                {subscription.usage.api_calls.toLocaleString()}
                              </p>
                            </div>
                            <div className="bg-green-50 p-3 rounded-lg">
                              <div className="flex items-center">
                                <Activity className="h-4 w-4 text-green-600 mr-2" />
                                <span className="text-sm font-medium">Transactions</span>
                              </div>
                              <p className="text-lg font-semibold text-green-600">
                                {subscription.usage.transactions.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Change History */}
                      {subscription.changes.length > 0 && (
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-2 block">Change History</label>
                          <div className="space-y-2">
                            {subscription.changes.map((change) => (
                              <div key={change.id} className="bg-gray-50 p-3 rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium">
                                    {getChangeTypeDisplay(change.changeType)}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {new Date(change.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                {change.fromPlanId && change.toPlanId && (
                                  <p className="text-sm text-gray-600">
                                    {change.fromPlanId} → {change.toPlanId}
                                    {change.fromAmount && change.toAmount && (
                                      <span className="ml-2">
                                        (${change.fromAmount} → ${change.toAmount})
                                      </span>
                                    )}
                                  </p>
                                )}
                                {change.reason && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Reason: {change.reason}
                                  </p>
                                )}
                                {change.initiatedBy && (
                                  <p className="text-xs text-gray-500">
                                    Initiated by: {change.initiatedBy}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No subscription history found</p>
              <p className="text-sm text-gray-400">This tenant has no subscription records for this plugin</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customizations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Custom Pricing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Custom Pricing</CardTitle>
            <CardDescription>VIP pricing configuration</CardDescription>
          </CardHeader>
          <CardContent>
            {details.customizations?.customPricing ? (
              <div className="space-y-2">
                <p className="text-sm"><strong>Plan:</strong> {details.customizations.customPricing.planId}</p>
                {details.customizations.customPricing.validTo && (
                  <p className="text-sm text-gray-600">
                    Valid until: {new Date(details.customizations.customPricing.validTo).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No custom pricing</p>
            )}
            <Button
              size="sm"
              className="w-full mt-4"
              onClick={() => setShowPricingDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {details.customizations?.customPricing ? 'Update' : 'Create'} Pricing
            </Button>
          </CardContent>
        </Card>

        {/* Feature Overrides */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Feature Overrides</CardTitle>
            <CardDescription>Force enable/disable features</CardDescription>
          </CardHeader>
          <CardContent>
            {details.customizations?.featureOverrides && details.customizations.featureOverrides.length > 0 ? (
              <div className="space-y-2">
                {details.customizations.featureOverrides.map((override: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span>{override.feature}</span>
                    <Badge variant={override.enabled ? 'default' : 'secondary'}>
                      {override.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No feature overrides</p>
            )}
            <Button
              size="sm"
              className="w-full mt-4"
              onClick={() => setShowFeatureDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Override
            </Button>
          </CardContent>
        </Card>

        {/* Usage Overrides */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Usage Overrides</CardTitle>
            <CardDescription>Temporary limit increases</CardDescription>
          </CardHeader>
          <CardContent>
            {usageOverrides.length > 0 ? (
              <div className="space-y-3">
                {usageOverrides.map((override) => (
                  <div key={override.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{override.metricName}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteUsageOverride(override.id)}
                      >
                        <Trash2 className="h-3 w-3 text-red-600" />
                      </Button>
                    </div>
                    <p className="text-sm text-gray-600">
                      Limit: {override.limitValue === -1 ? 'Unlimited' : override.limitValue.toLocaleString()}
                    </p>
                    {override.validTo && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        Until: {new Date(override.validTo).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No usage overrides</p>
            )}
            <Button
              size="sm"
              className="w-full mt-4"
              onClick={() => setShowUsageDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Override
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Custom Pricing Dialog */}
      <Dialog open={showPricingDialog} onOpenChange={setShowPricingDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Custom Pricing</DialogTitle>
            <DialogDescription>Configure VIP pricing for this tenant</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Plan ID *</label>
              <Input
                placeholder="vip_custom"
                value={pricingForm.planId}
                onChange={(e) => setPricingForm({ ...pricingForm, planId: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Features (one per line)</label>
              <Textarea
                placeholder="Feature 1&#10;Feature 2"
                value={pricingForm.features}
                onChange={(e) => setPricingForm({ ...pricingForm, features: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Limits (JSON)</label>
              <Textarea
                placeholder='{"api_calls": 100000, "transactions": -1}'
                value={pricingForm.limits}
                onChange={(e) => setPricingForm({ ...pricingForm, limits: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Valid From</label>
                <Input
                  type="date"
                  value={pricingForm.validFrom}
                  onChange={(e) => setPricingForm({ ...pricingForm, validFrom: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Valid To</label>
                <Input
                  type="date"
                  value={pricingForm.validTo}
                  onChange={(e) => setPricingForm({ ...pricingForm, validTo: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Reason</label>
              <Textarea
                placeholder="Reason for custom pricing..."
                value={pricingForm.reason}
                onChange={(e) => setPricingForm({ ...pricingForm, reason: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPricingDialog(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateCustomPricing} disabled={!pricingForm.planId || submitting}>
              {submitting ? 'Creating...' : 'Create Pricing'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feature Override Dialog */}
      <Dialog open={showFeatureDialog} onOpenChange={setShowFeatureDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Feature Override</DialogTitle>
            <DialogDescription>Force enable or disable a specific feature</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Feature Name *</label>
              <Input
                placeholder="advanced_analytics"
                value={featureForm.feature}
                onChange={(e) => setFeatureForm({ ...featureForm, feature: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Status *</label>
              <Select value={featureForm.enabled.toString()} onValueChange={(value) => setFeatureForm({ ...featureForm, enabled: value === 'true' })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Enabled</SelectItem>
                  <SelectItem value="false">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Reason</label>
              <Textarea
                placeholder="Reason for override..."
                value={featureForm.reason}
                onChange={(e) => setFeatureForm({ ...featureForm, reason: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeatureDialog(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateFeatureOverride} disabled={!featureForm.feature || submitting}>
              {submitting ? 'Creating...' : 'Add Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Usage Override Dialog */}
      <Dialog open={showUsageDialog} onOpenChange={setShowUsageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Usage Override</DialogTitle>
            <DialogDescription>Temporarily increase usage limits</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Metric Name *</label>
              <Select value={usageForm.metricName} onValueChange={(value) => setUsageForm({ ...usageForm, metricName: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  {/* 🔧 动态渲染可用的usage指标 */}
                  {getUsageMetrics().map((metric) => (
                    <SelectItem key={metric.key} value={metric.key}>
                      {metric.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Limit Value * (-1 for unlimited)</label>
              <Input
                type="number"
                placeholder="50000"
                value={usageForm.limitValue}
                onChange={(e) => setUsageForm({ ...usageForm, limitValue: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Valid From</label>
                <Input
                  type="date"
                  value={usageForm.validFrom}
                  onChange={(e) => setUsageForm({ ...usageForm, validFrom: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Valid To</label>
                <Input
                  type="date"
                  value={usageForm.validTo}
                  onChange={(e) => setUsageForm({ ...usageForm, validTo: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Reason</label>
              <Textarea
                placeholder="Reason for override..."
                value={usageForm.reason}
                onChange={(e) => setUsageForm({ ...usageForm, reason: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUsageDialog(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateUsageOverride} disabled={!usageForm.metricName || !usageForm.limitValue || submitting}>
              {submitting ? 'Creating...' : 'Add Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Subscription Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Subscription Status</DialogTitle>
            <DialogDescription>Change the status of the current subscription</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">New Status *</label>
              <Select value={statusForm.status} onValueChange={(value) => setStatusForm({ ...statusForm, status: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="incomplete">Incomplete</SelectItem>
                  <SelectItem value="incomplete_expired">Incomplete Expired</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Reason</label>
              <Textarea
                placeholder="Reason for status change..."
                value={statusForm.reason}
                onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSubscriptionStatus} disabled={!statusForm.status || submitting}>
              {submitting ? 'Updating...' : 'Update Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Subscription Usage Dialog */}
      <Dialog open={showUsageUpdateDialog} onOpenChange={setShowUsageUpdateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Subscription Usage</DialogTitle>
            <DialogDescription>Adjust API calls or transaction usage for this subscription</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Metric *</label>
              <Select value={usageUpdateForm.metricName} onValueChange={(value) => setUsageUpdateForm({ ...usageUpdateForm, metricName: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  {/* 🔧 动态渲染可用的usage指标 */}
                  {getUsageMetrics().map((metric) => (
                    <SelectItem key={metric.key} value={metric.key}>
                      {metric.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Action *</label>
              <Select value={usageUpdateForm.action} onValueChange={(value) => setUsageUpdateForm({ ...usageUpdateForm, action: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="set">Set to Value</SelectItem>
                  <SelectItem value="reset">Reset to 0</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {usageUpdateForm.action === 'set' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Value *</label>
                <Input
                  type="number"
                  placeholder="Enter usage value..."
                  value={usageUpdateForm.value}
                  onChange={(e) => setUsageUpdateForm({ ...usageUpdateForm, value: e.target.value })}
                  min="0"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUsageUpdateDialog(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSubscriptionUsage} disabled={!usageUpdateForm.metricName || !usageUpdateForm.action || (usageUpdateForm.action === 'set' && !usageUpdateForm.value) || submitting}>
              {submitting ? 'Updating...' : 'Update Usage'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Subscription Dialog */}
      <Dialog open={showCreateSubscriptionDialog} onOpenChange={setShowCreateSubscriptionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Subscription</DialogTitle>
            <DialogDescription>
              Create a new subscription for {details.tenant.companyName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Plan Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Subscription Plan *</label>
              <Select value={createSubscriptionForm.planId} onValueChange={(value) => setCreateSubscriptionForm({ ...createSubscriptionForm, planId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subscription plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free Plan - $0/month</SelectItem>
                  <SelectItem value="business">Business Plan - $29/month</SelectItem>
                  <SelectItem value="enterprise">Enterprise Plan - $99/month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div>
              <label className="text-sm font-medium mb-2 block">Start Date</label>
              <Input
                type="date"
                value={createSubscriptionForm.startDate}
                onChange={(e) => setCreateSubscriptionForm({ ...createSubscriptionForm, startDate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to start immediately
              </p>
            </div>

            {/* Current Subscription Handling */}
            {details.currentSubscription && (
              <div>
                <label className="text-sm font-medium mb-2 block">Current Subscription</label>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm">
                    Current: {details.currentSubscription.planId} ({details.currentSubscription.status})
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    <input
                      type="checkbox"
                      id="replaceExisting"
                      checked={createSubscriptionForm.replaceExisting}
                      onChange={(e) => setCreateSubscriptionForm({ ...createSubscriptionForm, replaceExisting: e.target.checked })}
                      className="rounded"
                    />
                    <label htmlFor="replaceExisting" className="text-sm">
                      Cancel current subscription and replace with new one
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="text-sm font-medium mb-2 block">Reason</label>
              <Textarea
                placeholder="Reason for creating this subscription..."
                value={createSubscriptionForm.reason}
                onChange={(e) => setCreateSubscriptionForm({ ...createSubscriptionForm, reason: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSubscriptionDialog(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubscription} disabled={!createSubscriptionForm.planId || submitting}>
              {submitting ? 'Creating...' : 'Create Subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

