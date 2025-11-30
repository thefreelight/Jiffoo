'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { pluginManagementApi } from '@/lib/api';
import { 
  Package, 
  Users, 
  DollarSign, 
  TrendingUp,
  Activity,
  AlertCircle,
  ExternalLink
} from 'lucide-react';

interface PluginStatsData {
  totalPlugins: number;
  activePlugins: number;
  totalInstallations: number;
  totalRevenue: number;
  monthlyActiveUsers: number;
  topPlugins: Array<{
    slug: string;
    name: string;
    installations: number;
    revenue: number;
    status: string;
  }>;
  recentActivity: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
}

export function PluginStats() {
  const [stats, setStats] = useState<PluginStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPluginStats();
  }, []);

  const loadPluginStats = async () => {
    try {
      setLoading(true);
      const response = await pluginManagementApi.getGlobalStats();
      if (response.success) {
        setStats(response.data);
      } else {
        setError('Failed to load plugin statistics');
      }
    } catch (err) {
      setError('Failed to load plugin statistics');
      console.error('Error loading plugin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={loadPluginStats} className="mt-2">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Plugin Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plugins</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPlugins}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activePlugins} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Installations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalInstallations}</div>
            <p className="text-xs text-muted-foreground">
              Across all tenants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plugin Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.monthlyActiveUsers}</div>
            <p className="text-xs text-muted-foreground">
              Using plugins
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Plugins and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Plugins */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Top Plugins</CardTitle>
              <CardDescription>Most popular plugins by installations</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/plugins/analytics'}>
              <ExternalLink className="h-4 w-4 mr-1" />
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topPlugins.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No plugins available</p>
              ) : (
                stats.topPlugins.slice(0, 3).map((plugin, index) => (
                  <div key={plugin.slug} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-xs font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{plugin.name}</p>
                        <p className="text-xs text-gray-500">{plugin.installations} installs</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">${plugin.revenue.toLocaleString()}</p>
                      <Badge variant={plugin.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {plugin.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <CardDescription>Latest plugin-related activities</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/plugins'}>
              <Activity className="h-4 w-4 mr-1" />
              Manage
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentActivity.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
              ) : (
                stats.recentActivity.slice(0, 4).map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="flex items-center justify-center w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.message}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Plugin Management</CardTitle>
          <CardDescription>Quick access to plugin management features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col items-center space-y-2"
              onClick={() => window.location.href = '/plugins/analytics'}
            >
              <TrendingUp className="h-6 w-6 text-blue-600" />
              <div className="text-center">
                <p className="font-medium">View Analytics</p>
                <p className="text-xs text-gray-500">Usage statistics</p>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col items-center space-y-2"
              onClick={() => window.location.href = '/plugins/commercial'}
            >
              <DollarSign className="h-6 w-6 text-green-600" />
              <div className="text-center">
                <p className="font-medium">Commercial</p>
                <p className="text-xs text-gray-500">Manage subscriptions</p>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col items-center space-y-2"
              onClick={() => window.location.href = '/plugins/pricing'}
            >
              <Package className="h-6 w-6 text-purple-600" />
              <div className="text-center">
                <p className="font-medium">Custom Pricing</p>
                <p className="text-xs text-gray-500">Enterprise plans</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
