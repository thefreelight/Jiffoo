/**
 * Affiliate Dashboard Page for Shop Application
 *
 * Displays affiliate program dashboard with referral stats and payouts.
 * Supports i18n through the translation function.
 */

'use client';

import React from 'react';
import { useAuthStore } from '@/store/auth';
import { useAffiliateStore } from '@/store/affiliate';
import { useToast } from '@/hooks/use-toast';
import { useShopTheme } from '@/lib/themes/provider';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n';

export default function AffiliatePage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuthStore();
  const t = useT();
  const {
    referralCode,
    stats,
    commissions,
    payouts,
    isLoading,
    isLoadingCommissions,
    isLoadingPayouts,
    fetchReferralCode,
    fetchStats,
    fetchCommissions,
    fetchPayouts,
    requestPayout,
  } = useAffiliateStore();

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Check authentication status
  React.useEffect(() => {
    if (!isAuthenticated) {
      toast({
        title: getText('shop.affiliate.authRequired', 'Authentication required'),
        description: getText('shop.affiliate.authRequiredDescription', 'Please login to access affiliate dashboard'),
        variant: 'destructive',
      });
      nav.push('/auth/login');
    }
  }, [isAuthenticated, nav, toast, getText]);

  // Load data
  React.useEffect(() => {
    if (isAuthenticated) {
      const loadData = async () => {
        try {
          await Promise.all([
            fetchReferralCode(),
            fetchStats(),
            fetchCommissions({ page: 1, limit: 10 }),
            fetchPayouts({ page: 1, limit: 10 }),
          ]);
        } catch (error: any) {
          toast({
            title: getText('shop.affiliate.loadFailed', 'Failed to load data'),
            description: error.message || getText('common.errors.tryAgain', 'Please try again later'),
            variant: 'destructive',
          });
        }
      };

      loadData();
    }
  }, [isAuthenticated, fetchReferralCode, fetchStats, fetchCommissions, fetchPayouts, toast, getText]);

  // Theme loading state
  if (themeLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Check theme component availability
  if (!theme?.components?.AffiliateDashboardPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-6">
          <h1 className="text-xl font-bold text-red-600">{getText('common.errors.componentUnavailable', 'Affiliate Dashboard Not Found')}</h1>
          <p className="mt-2 text-sm text-gray-600">{getText('common.errors.componentUnavailable', 'The affiliate dashboard component is not available in the current theme.')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleRequestPayout = async (amount: number) => {
    try {
      await requestPayout({
        amount,
        method: 'BANK_TRANSFER',
        accountInfo: {},
      });
      toast({
        title: getText('common.status.success', 'Success'),
        description: getText('shop.affiliate.payoutSuccess', 'Payout request submitted successfully'),
      });
      // Refresh data
      await Promise.all([
        fetchStats(),
        fetchPayouts({ page: 1, limit: 10 }),
      ]);
    } catch (error: any) {
      toast({
        title: getText('common.errors.error', 'Error'),
        description: error.message || getText('shop.affiliate.payoutFailed', 'Failed to request payout'),
        variant: 'destructive',
      });
    }
  };

  const handleLoadMoreCommissions = async (page: number) => {
    try {
      await fetchCommissions({ page, limit: 10 });
    } catch (error: any) {
      toast({
        title: getText('common.errors.error', 'Error'),
        description: error.message || getText('shop.affiliate.loadCommissionsFailed', 'Failed to load commissions'),
        variant: 'destructive',
      });
    }
  };

  const handleLoadMorePayouts = async (page: number) => {
    try {
      await fetchPayouts({ page, limit: 10 });
    } catch (error: any) {
      toast({
        title: getText('common.errors.error', 'Error'),
        description: error.message || getText('shop.affiliate.loadPayoutsFailed', 'Failed to load payouts'),
        variant: 'destructive',
      });
    }
  };

  const AffiliateDashboardPageComponent = theme.components.AffiliateDashboardPage;

  // Transform payouts data format
  const transformedPayouts = (payouts || []).map((payout) => ({
    id: payout.id,
    amount: payout.amount,
    status: payout.status,
    requestedAt: payout.createdAt,
    processedAt: payout.processedAt || undefined,
  }));

  return (
    <AffiliateDashboardPageComponent
      referralCode={referralCode || ''}
      stats={stats || {
        totalReferrals: 0,
        totalCommissions: 0,
        availableBalance: 0,
        pendingBalance: 0,
      }}
      commissions={commissions || []}
      payouts={transformedPayouts}
      isLoading={isLoading}
      isLoadingCommissions={isLoadingCommissions}
      isLoadingPayouts={isLoadingPayouts}
      config={config}
      locale={nav.locale}
      t={t}
      onRequestPayout={handleRequestPayout}
      onLoadMoreCommissions={handleLoadMoreCommissions}
      onLoadMorePayouts={handleLoadMorePayouts}
    />
  );
}

