/**
 * 联盟仪表板页面组件
 * 展示推荐代码、统计信息、佣金和提现管理
 */

import React from 'react';
import { Loader2, Copy, TrendingUp, DollarSign, Users, Award } from 'lucide-react';
import type { AffiliateDashboardPageProps } from '../../../../shared/src/types/theme';
import { Button } from '../ui/Button';

export function AffiliateDashboardPage({
  referralCode,
  stats,
  commissions,
  payouts,
  isLoading,
  isLoadingCommissions,
  isLoadingPayouts,
  config,
  onRequestPayout,
  onLoadMoreCommissions,
  onLoadMorePayouts,
}: AffiliateDashboardPageProps) {
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [payoutAmount, setPayoutAmount] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'commissions' | 'payouts'>('commissions');

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRequestPayout = async () => {
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) {
      return;
    }
    try {
      await onRequestPayout(parseFloat(payoutAmount));
      setPayoutAmount('');
    } catch (error) {
      console.error('Failed to request payout:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading affiliate dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Affiliate Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your referrals and track your earnings
          </p>
        </div>

        {/* 邀请码卡片 */}
        <div className="mb-8 bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Your Referral Code</h2>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded font-mono text-lg">
              {referralCode}
            </code>
            <Button
              onClick={handleCopyCode}
              variant="outline"
              size="sm"
            >
              <Copy className="h-4 w-4 mr-2" />
              {copiedCode ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Referrals</p>
                <p className="text-2xl font-bold">{stats.totalReferrals}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Commissions</p>
                <p className="text-2xl font-bold">${stats.totalCommissions.toFixed(2)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-2xl font-bold">${stats.availableBalance.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Balance</p>
                <p className="text-2xl font-bold">${stats.pendingBalance.toFixed(2)}</p>
              </div>
              <Award className="h-8 w-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="space-y-6">
          <div className="flex gap-4 border-b border-gray-200 dark:border-gray-800">
            <button
              onClick={() => setActiveTab('commissions')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'commissions'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Commissions
            </button>
            <button
              onClick={() => setActiveTab('payouts')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'payouts'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Payouts
            </button>
          </div>

          {/* 佣金记录 Tab */}
          {activeTab === 'commissions' && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Commission History</h2>
              {isLoadingCommissions ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p className="text-muted-foreground">Loading commissions...</p>
                </div>
              ) : commissions.length === 0 ? (
                <div className="text-center py-8 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground">No commissions yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {commissions.map((commission) => (
                    <div key={commission.id} className="bg-white dark:bg-gray-900 rounded-lg p-4 flex justify-between items-center">
                      <div>
                        <p className="font-medium">Order #{commission.orderId}</p>
                        <p className="text-sm text-muted-foreground">{new Date(commission.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">${commission.amount.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground capitalize">{commission.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 提现管理 Tab */}
          {activeTab === 'payouts' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 提现申请表单 */}
                <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm">
                  <h3 className="text-lg font-semibold mb-4">Request Payout</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Amount</label>
                      <input
                        type="number"
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        placeholder="Enter amount"
                        min="50"
                        max={stats.availableBalance}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Minimum: $50</p>
                    </div>
                    <Button
                      onClick={handleRequestPayout}
                      disabled={!payoutAmount || parseFloat(payoutAmount) < 50 || parseFloat(payoutAmount) > stats.availableBalance}
                      className="w-full"
                    >
                      Request Payout
                    </Button>
                  </div>
                </div>

                {/* 提现说明 */}
                <div className="bg-muted/50 border border-border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Payout Information</h3>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                      <p>Commissions are available for withdrawal after a 7-day settlement period</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                      <p>Minimum payout amount is $50</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                      <p>Payout requests are reviewed by the admin and typically processed within 3-5 business days</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                      <p>You will receive a notification once your payout is processed</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 提现历史 */}
              <div>
                <h2 className="text-2xl font-semibold mb-4">Payout History</h2>
                {isLoadingPayouts ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p className="text-muted-foreground">Loading payouts...</p>
                  </div>
                ) : payouts.length === 0 ? (
                  <div className="text-center py-8 bg-muted/50 rounded-lg">
                    <p className="text-muted-foreground">No payouts yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {payouts.map((payout) => (
                      <div key={payout.id} className="bg-white dark:bg-gray-900 rounded-lg p-4 flex justify-between items-center">
                        <div>
                          <p className="font-medium">Payout Request</p>
                          <p className="text-sm text-muted-foreground">{new Date(payout.requestedAt).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">${payout.amount.toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground capitalize">{payout.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

