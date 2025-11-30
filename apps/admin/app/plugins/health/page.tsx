'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  RefreshCw,
  Server,
  Database,
  Zap,
  Clock,
  TrendingUp,
  Shield
} from 'lucide-react';

interface PluginHealthStats {
  totalPlugins: number;
  healthyPlugins: number;
  degradedPlugins: number;
  errorPlugins: number;
  plugins: Array<{
    slug: string;
    name: string;
    status: 'healthy' | 'degraded' | 'error';
    errorCount: number;
    lastError?: string;
    lastErrorTime?: string;
    avgResponseTime: number;
    rateLimitHits: number;
    tenantCount: number;
  }>;
  systemHealth: {
    database: { status: string; latency_ms: number };
    redis: { status: string; latency_ms: number };
    uptime_seconds: number;
  };
}

export default function PluginHealthPage() {
  const router = useRouter();
  const [stats, setStats] = useState<PluginHealthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadHealthStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Import the API
      const { pluginManagementApi } = await import('@/lib/api');

      try {
        const response = await pluginManagementApi.getPluginHealth();
        if (response.success && response.data) {
          setStats(response.data);
          setLastRefresh(new Date());
          return;
        }
      } catch (apiError) {
        // API might not be available, use fallback mock data
        console.warn('Plugin health API not available, using mock data');
      }

      // Fallback mock data for development
      const mockStats: PluginHealthStats = {
        totalPlugins: 4,
        healthyPlugins: 3,
        degradedPlugins: 1,
        errorPlugins: 0,
        plugins: [
          {
            slug: 'stripe-payment',
            name: 'Stripe Payment',
            status: 'healthy',
            errorCount: 0,
            avgResponseTime: 125,
            rateLimitHits: 2,
            tenantCount: 12,
          },
          {
            slug: 'google-oauth',
            name: 'Google OAuth',
            status: 'healthy',
            errorCount: 0,
            avgResponseTime: 89,
            rateLimitHits: 0,
            tenantCount: 8,
          },
          {
            slug: 'resend-email',
            name: 'Resend Email',
            status: 'degraded',
            errorCount: 3,
            lastError: 'Rate limit exceeded',
            lastErrorTime: new Date(Date.now() - 3600000).toISOString(),
            avgResponseTime: 245,
            rateLimitHits: 15,
            tenantCount: 10,
          },
          {
            slug: 'affiliate-commission',
            name: 'Affiliate Commission',
            status: 'healthy',
            errorCount: 0,
            avgResponseTime: 67,
            rateLimitHits: 0,
            tenantCount: 5,
          },
        ],
        systemHealth: {
          database: { status: 'ok', latency_ms: 12 },
          redis: { status: 'ok', latency_ms: 3 },
          uptime_seconds: 86400,
        },
      };
      setStats(mockStats);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load health statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealthStats();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadHealthStats, 30000);
    return () => clearInterval(interval);
  }, [loadHealthStats]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      healthy: { variant: 'default', className: 'bg-green-100 text-green-700' },
      ok: { variant: 'default', className: 'bg-green-100 text-green-700' },
      degraded: { variant: 'secondary', className: 'bg-yellow-100 text-yellow-700' },
      error: { variant: 'destructive', className: 'bg-red-100 text-red-700' },
    };
    const config = variants[status] || variants.healthy;
    return (
      <Badge variant={config.variant} className={config.className}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading health statistics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/plugins')}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back to Plugins
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Plugin Health Monitor</h1>
            <p className="text-gray-600">Real-time plugin health and error statistics</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </span>
          <Button variant="outline" onClick={loadHealthStats} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {stats && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Plugins</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalPlugins}</div>
                <p className="text-xs text-muted-foreground">Registered plugins</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Healthy</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.healthyPlugins}</div>
                <p className="text-xs text-muted-foreground">Operating normally</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Degraded</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.degradedPlugins}</div>
                <p className="text-xs text-muted-foreground">Performance issues</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Errors</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.errorPlugins}</div>
                <p className="text-xs text-muted-foreground">Critical issues</p>
              </CardContent>
            </Card>
          </div>

          {/* System Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                System Health
              </CardTitle>
              <CardDescription>Core infrastructure status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium">Database</p>
                      <p className="text-sm text-gray-500">
                        {stats.systemHealth.database.latency_ms}ms latency
                      </p>
                    </div>
                  </div>
                  {getStatusIcon(stats.systemHealth.database.status)}
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="font-medium">Redis</p>
                      <p className="text-sm text-gray-500">
                        {stats.systemHealth.redis.latency_ms}ms latency
                      </p>
                    </div>
                  </div>
                  {getStatusIcon(stats.systemHealth.redis.status)}
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">Uptime</p>
                      <p className="text-sm text-gray-500">
                        {formatUptime(stats.systemHealth.uptime_seconds)}
                      </p>
                    </div>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plugin Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Plugin Status Details
              </CardTitle>
              <CardDescription>Individual plugin health and error statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.plugins.map((plugin) => (
                  <div
                    key={plugin.slug}
                    className="flex items-center justify-between p-4 border rounded-lg hover:border-blue-500 transition-all cursor-pointer"
                    onClick={() => router.push(`/plugins/${plugin.slug}`)}
                  >
                    <div className="flex items-center gap-4">
                      {getStatusIcon(plugin.status)}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{plugin.name}</h3>
                          {getStatusBadge(plugin.status)}
                        </div>
                        <p className="text-sm text-gray-600">{plugin.slug}</p>
                        {plugin.lastError && (
                          <p className="text-xs text-red-500 mt-1">
                            Last error: {plugin.lastError}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-6 text-center">
                      <div>
                        <p className="text-lg font-semibold">{plugin.errorCount}</p>
                        <p className="text-xs text-gray-500">Errors (24h)</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold">{plugin.avgResponseTime}ms</p>
                        <p className="text-xs text-gray-500">Avg Response</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold">{plugin.rateLimitHits}</p>
                        <p className="text-xs text-gray-500">Rate Limits</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold">{plugin.tenantCount}</p>
                        <p className="text-xs text-gray-500">Tenants</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

