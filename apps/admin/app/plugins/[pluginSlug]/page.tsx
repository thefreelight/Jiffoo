'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { pluginManagementApi } from '@/lib/api';
import {
  ArrowLeft,
  Package,
  Users,
  DollarSign,
  TrendingUp,
  Activity,
  AlertCircle,
  Settings,
  FileText,
  BarChart3
} from 'lucide-react';

interface PluginStats {
  pluginInfo: {
    id: string;
    slug: string;
    name: string;
    version: string;
    status: string;
  };
  totalInstallations: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalRevenue: number;
  subscriptionsByPlan: Array<{
    planId: string;
    planName: string;
    count: number;
    revenue: number;
  }>;
}

interface Subscription {
  id: string;
  tenantId: number;
  tenantName: string;
  planId: string;
  status: string;
  amount: number;
  currency: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
}

export default function PluginDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pluginSlug = params.pluginSlug as string;

  const [stats, setStats] = useState<PluginStats | null>(null);
  const [recentSubscriptions, setRecentSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPluginData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load plugin stats
      const statsResponse = await pluginManagementApi.getPluginStats(pluginSlug);
      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }

      // Load recent subscriptions (top 5)
      const subsResponse = await pluginManagementApi.getPluginSubscriptions(pluginSlug, {
        page: 1,
        limit: 5
      });
      if (subsResponse.success && subsResponse.data?.subscriptions) {
        setRecentSubscriptions(subsResponse.data.subscriptions);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to load plugin data';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [pluginSlug]);

  useEffect(() => {
    loadPluginData();
  }, [loadPluginData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading plugin details...</p>
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
          <Button onClick={loadPluginData} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">No plugin data available</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'canceled':
        return 'bg-red-100 text-red-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/plugins')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Plugins
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{stats.pluginInfo.name}</h1>
            <p className="text-gray-600">{stats.pluginInfo.slug} • v{stats.pluginInfo.version}</p>
          </div>
        </div>
        <Badge className={stats.pluginInfo.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}>
          {stats.pluginInfo.status}
        </Badge>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Installations</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalInstallations}</div>
            <p className="text-xs text-muted-foreground">Active tenants using this plugin</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeSubscriptions} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All-time revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalSubscriptions > 0
                ? Math.round((stats.activeSubscriptions / stats.totalSubscriptions) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Active subscription rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Manage plugin subscriptions and settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Button
              className="w-full"
              onClick={() => router.push(`/plugins/${pluginSlug}/tenants`)}
            >
              <Users className="h-4 w-4 mr-2" />
              View All Tenants
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => router.push(`/plugins/${pluginSlug}/subscriptions`)}
            >
              <Activity className="h-4 w-4 mr-2" />
              View Subscriptions
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => router.push(`/plugins/${pluginSlug}/plans`)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Manage Plans
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => router.push(`/plugins/${pluginSlug}/analytics`)}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              View Analytics
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions by Plan */}
      {stats.subscriptionsByPlan && stats.subscriptionsByPlan.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Subscriptions by Plan</CardTitle>
            <CardDescription>Distribution of subscriptions across different plans</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.subscriptionsByPlan.map((plan) => (
                <div key={plan.planId} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-semibold">{plan.planName}</h3>
                    <p className="text-sm text-gray-600">Plan ID: {plan.planId}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{plan.count} subscriptions</p>
                    <p className="text-sm text-gray-600">${plan.revenue.toLocaleString()} revenue</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Subscriptions */}
      {recentSubscriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Subscriptions</CardTitle>
            <CardDescription>Latest 5 subscriptions for this plugin</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentSubscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => router.push(`/plugins/${pluginSlug}/subscriptions/${sub.id}`)}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-semibold">{sub.tenantName}</h3>
                      <Badge className={getStatusColor(sub.status)}>
                        {sub.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Plan: {sub.planId} • ${sub.amount}/{sub.currency}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      {new Date(sub.currentPeriodStart).toLocaleDateString()} - {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                    </p>
                    <Button size="sm" variant="outline" className="mt-2">
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              className="w-full mt-4"
              variant="outline"
              onClick={() => router.push(`/plugins/${pluginSlug}/subscriptions`)}
            >
              View All Subscriptions
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

