'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Search,
  Download,
  Settings,
  Shield,
  Star,
  DollarSign,
  Globe,
  CreditCard,
  Smartphone,
  CheckCircle,
  AlertCircle,
  Package,
  Filter
} from 'lucide-react';

interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  license: 'free' | 'basic' | 'premium' | 'enterprise';
  price?: number;
  regions: string[];
  currencies: string[];
  methods: string[];
  features: string[];
  requirements: {
    minCoreVersion: string;
    dependencies?: string[];
  };
  configuration: {
    required: string[];
    optional: string[];
  };
  isInstalled?: boolean;
  isActive?: boolean;
}

interface PluginStats {
  totalAvailable: number;
  totalInstalled: number;
  byLicense: {
    free: number;
    basic: number;
    premium: number;
    enterprise: number;
  };
}

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<Plugin[]>([]);
  const [stats, setStats] = useState<PluginStats | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLicense, setSelectedLicense] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPluginData();
  }, []);

  const fetchPluginData = async () => {
    try {
      setLoading(true);

      // Mock data for demonstration
      const mockPlugins = [
        {
          id: 'stripe-payment-plugin',
          name: 'Stripe Payment Gateway',
          description: 'Accept credit card and debit card payments via Stripe. Supports 3D Secure, Apple Pay, Google Pay, and 135+ currencies worldwide.',
          author: 'Jiffoo Team',
          version: '2.1.0',
          license: 'premium',
          price: 29,
          methods: ['credit_card', 'debit_card', 'apple_pay', 'google_pay'],
          features: ['3D_Secure', 'Multi_Currency', 'Recurring_Payments', 'Fraud_Protection', 'Real_Time_Analytics'],
          isInstalled: true,
          isActive: true,
        },
        {
          id: 'paypal-payment-plugin',
          name: 'PayPal Payment Gateway',
          description: 'Integrate PayPal payments with support for PayPal Credit, Express Checkout, and international transactions.',
          author: 'Jiffoo Team',
          version: '1.8.5',
          license: 'premium',
          price: 19,
          methods: ['paypal', 'paypal_credit'],
          features: ['Express_Checkout', 'International_Support', 'Buyer_Protection', 'Mobile_Optimized'],
          isInstalled: true,
          isActive: true,
        },
        {
          id: 'wechat-pay-plugin',
          name: 'WeChat Pay',
          description: 'Accept payments from Chinese customers using WeChat Pay. Perfect for businesses targeting the Chinese market.',
          author: 'Payment Solutions Inc',
          version: '1.2.3',
          license: 'premium',
          price: 39,
          methods: ['wechat_pay'],
          features: ['QR_Code_Payments', 'Mobile_App_Integration', 'CNY_Support', 'Real_Time_Settlement'],
          isInstalled: false,
          isActive: false,
        },
        {
          id: 'alipay-plugin',
          name: 'Alipay Gateway',
          description: 'Enable Alipay payments for seamless transactions with Chinese customers. Supports both domestic and international Alipay.',
          author: 'Payment Solutions Inc',
          version: '1.5.2',
          license: 'premium',
          price: 35,
          methods: ['alipay'],
          features: ['Domestic_Alipay', 'International_Alipay', 'QR_Payments', 'Mobile_SDK'],
          isInstalled: false,
          isActive: false,
        },
        {
          id: 'crypto-payment-plugin',
          name: 'Cryptocurrency Payments',
          description: 'Accept Bitcoin, Ethereum, and other major cryptocurrencies. Automatic conversion to fiat currency available.',
          author: 'CryptoGate Ltd',
          version: '3.0.1',
          license: 'enterprise',
          price: 99,
          methods: ['bitcoin', 'ethereum', 'litecoin'],
          features: ['Multi_Crypto_Support', 'Auto_Conversion', 'Cold_Storage', 'Tax_Reporting'],
          isInstalled: false,
          isActive: false,
        },
        {
          id: 'bank-transfer-plugin',
          name: 'Bank Transfer Gateway',
          description: 'Direct bank transfers and ACH payments. Perfect for high-value transactions with lower processing fees.',
          author: 'FinTech Solutions',
          version: '2.3.0',
          license: 'basic',
          price: 15,
          methods: ['bank_transfer', 'ach'],
          features: ['ACH_Support', 'SEPA_Transfers', 'Low_Fees', 'Batch_Processing'],
          isInstalled: false,
          isActive: false,
        },
      ];

      setPlugins(mockPlugins);
      setInstalledPlugins(mockPlugins.filter(p => p.isInstalled));

      setStats({
        totalAvailable: mockPlugins.length,
        totalInstalled: mockPlugins.filter(p => p.isInstalled).length,
        byLicense: {
          free: 0,
          basic: mockPlugins.filter(p => p.license === 'basic').length,
          premium: mockPlugins.filter(p => p.license === 'premium').length,
          enterprise: mockPlugins.filter(p => p.license === 'enterprise').length,
        },
      });

      // Try to fetch real data from API as fallback
      try {
        const marketplaceResponse = await fetch('/api/payments/plugins/marketplace');
        if (marketplaceResponse.ok) {
          const marketplaceData = await marketplaceResponse.json();
          if (marketplaceData.success) {
            setStats({
              totalAvailable: marketplaceData.data.totalAvailable,
              totalInstalled: marketplaceData.data.totalInstalled,
              byLicense: marketplaceData.data.byLicense,
            });
          }
        }
      } catch (apiError) {
        console.log('API not available, using mock data');
      }
    } catch (error) {
      console.error('Failed to fetch plugin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInstallPlugin = async (pluginId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        alert('Please login to install plugins');
        return;
      }

      // For demo purposes, we'll use test license keys
      const licenseKey = pluginId === 'stripe-payment-plugin' ? 'stripe-license-123' : 'paypal-license-456';

      const response = await fetch(`/api/payments/plugins/${pluginId}/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ licenseKey }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`Plugin installed successfully!`);
        fetchPluginData(); // Refresh data
      } else {
        alert(`Installation failed: ${data.message}`);
      }
    } catch (error) {
      console.error('Installation failed:', error);
      alert('Installation failed. Please try again.');
    }
  };

  const filteredPlugins = plugins.filter(plugin => {
    const matchesSearch = plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         plugin.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLicense = selectedLicense === 'all' || plugin.license === selectedLicense;
    return matchesSearch && matchesLicense;
  });

  const getLicenseBadgeColor = (license: string) => {
    switch (license) {
      case 'free': return 'bg-green-100 text-green-800';
      case 'basic': return 'bg-blue-100 text-blue-800';
      case 'premium': return 'bg-purple-100 text-purple-800';
      case 'enterprise': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'credit_card':
      case 'debit_card':
        return <CreditCard className="w-4 h-4" />;
      case 'paypal':
        return <Globe className="w-4 h-4" />;
      case 'wechat_pay':
      case 'alipay':
        return <Smartphone className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading plugins...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg mb-4">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Plugin Store
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Extend your payment capabilities with powerful, enterprise-grade plugins
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Available Plugins</p>
                  <p className="text-3xl font-bold text-gray-900">{stats?.totalAvailable || 12}</p>
                  <p className="text-xs text-green-600 mt-1">+2 this month</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Package className="w-8 h-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Installed</p>
                  <p className="text-3xl font-bold text-gray-900">{stats?.totalInstalled || 3}</p>
                  <p className="text-xs text-blue-600 mt-1">Active & Running</p>
                </div>
                <div className="p-3 bg-green-100 rounded-xl">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Premium Plugins</p>
                  <p className="text-3xl font-bold text-gray-900">{stats?.byLicense.premium || 8}</p>
                  <p className="text-xs text-purple-600 mt-1">Enterprise Ready</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-xl">
                  <Star className="w-8 h-8 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Revenue Impact</p>
                  <p className="text-3xl font-bold text-gray-900">+24%</p>
                  <p className="text-xs text-emerald-600 mt-1">vs last month</p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <Shield className="w-8 h-8 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search plugins by name, category, or feature..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 pr-4 py-3 text-lg border-0 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl"
                />
              </div>

              <div className="flex gap-3">
                <select
                  value={selectedLicense}
                  onChange={(e) => setSelectedLicense(e.target.value)}
                  className="px-4 py-3 border-0 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="all">All Licenses</option>
                  <option value="free">Free</option>
                  <option value="basic">Basic</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>

                <Button variant="outline" className="px-6 py-3 rounded-xl border-0 bg-gray-50 hover:bg-gray-100">
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Tabs */}
      <Tabs defaultValue="marketplace" className="space-y-4">
        <TabsList>
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="installed">Installed ({installedPlugins.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace" className="space-y-6">
          {/* Featured Plugins */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">Featured Plugins</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredPlugins.slice(0, 2).map((plugin) => {
                const isInstalled = installedPlugins.some(installed => installed.id === plugin.id);
                return (
                  <Card key={plugin.id} className="bg-gradient-to-br from-white to-blue-50/50 border-0 shadow-xl hover:shadow-2xl transition-all duration-300 group">
                    <CardContent className="p-8">
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                            {getMethodIcon(plugin.methods[0])}
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">{plugin.name}</h3>
                            <p className="text-gray-600">by {plugin.author} • v{plugin.version}</p>
                          </div>
                        </div>
                        <Badge className={`${getLicenseBadgeColor(plugin.license)} px-3 py-1`}>
                          {plugin.license}
                        </Badge>
                      </div>

                      <p className="text-gray-700 mb-6 leading-relaxed">
                        {plugin.description}
                      </p>

                      <div className="space-y-4">
                        {/* Payment Methods */}
                        <div>
                          <p className="text-sm font-medium text-gray-900 mb-2">Payment Methods</p>
                          <div className="flex flex-wrap gap-2">
                            {plugin.methods.map((method) => (
                              <div key={method} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-sm border">
                                {getMethodIcon(method)}
                                <span className="text-sm font-medium">{method.replace('_', ' ')}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Features */}
                        <div>
                          <p className="text-sm font-medium text-gray-900 mb-2">Key Features</p>
                          <div className="flex flex-wrap gap-2">
                            {plugin.features.map((feature) => (
                              <Badge key={feature} variant="outline" className="bg-white">
                                {feature.replace('_', ' ')}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Price and Actions */}
                        <div className="flex items-center justify-between pt-4 border-t">
                          <div className="flex items-center gap-2">
                            {plugin.price ? (
                              <>
                                <DollarSign className="w-5 h-5 text-green-600" />
                                <span className="text-2xl font-bold text-green-600">
                                  ${plugin.price}
                                </span>
                                <span className="text-gray-600">/month</span>
                              </>
                            ) : (
                              <span className="text-2xl font-bold text-green-600">Free</span>
                            )}
                          </div>

                          <div className="flex gap-3">
                            <Button variant="outline" size="sm" onClick={() => window.location.href = `/plugins/${plugin.id}`}>
                              View Details
                            </Button>
                            {isInstalled ? (
                              <Badge className="bg-green-100 text-green-800 px-4 py-2">
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Installed
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleInstallPlugin(plugin.id)}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-6"
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Install Now
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* All Plugins */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">All Plugins</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPlugins.map((plugin) => {
                const isInstalled = installedPlugins.some(installed => installed.id === plugin.id);

                return (
                  <Card key={plugin.id} className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 group">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg">
                            {getMethodIcon(plugin.methods[0])}
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
                              {plugin.name}
                            </CardTitle>
                            <CardDescription className="text-sm mt-1">
                              by {plugin.author} • v{plugin.version}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge className={getLicenseBadgeColor(plugin.license)}>
                          {plugin.license}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                        {plugin.description}
                      </p>

                      {/* Payment Methods */}
                      <div className="flex flex-wrap gap-2">
                        {plugin.methods.slice(0, 2).map((method) => (
                          <div key={method} className="flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded-lg">
                            {getMethodIcon(method)}
                            <span>{method.replace('_', ' ')}</span>
                          </div>
                        ))}
                        {plugin.methods.length > 2 && (
                          <span className="text-xs text-gray-500 px-2 py-1">+{plugin.methods.length - 2} more</span>
                        )}
                      </div>

                      {/* Features */}
                      <div className="flex flex-wrap gap-1">
                        {plugin.features.slice(0, 3).map((feature) => (
                          <Badge key={feature} variant="outline" className="text-xs">
                            {feature.replace('_', ' ')}
                          </Badge>
                        ))}
                        {plugin.features.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{plugin.features.length - 3}
                          </Badge>
                        )}
                      </div>

                      {/* Price and Install */}
                      <div className="flex justify-between items-center pt-4 border-t">
                        <div className="flex items-center gap-1">
                          {plugin.price ? (
                            <>
                              <DollarSign className="w-4 h-4 text-green-600" />
                              <span className="font-bold text-green-600">
                                ${plugin.price}/mo
                              </span>
                            </>
                          ) : (
                            <span className="font-bold text-green-600">Free</span>
                          )}
                        </div>

                        {isInstalled ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Installed
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleInstallPlugin(plugin.id)}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Install
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="installed" className="space-y-6">
          {installedPlugins.length === 0 ? (
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
              <CardContent className="p-12 text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Package className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">No plugins installed yet</h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
                  Install plugins from the marketplace to extend your payment capabilities and unlock new features.
                </p>
                <Button
                  onClick={() => setSearchTerm('')}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-8 py-3"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Browse Marketplace
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {installedPlugins.map((plugin) => (
                <Card key={plugin.id} className="bg-white/80 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 group">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg group-hover:text-green-600 transition-colors">
                            {plugin.name}
                          </CardTitle>
                          <CardDescription className="text-sm mt-1">
                            by {plugin.author} • v{plugin.version}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {plugin.isActive ? (
                          <Badge className="bg-green-100 text-green-800 px-3 py-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800 px-3 py-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                      {plugin.description}
                    </p>

                    {/* Plugin Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-blue-600 font-medium">Uptime</p>
                        <p className="text-lg font-bold text-blue-900">99.9%</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-green-600 font-medium">Transactions</p>
                        <p className="text-lg font-bold text-green-900">1.2k</p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = `/plugins/${plugin.id}/configure`}
                        className="flex-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                      >
                        <Settings className="w-3 h-3 mr-2" />
                        Configure
                      </Button>

                      <Button
                        variant={plugin.isActive ? "destructive" : "default"}
                        size="sm"
                        className="flex-1"
                      >
                        {plugin.isActive ? (
                          <>
                            <AlertCircle className="w-3 h-3 mr-2" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3 h-3 mr-2" />
                            Activate
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
