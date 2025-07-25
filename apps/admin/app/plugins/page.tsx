'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { useToast } from '@/components/ui/toast';
import { LoginModal } from '@/components/auth/login-modal';
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
  Filter,
  Trash2
} from 'lucide-react';

interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  license: 'free' | 'basic' | 'premium' | 'enterprise';
  price?: number;
  methods: string[];
  features: string[];
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
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingInstallId, setPendingInstallId] = useState<string | null>(null);

  const { isAuthenticated, getAuthToken } = useAuthStore();
  const { addToast } = useToast();

  useEffect(() => {
    fetchPluginData();
  }, []);

  const fetchPluginData = async () => {
    try {
      setLoading(true);

      // Base mock data for marketplace plugins (without installation status)
      const basePlugins = [
        {
          id: 'stripe-official',
          name: 'Stripe Payment Gateway',
          description: 'Accept credit card and debit card payments via Stripe. Supports 3D Secure, Apple Pay, Google Pay, and 135+ currencies worldwide.',
          author: 'Jiffoo Team',
          version: '2.1.0',
          license: 'premium' as const,
          price: 29,
          methods: ['credit_card', 'debit_card', 'apple_pay', 'google_pay'],
          features: ['3D_Secure', 'Multi_Currency', 'Recurring_Payments', 'Fraud_Protection', 'Real_Time_Analytics'],
          isInstalled: false,
          isActive: false,
        },
        {
          id: 'paypal-payment-plugin',
          name: 'PayPal Payment Gateway',
          description: 'Integrate PayPal payments with support for PayPal Credit, Express Checkout, and international transactions.',
          author: 'Jiffoo Team',
          version: '1.8.5',
          license: 'premium' as const,
          price: 19,
          methods: ['paypal', 'paypal_credit'],
          features: ['Express_Checkout', 'International_Support', 'Buyer_Protection', 'Mobile_Optimized'],
          isInstalled: false,
          isActive: false,
        },
        {
          id: 'wechat-pay-plugin',
          name: 'WeChat Pay',
          description: 'Accept payments from Chinese customers using WeChat Pay. Perfect for businesses targeting the Chinese market.',
          author: 'Payment Solutions Inc',
          version: '1.2.3',
          license: 'premium' as const,
          price: 39,
          methods: ['wechat_pay'],
          features: ['QR_Code_Payments', 'Mobile_App_Integration', 'CNY_Support', 'Real_Time_Settlement'],
          isInstalled: false,
          isActive: false,
        },
        {
          id: 'alipay-official',
          name: 'Alipay Professional',
          description: 'Complete Alipay integration with advanced features for production use. Supports web, WAP, and app payments with enterprise-grade security.',
          author: 'Jiffoo Team',
          version: '2.1.0',
          license: 'premium' as const,
          price: 39.99,
          methods: ['alipay', 'alipay_wap', 'alipay_app'],
          features: ['RSA2_Encryption', 'Webhook_Support', 'Full_Refunds', 'Partial_Refunds', 'Payment_Analytics', 'Multi_Environment', 'QR_Code_Payments', 'Mobile_Optimized'],
          isInstalled: false,
          isActive: false,
        },
        {
          id: 'crypto-payment-plugin',
          name: 'Cryptocurrency Payments',
          description: 'Accept Bitcoin, Ethereum, and other major cryptocurrencies. Automatic conversion to fiat currency available.',
          author: 'CryptoGate Ltd',
          version: '3.0.1',
          license: 'enterprise' as const,
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
          license: 'basic' as const,
          price: 15,
          methods: ['bank_transfer', 'ach'],
          features: ['ACH_Support', 'SEPA_Transfers', 'Low_Fees', 'Batch_Processing'],
          isInstalled: false,
          isActive: false,
        },
      ];

      // Fetch real plugin status from API
      try {
        const marketplaceResponse = await fetch('/api/plugin-store/plugins');
        if (marketplaceResponse.ok) {
          const marketplaceData = await marketplaceResponse.json();
          if (marketplaceData.plugins) {
            // Update base plugins with real installation status
            const updatedPlugins = basePlugins.map(basePlugin => {
              const realPlugin = marketplaceData.plugins.find((p: any) => p.id === basePlugin.id);
              if (realPlugin) {
                // Map API status to frontend boolean flags
                const isInstalled = realPlugin.status === 'active' || realPlugin.status === 'inactive';
                const isActive = realPlugin.status === 'active';

                return {
                  ...basePlugin,
                  isInstalled,
                  isActive,
                };
              }
              return basePlugin;
            });

            setPlugins(updatedPlugins);
            setInstalledPlugins(updatedPlugins.filter(p => p.isInstalled));

            setStats({
              totalAvailable: updatedPlugins.length,
              totalInstalled: updatedPlugins.filter(p => p.isInstalled).length,
              byLicense: {
                free: 0,
                basic: updatedPlugins.filter(p => p.license === 'basic').length,
                premium: updatedPlugins.filter(p => p.license === 'premium').length,
                enterprise: updatedPlugins.filter(p => p.license === 'enterprise').length,
              },
            });
          } else {
            // Fallback to base plugins if API doesn't return plugin data
            setPlugins(basePlugins);
            setInstalledPlugins(basePlugins.filter(p => p.isInstalled));
            setStats({
              totalAvailable: basePlugins.length,
              totalInstalled: basePlugins.filter(p => p.isInstalled).length,
              byLicense: {
                free: 0,
                basic: basePlugins.filter(p => p.license === 'basic').length,
                premium: basePlugins.filter(p => p.license === 'premium').length,
                enterprise: basePlugins.filter(p => p.license === 'enterprise').length,
              },
            });
          }
        } else {
          throw new Error('API response not ok');
        }
      } catch (apiError) {
        console.log('API not available, using base mock data:', apiError);
        // Fallback to base plugins
        setPlugins(basePlugins);
        setInstalledPlugins(basePlugins.filter(p => p.isInstalled));
        setStats({
          totalAvailable: basePlugins.length,
          totalInstalled: basePlugins.filter(p => p.isInstalled).length,
          byLicense: {
            free: 0,
            basic: basePlugins.filter(p => p.license === 'basic').length,
            premium: basePlugins.filter(p => p.license === 'premium').length,
            enterprise: basePlugins.filter(p => p.license === 'enterprise').length,
          },
        });
      }
    } catch (error) {
      console.error('Failed to fetch plugin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInstallPlugin = async (pluginId: string) => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      setPendingInstallId(pluginId);
      setShowLoginModal(true);
      return;
    }

    await performInstallation(pluginId);
  };

  const performInstallation = async (pluginId: string) => {
    try {
      const token = getAuthToken();
      if (!token) {
        addToast({
          type: 'error',
          title: 'Authentication Required',
          description: 'Please login to install plugins'
        });
        return;
      }

      // Find the plugin to check if it's already installed
      const plugin = plugins.find(p => p.id === pluginId);
      const isInstalled = plugin?.isInstalled || false;
      const isActive = plugin?.isActive || false;

      // Show loading toast
      addToast({
        type: 'info',
        title: isInstalled ? 'Activating Plugin' : 'Installing Plugin',
        description: isInstalled ? 'Please wait while we activate the plugin...' : 'Please wait while we install the plugin...',
        duration: 3000
      });

      let response;

      if (isInstalled && !isActive) {
        // Plugin is installed but not active, so activate it
        response = await fetch(`/api/plugins/${pluginId}/activate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
      } else if (!isInstalled) {
        // Plugin is not installed, so install it
        // For demo purposes, we'll use test license keys
        const licenseKeys: Record<string, string> = {
          'stripe-official': 'stripe-license-123',
          'paypal-payment-plugin': 'paypal-license-456',
          'alipay-official': 'alipay-pro-demo-123',
          'wechat-pay-plugin': 'wechat-license-789'
        };
        const licenseKey = licenseKeys[pluginId] || 'demo-license-key';

        response = await fetch(`/api/plugins/${pluginId}/install`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ licenseKey }),
        });
      } else {
        // Plugin is already installed and active
        addToast({
          type: 'info',
          title: 'Plugin Already Active',
          description: 'This plugin is already installed and active.'
        });
        return;
      }

      const data = await response.json();

      if (data.success) {
        addToast({
          type: 'success',
          title: 'Plugin Installed Successfully!',
          description: `${data.data?.pluginId || pluginId} has been installed and activated.`,
          duration: 5000
        });
        fetchPluginData(); // Refresh data
      } else {
        addToast({
          type: 'error',
          title: 'Installation Failed',
          description: data.message || 'Failed to install plugin. Please try again.',
          duration: 7000
        });
      }
    } catch (error) {
      console.error('Installation failed:', error);
      addToast({
        type: 'error',
        title: 'Installation Error',
        description: 'An unexpected error occurred. Please check your connection and try again.',
        duration: 7000
      });
    }
  };

  const handleTogglePlugin = async (pluginId: string, isActive: boolean) => {
    try {
      const token = getAuthToken();
      if (!token) {
        addToast({
          type: 'error',
          title: 'Authentication Required',
          description: 'Please login to manage plugins.',
          duration: 5000
        });
        return;
      }

      const action = isActive ? 'deactivate' : 'activate';
      addToast({
        type: 'info',
        title: `${isActive ? 'Deactivating' : 'Activating'} Plugin`,
        description: `Please wait while we ${action} the plugin...`,
        duration: 3000
      });

      const response = await fetch(`/api/plugins/${pluginId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      let data;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : { success: response.ok };
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        data = { success: response.ok };
      }

      if (data.success) {
        addToast({
          type: 'success',
          title: `Plugin ${isActive ? 'Deactivated' : 'Activated'}`,
          description: `${pluginId} has been ${isActive ? 'deactivated' : 'activated'} successfully.`,
          duration: 5000
        });
        fetchPluginData(); // Refresh data
      } else {
        addToast({
          type: 'error',
          title: `${isActive ? 'Deactivation' : 'Activation'} Failed`,
          description: data.message || `Failed to ${action} plugin. Please try again.`,
          duration: 7000
        });
      }
    } catch (error) {
      console.error(`Plugin ${isActive ? 'deactivation' : 'activation'} failed:`, error);
      addToast({
        type: 'error',
        title: `${isActive ? 'Deactivation' : 'Activation'} Error`,
        description: 'An unexpected error occurred.',
        duration: 7000
      });
    }
  };

  const handleUninstallPlugin = async (pluginId: string) => {
    try {
      const token = getAuthToken();
      if (!token) {
        addToast({
          type: 'error',
          title: 'Authentication Required',
          description: 'Please login to manage plugins.',
          duration: 5000
        });
        return;
      }

      // 确认对话框
      const confirmed = window.confirm(
        `Are you sure you want to uninstall ${pluginId}?\n\n` +
        `This will:\n` +
        `• Completely remove the plugin from your system\n` +
        `• Delete plugin configuration and data\n` +
        `• Cannot be undone without reinstalling\n\n` +
        `Your business data (orders, users) will remain safe.`
      );

      if (!confirmed) {
        return;
      }

      addToast({
        type: 'info',
        title: 'Uninstalling Plugin',
        description: `Please wait while we completely remove ${pluginId}...`,
        duration: 3000
      });

      const response = await fetch(`http://localhost:8001/api/plugins/${pluginId}/uninstall`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      let data;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : { success: response.ok };
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        data = { success: response.ok };
      }

      if (data.success) {
        addToast({
          type: 'success',
          title: 'Plugin Uninstalled',
          description: `${pluginId} has been completely removed from your system.`,
          duration: 5000
        });
        fetchPluginData(); // Refresh data
      } else {
        addToast({
          type: 'error',
          title: 'Uninstallation Failed',
          description: data.message || 'Failed to uninstall plugin. Please try again.',
          duration: 7000
        });
      }
    } catch (error) {
      console.error('Plugin uninstall failed:', error);
      addToast({
        type: 'error',
        title: 'Uninstallation Failed',
        description: 'An unexpected error occurred. Please try again.',
        duration: 7000
      });
    }
  };

  const handleLoginSuccess = () => {
    if (pendingInstallId) {
      performInstallation(pendingInstallId);
      setPendingInstallId(null);
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
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black relative overflow-hidden min-h-full">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-2xl shadow-xl mb-4 relative">
            <Package className="w-8 h-8 text-white" />
            <div className="absolute -inset-1 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-2xl blur opacity-30"></div>
          </div>
          <div className="space-y-3">
            <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Transform your payment experience with cutting-edge, enterprise-grade plugins
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>Live • Updated daily • Trusted by 10,000+ merchants</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="group relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <Card className="relative bg-gray-800/90 backdrop-blur-xl border border-gray-700/50 shadow-2xl hover:shadow-blue-500/25 transition-all duration-500">
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Available Plugins</p>
                    <p className="text-4xl font-black text-white mt-2">{stats?.totalAvailable || 12}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <div className="w-1 h-1 bg-green-400 rounded-full"></div>
                      <p className="text-xs text-green-400">+2 this month</p>
                    </div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg">
                    <Package className="w-8 h-8 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="group relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <Card className="relative bg-gray-800/90 backdrop-blur-xl border border-gray-700/50 shadow-2xl hover:shadow-green-500/25 transition-all duration-500">
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Installed</p>
                    <p className="text-4xl font-black text-white mt-2">{stats?.totalInstalled || 3}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></div>
                      <p className="text-xs text-green-400">Active & Running</p>
                    </div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="group relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <Card className="relative bg-gray-800/90 backdrop-blur-xl border border-gray-700/50 shadow-2xl hover:shadow-purple-500/25 transition-all duration-500">
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Premium Plugins</p>
                    <p className="text-4xl font-black text-white mt-2">{stats?.byLicense.premium || 8}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
                      <p className="text-xs text-purple-400">Enterprise Ready</p>
                    </div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-lg">
                    <Star className="w-8 h-8 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="group relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <Card className="relative bg-gray-800/90 backdrop-blur-xl border border-gray-700/50 shadow-2xl hover:shadow-orange-500/25 transition-all duration-500">
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-400">Revenue Impact</p>
                    <p className="text-4xl font-black text-white mt-2">+24%</p>
                    <div className="flex items-center gap-1 mt-2">
                      <div className="w-1 h-1 bg-orange-400 rounded-full"></div>
                      <p className="text-xs text-orange-400">vs last month</p>
                    </div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-lg">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-3xl blur opacity-20"></div>
          <Card className="relative bg-gray-800/90 backdrop-blur-xl border border-gray-700/50 shadow-2xl">
            <CardContent className="p-8">
              <div className="flex flex-col lg:flex-row gap-6 items-center">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
                  <Input
                    placeholder="Search plugins by name, category, or feature..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-16 pr-6 py-4 text-lg border-0 bg-gray-700/50 text-white placeholder-gray-400 focus:bg-gray-700 focus:ring-2 focus:ring-blue-500 rounded-2xl"
                  />
                </div>

                <div className="flex gap-4">
                  <select
                    value={selectedLicense}
                    onChange={(e) => setSelectedLicense(e.target.value)}
                    className="px-6 py-4 border-0 bg-gray-700/50 text-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="all">All Licenses</option>
                    <option value="free">Free</option>
                    <option value="basic">Basic</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                  </select>

                  <Button className="px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium">
                    <Filter className="w-5 h-5 mr-2" />
                    Advanced Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="marketplace" className="space-y-8">
          <div className="flex justify-center">
            <TabsList className="bg-gray-800/90 border border-gray-700/50 p-2 rounded-2xl backdrop-blur-xl">
              <TabsTrigger
                value="marketplace"
                className="px-8 py-4 rounded-xl text-gray-400 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white font-bold text-lg"
              >
                Marketplace ({plugins.length})
              </TabsTrigger>
              <TabsTrigger
                value="installed"
                className="px-8 py-4 rounded-xl text-gray-400 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white font-bold text-lg"
              >
                Installed ({installedPlugins.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="marketplace" className="space-y-12">
            {/* Plugin Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredPlugins.map((plugin) => {
                const isInstalled = installedPlugins.some(installed => installed.id === plugin.id);

                return (
                  <div key={plugin.id} className="group relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-gray-600 to-gray-800 rounded-2xl blur opacity-20 group-hover:opacity-50 transition duration-500"></div>
                    <Card className="relative bg-gray-800/90 backdrop-blur-xl border border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-xl"></div>
                      <CardHeader className="pb-4 relative">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                                {getMethodIcon(plugin.methods[0])}
                              </div>
                              <div className="absolute -inset-1 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl blur opacity-20"></div>
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-lg text-white group-hover:text-blue-400 transition-colors font-bold">
                                {plugin.name}
                              </CardTitle>
                              <CardDescription className="text-sm mt-1 text-gray-400">
                                by {plugin.author} • v{plugin.version}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge className={`${getLicenseBadgeColor(plugin.license)} font-bold`}>
                            {plugin.license.toUpperCase()}
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-6 relative">
                        <p className="text-sm text-gray-300 line-clamp-2 leading-relaxed">
                          {plugin.description}
                        </p>

                        {/* Payment Methods */}
                        <div className="flex flex-wrap gap-2">
                          {plugin.methods.slice(0, 2).map((method) => (
                            <div key={method} className="flex items-center gap-2 text-xs bg-gray-700/50 text-gray-300 px-3 py-2 rounded-lg border border-gray-600/50">
                              {getMethodIcon(method)}
                              <span>{method.replace('_', ' ')}</span>
                            </div>
                          ))}
                          {plugin.methods.length > 2 && (
                            <span className="text-xs text-gray-500 px-3 py-2">+{plugin.methods.length - 2} more</span>
                          )}
                        </div>

                        {/* Features */}
                        <div className="flex flex-wrap gap-2">
                          {plugin.features.slice(0, 3).map((feature) => (
                            <Badge key={feature} className="text-xs bg-gray-700/50 text-gray-300 border-gray-600/50">
                              {feature.replace('_', ' ')}
                            </Badge>
                          ))}
                          {plugin.features.length > 3 && (
                            <Badge className="text-xs bg-gray-700/50 text-gray-300 border-gray-600/50">
                              +{plugin.features.length - 3}
                            </Badge>
                          )}
                        </div>

                        {/* Price and Install */}
                        <div className="flex justify-between items-center pt-4 border-t border-gray-700/50">
                          <div className="flex items-center gap-1">
                            {plugin.price ? (
                              <>
                                <DollarSign className="w-4 h-4 text-green-400" />
                                <span className="font-bold text-green-400 text-lg">
                                  ${plugin.price}
                                </span>
                                <span className="text-gray-400 text-sm">/mo</span>
                              </>
                            ) : (
                              <span className="font-bold text-green-400 text-lg">Free</span>
                            )}
                          </div>

                          {isInstalled ? (
                            <div className="flex items-center gap-2 bg-green-500/20 text-green-400 px-3 py-2 rounded-lg border border-green-500/30">
                              <CheckCircle className="w-4 h-4" />
                              <span className="text-sm font-bold">Installed</span>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleInstallPlugin(plugin.id)}
                              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-4 py-2 font-bold"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Install
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="installed" className="space-y-8">
            {installedPlugins.length === 0 ? (
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-gray-600 to-gray-800 rounded-3xl blur opacity-20"></div>
                <Card className="relative bg-gray-800/90 backdrop-blur-xl border border-gray-700/50 shadow-2xl">
                  <CardContent className="p-16 text-center">
                    <div className="relative">
                      <div className="w-32 h-32 bg-gradient-to-br from-gray-700 to-gray-800 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
                        <Package className="w-16 h-16 text-gray-400" />
                      </div>
                      <div className="absolute -inset-2 bg-gradient-to-br from-gray-600 to-gray-800 rounded-3xl blur opacity-20"></div>
                    </div>
                    <h3 className="text-3xl font-black text-white mb-4">No plugins installed yet</h3>
                    <p className="text-gray-400 mb-10 max-w-lg mx-auto leading-relaxed text-lg">
                      Install plugins from the marketplace to extend your payment capabilities and unlock enterprise features.
                    </p>
                    <Button
                      onClick={() => setSearchTerm('')}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-10 py-4 text-lg font-bold"
                    >
                      <Package className="w-5 h-5 mr-3" />
                      Browse Marketplace
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {installedPlugins.map((plugin) => (
                  <div key={plugin.id} className="group relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl blur opacity-30 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                    <Card className="relative bg-gray-800/90 backdrop-blur-xl border border-gray-700/50 shadow-2xl hover:shadow-green-500/25 transition-all duration-500 overflow-hidden">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full blur-xl"></div>
                      <CardHeader className="pb-4 relative">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                                <CheckCircle className="w-6 h-6 text-white" />
                              </div>
                              <div className="absolute -inset-1 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl blur opacity-30"></div>
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-lg text-white group-hover:text-green-400 transition-colors font-bold">
                                {plugin.name}
                              </CardTitle>
                              <CardDescription className="text-sm mt-1 text-gray-400">
                                by {plugin.author} • v{plugin.version}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {plugin.isActive ? (
                              <div className="flex items-center gap-2 bg-green-500/20 text-green-400 px-4 py-2 rounded-xl border border-green-500/30">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <span className="text-sm font-bold">Active</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 bg-gray-500/20 text-gray-400 px-4 py-2 rounded-xl border border-gray-500/30">
                                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                <span className="text-sm font-bold">Inactive</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-6 relative">
                        <p className="text-sm text-gray-300 line-clamp-2 leading-relaxed">
                          {plugin.description}
                        </p>

                        {/* Plugin Stats */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4 text-center">
                            <p className="text-xs text-blue-400 font-bold">Uptime</p>
                            <p className="text-xl font-black text-blue-300 mt-1">99.9%</p>
                          </div>
                          <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 text-center">
                            <p className="text-xs text-green-400 font-bold">Transactions</p>
                            <p className="text-xl font-black text-green-300 mt-1">1.2k</p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2 pt-2">
                          {/* First Row: Configure and Toggle */}
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.location.href = `/plugins/${plugin.id}/configure`}
                              className="flex-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 bg-blue-500/10"
                            >
                              <Settings className="w-4 h-4 mr-2" />
                              Configure
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => handleTogglePlugin(plugin.id, plugin.isActive || false)}
                              className={`flex-1 font-bold ${
                                plugin.isActive
                                  ? "bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30"
                                  : "bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30"
                              }`}
                            >
                              {plugin.isActive ? "Deactivate" : "Activate"}
                            </Button>
                          </div>

                          {/* Second Row: Uninstall Button */}
                          <Button
                            size="sm"
                            onClick={() => handleUninstallPlugin(plugin.id)}
                            className="w-full bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30 font-bold"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Uninstall Plugin
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          setPendingInstallId(null);
        }}
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
}
