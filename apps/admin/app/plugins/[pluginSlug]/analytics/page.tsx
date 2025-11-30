'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { pluginManagementApi } from '@/lib/api';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Activity,
  Download,
  RefreshCw,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';

// 后端返回的数据接口（匹配后端数据结构）
interface PluginUsageOverviewData {
  totalTenants: number;
  totalPlugins: number;
  totalInstallations: number;
  customPricingCount: number;
  tenants: Array<{
    tenantId: number;
    companyName: string;
    pluginCount: number;
    hasCustomPricing: boolean;
    hasFeatureOverrides: boolean;
    hasUsageOverrides: boolean;
    mode: 'COMMERCIAL' | 'STANDARD';
  }>;
}

export default function PluginAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const pluginSlug = params.pluginSlug as string;
  
  const [usageData, setUsageData] = useState<PluginUsageOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('30d');

  useEffect(() => {
    loadUsageData();
  }, [timeRange]);

  const loadUsageData = async () => {
    try {
      setLoading(true);
      const response = await pluginManagementApi.getPluginUsageOverview();
      if (response.success && response.data) {
        // 后端返回的是 { totalTenants, totalPlugins, totalInstallations, customPricingCount, tenants }
        setUsageData(response.data);
      } else {
        setError('Failed to load plugin usage data');
      }
    } catch (err) {
      setError('Failed to load plugin usage data');
      console.error('Error loading usage data:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    // TODO: Implement data export functionality
    console.log('Exporting plugin analytics data...');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
          <Button onClick={loadUsageData} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // 计算统计数据（基于后端返回的数据）
  const totalStats = usageData ? {
    totalInstallations: usageData.totalInstallations,
    activeInstallations: usageData.totalInstallations, // 假设所有安装都是活跃的
    totalTenants: usageData.totalTenants,
    totalPlugins: usageData.totalPlugins,
    customPricingCount: usageData.customPricingCount,
    commercialTenants: usageData.tenants.filter(t => t.mode === 'COMMERCIAL').length,
  } : {
    totalInstallations: 0,
    activeInstallations: 0,
    totalTenants: 0,
    totalPlugins: 0,
    customPricingCount: 0,
    commercialTenants: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
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
            <h1 className="text-3xl font-bold text-gray-900">Plugin Analytics</h1>
            <p className="text-gray-600 mt-2">
              {pluginSlug} • Detailed usage statistics and performance metrics
            </p>
          </div>
        </div>
        <div className="flex space-x-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={loadUsageData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Stats - 基于后端返回的数据 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Installations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalStats.totalInstallations}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalStats.activeInstallations} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalStats.totalTenants}
            </div>
            <p className="text-xs text-muted-foreground">
              Total tenants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commercial Tenants</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalStats.commercialTenants}
            </div>
            <p className="text-xs text-muted-foreground">
              With custom pricing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plugins</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalStats.totalPlugins}
            </div>
            <p className="text-xs text-muted-foreground">
              Available plugins
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tenant List - 显示所有租户及其插件使用情况 */}
      <Card>
        <CardHeader>
          <CardTitle>Plugin Usage by Tenant</CardTitle>
          <CardDescription>
            Tenants using {pluginSlug} plugin
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usageData && usageData.tenants.length > 0 ? (
            <div className="space-y-4">
              {usageData.tenants.map(tenant => (
                <div key={tenant.tenantId} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div>
                      <h3 className="font-semibold">{tenant.companyName}</h3>
                      <p className="text-sm text-gray-600">Tenant ID: {tenant.tenantId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-6">
                      <div>
                        <p className="text-sm font-medium">{tenant.pluginCount} plugins</p>
                        <p className="text-sm text-gray-600">installed</p>
                      </div>
                      <div>
                        <Badge variant={tenant.mode === 'COMMERCIAL' ? "default" : "secondary"}>
                          {tenant.mode}
                        </Badge>
                      </div>
                      {tenant.hasCustomPricing && (
                        <Badge variant="outline">Custom Pricing</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No tenant data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

