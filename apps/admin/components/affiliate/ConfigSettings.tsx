/**
 * Affiliate Config Settings Component
 *
 * Configuration settings for affiliate commission system with i18n support.
 */

'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { affiliateAdminApi, type TenantCommissionConfig } from '@/lib/affiliate-api';
import { useT } from 'shared/src/i18n';

interface ConfigSettingsProps {
  config: TenantCommissionConfig;
  onUpdate: () => void;
}

export function ConfigSettings({ config, onUpdate }: ConfigSettingsProps) {
  const t = useT();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    enabled: config.enabled,
    defaultRate: config.defaultRate.toString(),
    settlementDays: config.settlementDays.toString(),
    minPayoutAmount: config.minPayoutAmount.toString(),
  });

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 验证
    const defaultRate = parseFloat(formData.defaultRate);
    const settlementDays = parseInt(formData.settlementDays);
    const minPayoutAmount = parseFloat(formData.minPayoutAmount);

    if (isNaN(defaultRate) || defaultRate < 0 || defaultRate > 100) {
      toast({
        title: getText('tenant.affiliate.config.invalidRate', 'Invalid default rate'),
        description: getText('tenant.affiliate.config.rateRange', 'Default rate must be between 0 and 100'),
        variant: 'destructive',
      });
      return;
    }

    if (isNaN(settlementDays) || settlementDays < 1) {
      toast({
        title: getText('tenant.affiliate.config.invalidSettlementDays', 'Invalid settlement days'),
        description: getText('tenant.affiliate.config.settlementDaysMin', 'Settlement days must be at least 1'),
        variant: 'destructive',
      });
      return;
    }

    if (isNaN(minPayoutAmount) || minPayoutAmount < 0) {
      toast({
        title: getText('tenant.affiliate.config.invalidMinPayout', 'Invalid minimum payout amount'),
        description: getText('tenant.affiliate.config.minPayoutPositive', 'Minimum payout amount must be positive'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      await affiliateAdminApi.updateConfig({
        enabled: formData.enabled,
        defaultRate,
        settlementDays,
        minPayoutAmount,
      });

      toast({
        title: getText('tenant.affiliate.config.updated', 'Configuration updated'),
        description: getText('tenant.affiliate.config.updatedDesc', 'Affiliate commission settings have been updated successfully'),
      });

      onUpdate();
    } catch (error: any) {
      toast({
        title: getText('tenant.affiliate.config.updateFailed', 'Update failed'),
        description: error.message || getText('tenant.affiliate.config.updateFailedDesc', 'Failed to update configuration'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{getText('tenant.affiliate.config.title', 'Commission Configuration')}</CardTitle>
        <CardDescription>
          {getText('tenant.affiliate.config.description', 'Configure affiliate commission settings for your store')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 启用开关 */}
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="enabled">{getText('tenant.affiliate.config.enableSystem', 'Enable Affiliate System')}</Label>
              <p className="text-sm text-muted-foreground">
                {getText('tenant.affiliate.config.enableSystemDesc', 'Allow users to earn commissions by referring others')}
              </p>
            </div>
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, enabled: checked }))
              }
              disabled={isLoading}
            />
          </div>

          <div className="border-t pt-6 space-y-4">
            {/* 默认分润比例 */}
            <div className="space-y-2">
              <Label htmlFor="defaultRate">{getText('tenant.affiliate.config.defaultRate', 'Default Commission Rate (%)')}</Label>
              <Input
                id="defaultRate"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formData.defaultRate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, defaultRate: e.target.value }))
                }
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {getText('tenant.affiliate.config.defaultRateDesc', 'Default commission percentage for all affiliates (can be customized per user)')}
              </p>
            </div>

            {/* 结算天数 */}
            <div className="space-y-2">
              <Label htmlFor="settlementDays">{getText('tenant.affiliate.config.settlementPeriod', 'Settlement Period (Days)')}</Label>
              <Input
                id="settlementDays"
                type="number"
                min="1"
                value={formData.settlementDays}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, settlementDays: e.target.value }))
                }
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {getText('tenant.affiliate.config.settlementPeriodDesc', 'Number of days before commissions become available for withdrawal (to allow for refunds)')}
              </p>
            </div>

            {/* 最低提现金额 */}
            <div className="space-y-2">
              <Label htmlFor="minPayoutAmount">{getText('tenant.affiliate.config.minPayout', 'Minimum Payout Amount ($)')}</Label>
              <Input
                id="minPayoutAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.minPayoutAmount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, minPayoutAmount: e.target.value }))
                }
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {getText('tenant.affiliate.config.minPayoutDesc', 'Minimum amount required to request a payout')}
              </p>
            </div>
          </div>

          {/* 提交按钮 */}
          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {getText('common.saving', 'Saving...')}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {getText('tenant.affiliate.config.saveConfig', 'Save Configuration')}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

