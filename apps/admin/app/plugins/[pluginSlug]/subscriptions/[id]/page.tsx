'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { pluginManagementApi } from '@/lib/api';
import {
  ArrowLeft,
  AlertCircle,
  Calendar,
  DollarSign,
  FileText,
  History,
  Activity,
  Edit,
  Building2,
  Package,
  BarChart3,
  TrendingUp
} from 'lucide-react';

interface SubscriptionDetails {
  id: string;
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
  planId: string;
  status: string;
  amount: number;
  currency: string;
  billingCycle: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialStart?: string;
  trialEnd?: string;
  canceledAt?: string;
  createdAt: string;
  // 🔧 动态usage对象（支持不同插件的不同指标）
  usage?: Record<string, {
    current: number;
    limit: number;
  }>;
  invoices: any[];
  changes: any[];
  events: any[];
}

export default function SubscriptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pluginSlug = params.pluginSlug as string;
  const subscriptionId = params.id as string;

  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [updating, setUpdating] = useState(false);

  // Usage update states
  const [showUsageDialog, setShowUsageDialog] = useState(false);
  const [usageMetric, setUsageMetric] = useState<string>('api_calls');
  const [usageAction, setUsageAction] = useState<'set' | 'reset'>('set');
  const [usageValue, setUsageValue] = useState('');
  const [updatingUsage, setUpdatingUsage] = useState(false);

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

  const loadSubscriptionDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await pluginManagementApi.getSubscriptionDetails(pluginSlug, subscriptionId);

      if (response.success && response.data) {
        // Backend returns { success: true, data: { subscription: {...} } }
        setSubscription(response.data.subscription);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to load subscription details';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [pluginSlug, subscriptionId]);

  useEffect(() => {
    loadSubscriptionDetails();
  }, [loadSubscriptionDetails]);

  const handleUpdateStatus = async () => {
    if (!newStatus) return;

    try {
      setUpdating(true);
      const response = await pluginManagementApi.updateSubscriptionStatus(
        pluginSlug,
        subscriptionId,
        {
          status: newStatus,
          reason: statusReason || undefined
        }
      );

      if (response.success) {
        setShowStatusDialog(false);
        setNewStatus('');
        setStatusReason('');
        loadSubscriptionDetails(); // Reload data
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateUsage = async () => {
    if (usageAction === 'set' && !usageValue) {
      alert('Please enter a value');
      return;
    }

    try {
      setUpdatingUsage(true);
      const response = await pluginManagementApi.updateSubscriptionUsage(
        pluginSlug,
        subscriptionId,
        {
          metricName: usageMetric,
          action: usageAction,
          value: usageAction === 'set' ? parseInt(usageValue) : undefined
        }
      );

      if (response.success) {
        alert(response.message || 'Usage updated successfully');
        setShowUsageDialog(false);
        setUsageMetric('api_calls');
        setUsageAction('set');
        setUsageValue('');
        loadSubscriptionDetails(); // Reload data
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update usage');
    } finally {
      setUpdatingUsage(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'canceled':
        return 'bg-red-100 text-red-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'trialing':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading subscription details...</p>
        </div>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error || 'Subscription not found'}</p>
          <Button onClick={loadSubscriptionDetails} className="mt-4">
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
            onClick={() => router.push(`/plugins/${pluginSlug}/subscriptions`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Subscriptions
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Subscription Details</h1>
            <p className="text-gray-600">ID: {subscription.id}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => setShowStatusDialog(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Update Status
          </Button>
          <Button onClick={() => setShowUsageDialog(true)} variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Update Usage
          </Button>
        </div>
      </div>

      {/* Basic Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tenant</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscription.tenant.companyName}</div>
            <p className="text-xs text-muted-foreground mt-1">{subscription.tenant.contactEmail}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => router.push(`/plugins/${pluginSlug}/tenants/${subscription.tenant.id}`)}
            >
              View Tenant
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plugin & Plan</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscription.plugin.name}</div>
            <p className="text-xs text-muted-foreground mt-1">Plan: {subscription.planId}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => router.push(`/plugins/${pluginSlug}/plans`)}
            >
              View Plans
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status & Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${subscription.amount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">{subscription.currency.toUpperCase()} / {subscription.billingCycle}</p>
            <Badge className={`mt-3 ${getStatusColor(subscription.status)}`}>
              {subscription.status}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usage</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {subscription.usage && Object.keys(subscription.usage).length > 0 ? (
              <div className="space-y-3">
                {/* 🔧 动态渲染usage指标 */}
                {Object.entries(subscription.usage).map(([metricKey, metricData]) => {
                  const metricLabel = getUsageMetrics().find(m => m.key === metricKey)?.label || metricKey;
                  return (
                    <div key={metricKey}>
                      <div className="text-lg font-semibold">
                        {metricData.current.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {metricLabel} / {metricData.limit === -1 ? 'Unlimited' : metricData.limit.toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No usage data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Info */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-600">Current Period</label>
              <p className="text-lg font-semibold flex items-center mt-1">
                <Calendar className="h-4 w-4 mr-2" />
                {new Date(subscription.currentPeriodStart).toLocaleDateString()} - {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Created At</label>
              <p className="text-lg font-semibold mt-1">
                {new Date(subscription.createdAt).toLocaleString()}
              </p>
            </div>
            {subscription.trialStart && subscription.trialEnd && (
              <div>
                <label className="text-sm font-medium text-gray-600">Trial Period</label>
                <p className="text-lg font-semibold mt-1">
                  {new Date(subscription.trialStart).toLocaleDateString()} - {new Date(subscription.trialEnd).toLocaleDateString()}
                </p>
              </div>
            )}
            {subscription.canceledAt && (
              <div>
                <label className="text-sm font-medium text-gray-600">Canceled At</label>
                <p className="text-lg font-semibold text-red-600 mt-1">
                  {new Date(subscription.canceledAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Invoices, Changes, Events */}
      <Tabs defaultValue="invoices" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="invoices">
            <FileText className="h-4 w-4 mr-2" />
            Invoices ({subscription.invoices?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="changes">
            <History className="h-4 w-4 mr-2" />
            Changes ({subscription.changes?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="events">
            <Activity className="h-4 w-4 mr-2" />
            Events ({subscription.events?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>Billing history for this subscription</CardDescription>
            </CardHeader>
            <CardContent>
              {subscription.invoices && subscription.invoices.length > 0 ? (
                <div className="space-y-3">
                  {subscription.invoices.map((invoice: any) => (
                    <div key={invoice.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold">Invoice #{invoice.invoiceNumber}</p>
                          <p className="text-sm text-gray-600">{new Date(invoice.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">${invoice.amount.toFixed(2)}</p>
                          <Badge className={invoice.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            {invoice.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No invoices found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="changes">
          <Card>
            <CardHeader>
              <CardTitle>Change History</CardTitle>
              <CardDescription>All modifications to this subscription</CardDescription>
            </CardHeader>
            <CardContent>
              {subscription.changes && subscription.changes.length > 0 ? (
                <div className="space-y-3">
                  {subscription.changes.map((change: any) => (
                    <div key={change.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-semibold">{change.changeType}</p>
                          <p className="text-sm text-gray-600">{change.reason || 'No reason provided'}</p>
                        </div>
                        <p className="text-sm text-gray-500">{new Date(change.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No changes recorded</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Event Log</CardTitle>
              <CardDescription>System events for this subscription</CardDescription>
            </CardHeader>
            <CardContent>
              {subscription.events && subscription.events.length > 0 ? (
                <div className="space-y-3">
                  {subscription.events.map((event: any) => (
                    <div key={event.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between">
                        <div>
                          <p className="font-semibold">{event.eventType}</p>
                          <p className="text-sm text-gray-600">Source: {event.eventSource}</p>
                        </div>
                        <p className="text-sm text-gray-500">{new Date(event.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No events recorded</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Update Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Subscription Status</DialogTitle>
            <DialogDescription>
              Change the status of this subscription
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">New Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Reason (Optional)</label>
              <Textarea
                placeholder="Enter reason for status change..."
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)} disabled={updating}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus} disabled={!newStatus || updating}>
              {updating ? 'Updating...' : 'Update Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Usage Dialog */}
      <Dialog open={showUsageDialog} onOpenChange={setShowUsageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Subscription Usage</DialogTitle>
            <DialogDescription>
              Adjust API calls or transaction usage for this subscription
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Metric</label>
              <Select value={usageMetric} onValueChange={(value: any) => setUsageMetric(value)}>
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
              <label className="text-sm font-medium mb-2 block">Action</label>
              <Select value={usageAction} onValueChange={(value: any) => setUsageAction(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="set">Set to Value</SelectItem>
                  <SelectItem value="reset">Reset to 0</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {usageAction === 'set' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Value</label>
                <Input
                  type="number"
                  placeholder="Enter usage value..."
                  value={usageValue}
                  onChange={(e) => setUsageValue(e.target.value)}
                  min="0"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUsageDialog(false)} disabled={updatingUsage}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUsage} disabled={updatingUsage || (usageAction === 'set' && !usageValue)}>
              {updatingUsage ? 'Updating...' : 'Update Usage'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

