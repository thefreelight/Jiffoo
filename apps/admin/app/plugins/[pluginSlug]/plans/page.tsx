'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { pluginManagementApi } from '@/lib/api';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  DollarSign,
  Users,
  TrendingUp,
  Check,
  X
} from 'lucide-react';

interface Plan {
  id: string;
  pluginId: string;
  planId: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  billingCycle: string;
  trialDays?: number;
  stripePriceId?: string;
  features?: string[];
  limits?: Record<string, number>;
  isActive: boolean;
  activeSubscriptions?: number;
  totalRevenue?: number;
}

export default function PlansManagementPage() {
  const params = useParams();
  const router = useRouter();
  const pluginSlug = params.pluginSlug as string;

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    planId: '',
    name: '',
    description: '',
    amount: '',
    currency: 'usd',
    billingCycle: 'monthly',
    trialDays: '',
    stripePriceId: '',
    features: '',
    apiCallsLimit: '',
    transactionsLimit: '',
    emailsSentLimit: '',
    loginAttemptsLimit: '',
    isActive: true
  });

  // 🔧 动态获取限制字段（根据pluginSlug）
  const getLimitFields = () => {
    if (pluginSlug === 'stripe') {
      return [
        { key: 'api_calls', label: 'API Calls Limit (per month)', formKey: 'apiCallsLimit' },
        { key: 'transactions', label: '💳 Transactions Limit (per month)', formKey: 'transactionsLimit' }
      ];
    } else if (pluginSlug === 'resend-email') {
      return [
        { key: 'api_calls', label: 'API Calls Limit (per month)', formKey: 'apiCallsLimit' },
        { key: 'emails_sent', label: '📧 Emails Sent Limit (per month)', formKey: 'emailsSentLimit' }
      ];
    } else if (pluginSlug === 'google-oauth') {
      return [
        { key: 'api_calls', label: 'API Calls Limit (per month)', formKey: 'apiCallsLimit' },
        { key: 'login_attempts', label: '🔐 Login Attempts Limit (per month)', formKey: 'loginAttemptsLimit' }
      ];
    }
    // 默认只显示API Calls
    return [
      { key: 'api_calls', label: 'API Calls Limit (per month)', formKey: 'apiCallsLimit' }
    ];
  };

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await pluginManagementApi.getSubscriptionPlans(pluginSlug);

      if (response.success && response.data) {
        // Backend returns subscriptionPlans, not plans
        setPlans(response.data.subscriptionPlans || []);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to load plans';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [pluginSlug]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const resetForm = () => {
    setFormData({
      planId: '',
      name: '',
      description: '',
      amount: '',
      currency: 'usd',
      billingCycle: 'monthly',
      trialDays: '',
      stripePriceId: '',
      features: '',
      apiCallsLimit: '',
      transactionsLimit: '',
      emailsSentLimit: '',
      loginAttemptsLimit: '',
      isActive: true
    });
  };

  const handleCreate = async () => {
    try {
      setSubmitting(true);

      // ✅ 验证：付费计划必须填写 Stripe Price ID
      const amount = parseFloat(formData.amount);
      if (amount > 0 && !formData.stripePriceId) {
        alert('⚠️ Paid plans require a Stripe Price ID. Please create a Price in Stripe first, then paste the Price ID here.');
        setSubmitting(false);
        return;
      }

      // 🔧 动态构建limits对象（根据pluginSlug）
      const limits: any = {};
      if (formData.apiCallsLimit) {
        limits.api_calls = formData.apiCallsLimit === '-1' ? -1 : parseInt(formData.apiCallsLimit);
      }
      if (pluginSlug === 'stripe' && formData.transactionsLimit) {
        limits.transactions = formData.transactionsLimit === '-1' ? -1 : parseInt(formData.transactionsLimit);
      }
      if (pluginSlug === 'resend-email' && formData.emailsSentLimit) {
        limits.emails_sent = formData.emailsSentLimit === '-1' ? -1 : parseInt(formData.emailsSentLimit);
      }
      if (pluginSlug === 'google-oauth' && formData.loginAttemptsLimit) {
        limits.login_attempts = formData.loginAttemptsLimit === '-1' ? -1 : parseInt(formData.loginAttemptsLimit);
      }

      const data: any = {
        planId: formData.planId,
        name: formData.name,
        description: formData.description || undefined,
        amount: amount,
        currency: formData.currency,
        billingCycle: formData.billingCycle,
        trialDays: formData.trialDays ? parseInt(formData.trialDays) : undefined,
        stripePriceId: formData.stripePriceId || undefined,
        features: formData.features ? formData.features.split('\n').filter(f => f.trim()) : undefined,
        limits: Object.keys(limits).length > 0 ? limits : undefined,
        isActive: formData.isActive
      };

      const response = await pluginManagementApi.createSubscriptionPlan(pluginSlug, data);

      if (response.success) {
        setShowCreateDialog(false);
        resetForm();
        loadPlans();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedPlan) return;

    try {
      setSubmitting(true);

      // ✅ 验证：付费计划必须填写 Stripe Price ID
      const amount = parseFloat(formData.amount);
      if (amount > 0 && !formData.stripePriceId) {
        alert('⚠️ Paid plans require a Stripe Price ID. Please create a Price in Stripe first, then paste the Price ID here.');
        setSubmitting(false);
        return;
      }

      // 🔧 动态构建limits对象（根据pluginSlug）
      const limits: any = {};
      if (formData.apiCallsLimit) {
        limits.api_calls = formData.apiCallsLimit === '-1' ? -1 : parseInt(formData.apiCallsLimit);
      }
      if (pluginSlug === 'stripe' && formData.transactionsLimit) {
        limits.transactions = formData.transactionsLimit === '-1' ? -1 : parseInt(formData.transactionsLimit);
      }
      if (pluginSlug === 'resend-email' && formData.emailsSentLimit) {
        limits.emails_sent = formData.emailsSentLimit === '-1' ? -1 : parseInt(formData.emailsSentLimit);
      }
      if (pluginSlug === 'google-oauth' && formData.loginAttemptsLimit) {
        limits.login_attempts = formData.loginAttemptsLimit === '-1' ? -1 : parseInt(formData.loginAttemptsLimit);
      }

      const data: any = {
        name: formData.name,
        description: formData.description || undefined,
        amount: amount,
        trialDays: formData.trialDays ? parseInt(formData.trialDays) : undefined,
        stripePriceId: formData.stripePriceId || undefined,
        features: formData.features ? formData.features.split('\n').filter(f => f.trim()) : undefined,
        limits: Object.keys(limits).length > 0 ? limits : undefined,
        isActive: formData.isActive
      };

      const response = await pluginManagementApi.updateSubscriptionPlan(
        pluginSlug,
        selectedPlan.planId,
        data
      );

      if (response.success) {
        setShowEditDialog(false);
        setSelectedPlan(null);
        resetForm();
        loadPlans();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update plan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPlan) return;

    try {
      setSubmitting(true);

      const response = await pluginManagementApi.deleteSubscriptionPlan(
        pluginSlug,
        selectedPlan.planId
      );

      if (response.success) {
        setShowDeleteDialog(false);
        setSelectedPlan(null);
        loadPlans();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete plan');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (plan: Plan) => {
    setSelectedPlan(plan);

    // 🔧 动态解析limits（根据pluginSlug）
    const limits = plan.limits as any;
    const apiCallsLimit = limits?.api_calls?.toString() || '';
    const transactionsLimit = limits?.transactions?.toString() || '';
    const emailsSentLimit = limits?.emails_sent?.toString() || '';
    const loginAttemptsLimit = limits?.login_attempts?.toString() || '';

    setFormData({
      planId: plan.planId,
      name: plan.name,
      description: plan.description || '',
      amount: plan.amount.toString(),
      currency: plan.currency,
      billingCycle: plan.billingCycle,
      trialDays: plan.trialDays?.toString() || '',
      stripePriceId: plan.stripePriceId || '',
      features: plan.features?.join('\n') || '',
      apiCallsLimit,
      transactionsLimit,
      emailsSentLimit,
      loginAttemptsLimit,
      isActive: plan.isActive
    });
    setShowEditDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading plans...</p>
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
          <Button onClick={loadPlans} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
            <h1 className="text-3xl font-bold">Subscription Plans</h1>
            <p className="text-gray-600">{pluginSlug} • {plans.length} plans</p>
          </div>
        </div>
        <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </div>

      {/* Plans Grid */}
      {plans.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500">No plans found</p>
            <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.id} className={!plan.isActive ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <CardDescription>{plan.description || 'No description'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-3xl font-bold flex items-center">
                      <DollarSign className="h-6 w-6" />
                      {plan.amount.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {plan.currency.toUpperCase()} / {plan.billingCycle}
                    </p>
                  </div>

                  {plan.trialDays && (
                    <p className="text-sm text-blue-600">
                      {plan.trialDays} days free trial
                    </p>
                  )}

                  {plan.features && plan.features.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Features:</p>
                      <ul className="space-y-1">
                        {plan.features.slice(0, 3).map((feature, idx) => (
                          <li key={idx} className="text-sm text-gray-600 flex items-start">
                            <Check className="h-4 w-4 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                            {feature}
                          </li>
                        ))}
                        {plan.features.length > 3 && (
                          <li className="text-sm text-gray-400">
                            +{plan.features.length - 3} more...
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="pt-4 border-t space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center">
                        <Users className="h-4 w-4 mr-1" />
                        Active Subscriptions
                      </span>
                      <span className="font-semibold">{plan.activeSubscriptions || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        Total Revenue
                      </span>
                      <span className="font-semibold">${(plan.totalRevenue || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEditDialog(plan)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-red-600 hover:text-red-700"
                      onClick={() => { setSelectedPlan(plan); setShowDeleteDialog(true); }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setShowEditDialog(false);
          setSelectedPlan(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showCreateDialog ? 'Create New Plan' : 'Edit Plan'}</DialogTitle>
            <DialogDescription>
              {showCreateDialog ? 'Add a new subscription plan' : 'Update plan details'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Plan ID *</label>
                <Input
                  placeholder="e.g., basic_monthly"
                  value={formData.planId}
                  onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                  disabled={showEditDialog}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Plan Name *</label>
                <Input
                  placeholder="e.g., Basic Plan"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                placeholder="Plan description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Amount *</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="29.99"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Currency *</label>
                <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usd">USD</SelectItem>
                    <SelectItem value="eur">EUR</SelectItem>
                    <SelectItem value="gbp">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Billing Cycle *</label>
                <Select value={formData.billingCycle} onValueChange={(value) => setFormData({ ...formData, billingCycle: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Trial Days</label>
              <Input
                type="number"
                placeholder="14"
                value={formData.trialDays}
                onChange={(e) => setFormData({ ...formData, trialDays: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Stripe Price ID</label>
              <Input
                placeholder="price_1SFWcnB6vJBDO7CtqxVJVW5n"
                value={formData.stripePriceId}
                onChange={(e) => setFormData({ ...formData, stripePriceId: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 Create a Price in Stripe Dashboard first, then paste the Price ID here (e.g., price_xxx)
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Features (one per line)</label>
              <Textarea
                placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
                value={formData.features}
                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                rows={4}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Usage Limits</label>
              <div className="grid grid-cols-2 gap-4">
                {/* 🔧 动态渲染限制字段 */}
                {getLimitFields().map((field) => (
                  <div key={field.key}>
                    <label className="text-xs text-gray-600 mb-1 block">{field.label}</label>
                    <Input
                      type="number"
                      placeholder="10000 or -1 for unlimited"
                      value={formData[field.formKey as keyof typeof formData] as string}
                      onChange={(e) => setFormData({ ...formData, [field.formKey]: e.target.value })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Use -1 for unlimited</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="isActive" className="text-sm font-medium">
                Active (visible to customers)
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setShowEditDialog(false);
              setSelectedPlan(null);
              resetForm();
            }} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={showCreateDialog ? handleCreate : handleEdit} disabled={submitting || !formData.planId || !formData.name || !formData.amount}>
              {submitting ? 'Saving...' : (showCreateDialog ? 'Create Plan' : 'Update Plan')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedPlan?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setSelectedPlan(null); }} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting ? 'Deleting...' : 'Delete Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

