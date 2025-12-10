/**
 * 联盟仪表板页面组件
 * 展示推荐代码、统计信息、佣金和提现管理
 * Uses @jiffoo/ui design system.
 */

import React from 'react';
import { Loader2, Copy, TrendingUp, DollarSign, Users, Award } from 'lucide-react';
import type { AffiliateDashboardPageProps } from '../../../../shared/src/types/theme';
import { Button } from '../ui/Button';
import { cn } from '@jiffoo/ui';

export function AffiliateDashboardPage({ referralCode, stats, commissions, payouts, isLoading, isLoadingCommissions, isLoadingPayouts, config, onRequestPayout, onLoadMoreCommissions, onLoadMorePayouts }: AffiliateDashboardPageProps) {
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [payoutAmount, setPayoutAmount] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'commissions' | 'payouts'>('commissions');

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRequestPayout = async () => {
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) return;
    try {
      await onRequestPayout(parseFloat(payoutAmount));
      setPayoutAmount('');
    } catch (error) {
      console.error('Failed to request payout:', error);
    }
  };

  const inputStyles = cn('w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400', 'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all duration-150');

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-neutral-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-brand-600 mx-auto mb-4" />
          <p className="text-neutral-500">Loading affiliate dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="container mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Affiliate Dashboard</h1>
          <p className="text-neutral-500">Manage your referrals and track your earnings</p>
        </div>

        {/* 邀请码卡片 */}
        <div className="mb-8 bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
          <h2 className="text-xl font-semibold text-neutral-900 mb-4">Your Referral Code</h2>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-neutral-100 px-4 py-3 rounded-xl font-mono text-lg text-neutral-900">{referralCode}</code>
            <Button onClick={handleCopyCode} variant="outline" size="sm">
              <Copy className="h-4 w-4 mr-2" />
              {copiedCode ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Total Referrals', value: stats.totalReferrals, icon: Users, color: 'bg-brand-50 text-brand-600' },
            { label: 'Total Commissions', value: `$${stats.totalCommissions.toFixed(2)}`, icon: TrendingUp, color: 'bg-success-50 text-success-600' },
            { label: 'Available Balance', value: `$${stats.availableBalance.toFixed(2)}`, icon: DollarSign, color: 'bg-warning-50 text-warning-600' },
            { label: 'Pending Balance', value: `$${stats.pendingBalance.toFixed(2)}`, icon: Award, color: 'bg-purple-50 text-purple-600' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
                </div>
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', stat.color.split(' ')[0])}>
                  <stat.icon className={cn('h-6 w-6', stat.color.split(' ')[1])} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="space-y-6">
          <div className="flex gap-4 border-b border-neutral-200">
            <button onClick={() => setActiveTab('commissions')} className={cn('px-4 py-2 font-medium border-b-2 transition-colors', activeTab === 'commissions' ? 'border-brand-600 text-brand-600' : 'border-transparent text-neutral-500 hover:text-neutral-900')}>
              Commissions
            </button>
            <button onClick={() => setActiveTab('payouts')} className={cn('px-4 py-2 font-medium border-b-2 transition-colors', activeTab === 'payouts' ? 'border-brand-600 text-brand-600' : 'border-transparent text-neutral-500 hover:text-neutral-900')}>
              Payouts
            </button>
          </div>

          {/* 佣金记录 Tab */}
          {activeTab === 'commissions' && (
            <div>
              <h2 className="text-2xl font-semibold text-neutral-900 mb-4">Commission History</h2>
              {isLoadingCommissions ? (
                <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-brand-600" /><p className="text-neutral-500">Loading commissions...</p></div>
              ) : commissions.length === 0 ? (
                <div className="text-center py-8 bg-neutral-100 rounded-2xl"><p className="text-neutral-500">No commissions yet</p></div>
              ) : (
                <div className="space-y-3">
                  {commissions.map((commission) => (
                    <div key={commission.id} className="bg-white rounded-2xl p-4 border border-neutral-100 flex justify-between items-center">
                      <div><p className="font-medium text-neutral-900">Order #{commission.orderId}</p><p className="text-sm text-neutral-500">{new Date(commission.createdAt).toLocaleDateString()}</p></div>
                      <div className="text-right"><p className="font-bold text-success-600">${commission.amount.toFixed(2)}</p><p className="text-sm text-neutral-500 capitalize">{commission.status}</p></div>
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
                <div className="bg-white rounded-2xl p-6 border border-neutral-100 shadow-sm">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Request Payout</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">Amount</label>
                      <input type="number" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} placeholder="Enter amount" min="50" max={stats.availableBalance} className={inputStyles} />
                      <p className="text-xs text-neutral-400 mt-1">Minimum: $50</p>
                    </div>
                    <Button onClick={handleRequestPayout} disabled={!payoutAmount || parseFloat(payoutAmount) < 50 || parseFloat(payoutAmount) > stats.availableBalance} className="w-full">Request Payout</Button>
                  </div>
                </div>

                {/* 提现说明 */}
                <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Payout Information</h3>
                  <div className="space-y-3 text-sm text-neutral-500">
                    {['Commissions are available for withdrawal after a 7-day settlement period', 'Minimum payout amount is $50', 'Payout requests are reviewed by the admin and typically processed within 3-5 business days', 'You will receive a notification once your payout is processed'].map((text, i) => (
                      <div key={i} className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-2" /><p>{text}</p></div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 提现历史 */}
              <div>
                <h2 className="text-2xl font-semibold text-neutral-900 mb-4">Payout History</h2>
                {isLoadingPayouts ? (
                  <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-brand-600" /><p className="text-neutral-500">Loading payouts...</p></div>
                ) : payouts.length === 0 ? (
                  <div className="text-center py-8 bg-neutral-100 rounded-2xl"><p className="text-neutral-500">No payouts yet</p></div>
                ) : (
                  <div className="space-y-3">
                    {payouts.map((payout) => (
                      <div key={payout.id} className="bg-white rounded-2xl p-4 border border-neutral-100 flex justify-between items-center">
                        <div><p className="font-medium text-neutral-900">Payout Request</p><p className="text-sm text-neutral-500">{new Date(payout.requestedAt).toLocaleDateString()}</p></div>
                        <div className="text-right"><p className="font-bold text-neutral-900">${payout.amount.toFixed(2)}</p><p className="text-sm text-neutral-500 capitalize">{payout.status}</p></div>
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

