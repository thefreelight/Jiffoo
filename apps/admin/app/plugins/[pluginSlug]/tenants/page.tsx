'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { pluginManagementApi } from '@/lib/api';
import {
  ArrowLeft,
  Users,
  Search,
  Filter,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  DollarSign
} from 'lucide-react';

interface Subscription {
  id: string;
  tenantId: number;
  tenant: {
    id: number;
    companyName: string;
    contactEmail: string;
  };
  planId: string;
  status: string;
  amount: number;
  currency: string;
  billingCycle: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
  usage?: {
    api_calls: {
      current: number;
      limit: number;
    };
    transactions: {
      current: number;
      limit: number;
    };
  };
}

export default function PluginTenantsPage() {
  const params = useParams();
  const router = useRouter();
  const pluginSlug = params.pluginSlug as string;

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 🔧 修复：使用租户视图类型，显示每个租户的最新订阅（与租户详情页逻辑一致）
      const response = await pluginManagementApi.getPluginSubscriptions(pluginSlug, {
        page,
        limit: 20,
        status: statusFilter === 'all' ? undefined : statusFilter,
        viewType: 'tenants' // 指定为租户视图
      });

      if (response.success && response.data) {
        setSubscriptions(response.data.subscriptions || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to load tenants';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [pluginSlug, page, statusFilter, planFilter]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; icon: any; label: string }> = {
      active: { variant: 'default', icon: CheckCircle, label: 'Active' },
      trialing: { variant: 'secondary', icon: Clock, label: 'Trialing' },
      past_due: { variant: 'destructive', icon: AlertCircle, label: 'Past Due' },
      canceled: { variant: 'outline', icon: XCircle, label: 'Canceled' },
      expired: { variant: 'destructive', icon: XCircle, label: 'Expired' },
    };

    const config = statusConfig[status] || statusConfig.active;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant as any} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount);
  };

  const getUsagePercentage = (current: number, limit: number) => {
    if (limit === -1 || limit === 0) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      sub.tenant.companyName.toLowerCase().includes(search) ||
      sub.tenant.contactEmail.toLowerCase().includes(search) ||
      sub.tenantId.toString().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tenants...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
          <Button onClick={loadSubscriptions} className="mt-4">
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
            <h1 className="text-3xl font-bold">Plugin Tenants</h1>
            <p className="text-gray-600">{pluginSlug}</p>
          </div>
        </div>
        <Badge variant="secondary" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {filteredSubscriptions.length} Tenants
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by company name, email, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trialing">Trialing</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tenants List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredSubscriptions.map((subscription) => (
          <Card
            key={subscription.id}
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push(`/plugins/${pluginSlug}/tenants/${subscription.tenant.id}`)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{subscription.tenant.companyName}</h3>
                    {getStatusBadge(subscription.status)}
                    <Badge variant="outline">{subscription.planId}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    {subscription.tenant.contactEmail} • Tenant ID: {subscription.tenantId}
                  </p>

                  {/* Usage Information */}
                  {subscription.usage && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">API Calls</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                getUsagePercentage(
                                  subscription.usage.api_calls.current,
                                  subscription.usage.api_calls.limit
                                ) >= 90
                                  ? 'bg-red-500'
                                  : getUsagePercentage(
                                      subscription.usage.api_calls.current,
                                      subscription.usage.api_calls.limit
                                    ) >= 70
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                              }`}
                              style={{
                                width: `${getUsagePercentage(
                                  subscription.usage.api_calls.current,
                                  subscription.usage.api_calls.limit
                                )}%`
                              }}
                            />
                          </div>
                          <span
                            className={`text-sm font-medium ${getUsageColor(
                              getUsagePercentage(
                                subscription.usage.api_calls.current,
                                subscription.usage.api_calls.limit
                              )
                            )}`}
                          >
                            {subscription.usage.api_calls.current} / {subscription.usage.api_calls.limit === -1 ? '∞' : subscription.usage.api_calls.limit}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Transactions</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                getUsagePercentage(
                                  subscription.usage.transactions.current,
                                  subscription.usage.transactions.limit
                                ) >= 90
                                  ? 'bg-red-500'
                                  : getUsagePercentage(
                                      subscription.usage.transactions.current,
                                      subscription.usage.transactions.limit
                                    ) >= 70
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                              }`}
                              style={{
                                width: `${getUsagePercentage(
                                  subscription.usage.transactions.current,
                                  subscription.usage.transactions.limit
                                )}%`
                              }}
                            />
                          </div>
                          <span
                            className={`text-sm font-medium ${getUsageColor(
                              getUsagePercentage(
                                subscription.usage.transactions.current,
                                subscription.usage.transactions.limit
                              )
                            )}`}
                          >
                            {subscription.usage.transactions.current} / {subscription.usage.transactions.limit === -1 ? '∞' : subscription.usage.transactions.limit}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-1 text-lg font-bold mb-1">
                    <DollarSign className="h-5 w-5" />
                    {formatCurrency(subscription.amount, subscription.currency)}
                  </div>
                  <p className="text-xs text-gray-500">{subscription.billingCycle}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

