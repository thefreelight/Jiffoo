'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { pluginManagementApi } from '@/lib/api';
import { useAuthStore } from '@/store';
import {
  DollarSign,
  Users,
  TrendingUp,
  Package,
  Activity,
  AlertCircle
} from 'lucide-react';

interface PluginStats {
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
  }>;
}

export default function PluginsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<PluginStats | null>(null);
  const [loading, setLoading] = useState(true); // 🔧 恢复API调用
  const [error, setError] = useState<string | null>(null);

  // 🔧 使用ref来防止React严格模式的双重调用
  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);

  // 🔧 添加认证状态调试
  const { isAuthenticated, isLoading: authLoading, isChecking } = useAuthStore();

  const loadPluginStats = useCallback(async () => {
    // 防止React严格模式的双重调用
    if (isLoadingRef.current || hasLoadedRef.current) {
      return;
    }

    isLoadingRef.current = true;

    try {
      setLoading(true);
      setError(null);

      const response = await pluginManagementApi.getGlobalStats();

      if (response.success && response.data) {
        setStats(response.data);
        hasLoadedRef.current = true;
      } else {
        const errorMsg = response.message || 'Failed to load plugin statistics';
        setError(errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to load plugin statistics';
      setError(errorMsg);

      // 如果是网络错误，提供重试建议
      if (err.code === 'NETWORK_ERROR' || err.message?.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !authLoading && !isChecking) {
      loadPluginStats();
    }
  }, [isAuthenticated, authLoading, isChecking, loadPluginStats]);

  // 监听stats变化确保loading状态正确更新
  useEffect(() => {
    if (stats) {
      setLoading(false);
    }
  }, [stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading plugin statistics...</p>
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
          <Button onClick={loadPluginStats} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  console.log('Rendering main content with stats:', stats);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Plugin Management</h1>
          <p className="text-gray-600 mt-2">
            Manage and monitor the plugin ecosystem across all tenants
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={loadPluginStats}>
            <Activity className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => router.push('/plugins/health')}>
            <AlertCircle className="h-4 w-4 mr-2" />
            Health Monitor
          </Button>
          <Button onClick={() => router.push('/plugins/manage')}>
            <Package className="h-4 w-4 mr-2" />
            Manage Plugins
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plugins</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalPlugins || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activePlugins || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Installations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalInstallations || 0}</div>
            <p className="text-xs text-muted-foreground">
              Across all tenants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(stats?.totalRevenue || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Active Users</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.monthlyActiveUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              Using plugins
            </p>
          </CardContent>
        </Card>
      </div>



      {/* Top Plugins */}
      {stats?.topPlugins && stats.topPlugins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Plugins</CardTitle>
            <CardDescription>
              Most popular plugins by installations and revenue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.topPlugins.map((plugin, index) => (
                <div
                  key={plugin.slug}
                  className="flex items-center justify-between p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => router.push(`/plugins/${plugin.slug}`)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-semibold">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold">{plugin.name}</h3>
                      <p className="text-sm text-gray-600">{plugin.slug}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="text-sm font-medium">{plugin.installations} installs</p>
                        <p className="text-sm text-gray-600">${plugin.revenue.toLocaleString()} revenue</p>
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        <Badge variant="secondary">
                          Active
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/plugins/${plugin.slug}`);
                          }}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
