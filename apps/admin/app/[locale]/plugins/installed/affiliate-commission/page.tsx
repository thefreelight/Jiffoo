'use client';

import { ArrowLeft } from 'lucide-react'
import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { affiliateAdminApi, type TenantCommissionConfig } from '@/lib/affiliate-api';
import { ConfigSettings } from '@/components/affiliate/ConfigSettings';
import { AffiliateUsersList } from '@/components/affiliate/AffiliateUsersList';
import { CommissionsManagement } from '@/components/affiliate/CommissionsManagement';
import { PayoutsManagement } from '@/components/affiliate/PayoutsManagement';
import { useT } from 'shared/src/i18n';

const PLUGIN_SLUG = 'affiliate-commission';

export default function AffiliateCommissionPluginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState('subscription');
  const [config, setConfig] = React.useState<TenantCommissionConfig | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const t = useT();

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // 加载配置
  const loadConfig = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await affiliateAdminApi.getConfig();
      if (response.success && response.data) {
        setConfig(response.data);
      }
    } catch (error: any) {
      toast({
        title: getText('tenant.plugins.failedToLoadConfig', 'Failed to load configuration'),
        description: error.message || getText('common.pleaseTryAgain', 'Please try again'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, getText]);

  React.useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{getText('tenant.plugins.configNotFound', 'Configuration Not Found')}</CardTitle>
            <CardDescription>
              {getText('tenant.plugins.failedToLoadAffiliateConfig', 'Failed to load affiliate commission configuration')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={loadConfig}>{getText('common.retry', 'Retry')}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/plugins/installed')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{getText('tenant.plugins.affiliateCommission', 'Affiliate Commission')}</h1>
            <p className="text-muted-foreground">
              {getText('tenant.plugins.manageAffiliateSystem', 'Manage your affiliate commission system')}
            </p>
          </div>
        </div>
        <Badge variant={config.enabled ? 'default' : 'secondary'}>
          {config.enabled ? getText('common.enabled', 'Enabled') : getText('common.disabled', 'Disabled')}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="subscription">{getText('tenant.plugins.subscription', 'Subscription')}</TabsTrigger>
          <TabsTrigger value="configuration">{getText('tenant.plugins.configuration', 'Configuration')}</TabsTrigger>
        </TabsList>

        {/* Subscription Tab */}
        <TabsContent value="subscription" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{getText('tenant.plugins.pluginInformation', 'Plugin Information')}</CardTitle>
              <CardDescription>
                {getText('tenant.plugins.affiliateBuyoutPlugin', 'Affiliate Commission is a buy-out plugin')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-semibold">{getText('tenant.plugins.oneTimePurchase', 'One-Time Purchase')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {getText('tenant.plugins.oneTimePurchaseDesc', 'This plugin requires a one-time payment. No recurring subscription fees.')}
                  </p>
                </div>
                <Badge variant="default">{getText('tenant.plugins.purchased', 'Purchased')}</Badge>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium">{getText('tenant.plugins.featuresIncluded', 'Features Included')}:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>✓ {getText('tenant.plugins.affiliateFeature1', 'Single-tier commission system')}</li>
                  <li>✓ {getText('tenant.plugins.affiliateFeature2', 'Automatic referral code generation')}</li>
                  <li>✓ {getText('tenant.plugins.affiliateFeature3', 'Customizable commission rates per user')}</li>
                  <li>✓ {getText('tenant.plugins.affiliateFeature4', 'Configurable settlement period')}</li>
                  <li>✓ {getText('tenant.plugins.affiliateFeature5', 'Manual payout approval system')}</li>
                  <li>✓ {getText('tenant.plugins.affiliateFeature6', 'Comprehensive commission tracking')}</li>
                  <li>✓ {getText('tenant.plugins.affiliateFeature7', 'User dashboard with statistics')}</li>
                  <li>✓ {getText('tenant.plugins.affiliateFeature8', 'Admin management interface')}</li>
                </ul>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">{getText('tenant.plugins.usageStatistics', 'Usage Statistics')}</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{config.enabled ? getText('common.active', 'Active') : getText('common.inactive', 'Inactive')}</p>
                    <p className="text-xs text-muted-foreground">{getText('common.status', 'Status')}</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{config.defaultRate}%</p>
                    <p className="text-xs text-muted-foreground">{getText('tenant.plugins.defaultRate', 'Default Rate')}</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{config.settlementDays}d</p>
                    <p className="text-xs text-muted-foreground">{getText('tenant.plugins.settlementPeriod', 'Settlement Period')}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-6">
          {/* System Configuration */}
          <ConfigSettings config={config} onUpdate={loadConfig} />

          {/* User Management */}
          <AffiliateUsersList />

          {/* Commission Management */}
          <CommissionsManagement />

          {/* Payout Management */}
          <PayoutsManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}

