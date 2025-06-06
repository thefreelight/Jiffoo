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
  Package
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

      // Fetch marketplace data
      const marketplaceResponse = await fetch('/api/payments/plugins/marketplace');
      const marketplaceData = await marketplaceResponse.json();

      if (marketplaceData.success) {
        setStats({
          totalAvailable: marketplaceData.data.totalAvailable,
          totalInstalled: marketplaceData.data.totalInstalled,
          byLicense: marketplaceData.data.byLicense,
        });
      }

      // Fetch available plugins
      const availableResponse = await fetch('/api/payments/plugins/available');
      const availableData = await availableResponse.json();

      if (availableData.success) {
        setPlugins(availableData.data.plugins);
      }

      // Fetch installed plugins
      const token = localStorage.getItem('authToken');
      if (token) {
        const installedResponse = await fetch('/api/payments/plugins/installed', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const installedData = await installedResponse.json();

        if (installedData.success) {
          setInstalledPlugins(installedData.data.plugins);
        }
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Plugin Store</h1>
          <p className="text-gray-600">Extend your payment capabilities with powerful plugins</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Available Plugins</p>
                  <p className="text-2xl font-bold">{stats.totalAvailable}</p>
                </div>
                <Package className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Installed</p>
                  <p className="text-2xl font-bold">{stats.totalInstalled}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Basic Plugins</p>
                  <p className="text-2xl font-bold">{stats.byLicense.basic}</p>
                </div>
                <Star className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Premium Plugins</p>
                  <p className="text-2xl font-bold">{stats.byLicense.premium}</p>
                </div>
                <Shield className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search plugins..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <select
          value={selectedLicense}
          onChange={(e) => setSelectedLicense(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Licenses</option>
          <option value="free">Free</option>
          <option value="basic">Basic</option>
          <option value="premium">Premium</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="marketplace" className="space-y-4">
        <TabsList>
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="installed">Installed ({installedPlugins.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlugins.map((plugin) => {
              const isInstalled = installedPlugins.some(installed => installed.id === plugin.id);

              return (
                <Card key={plugin.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{plugin.name}</CardTitle>
                        <CardDescription className="text-sm mt-1">
                          by {plugin.author} • v{plugin.version}
                        </CardDescription>
                      </div>
                      <Badge className={getLicenseBadgeColor(plugin.license)}>
                        {plugin.license}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {plugin.description}
                    </p>

                    {/* Payment Methods */}
                    <div className="flex flex-wrap gap-2">
                      {plugin.methods.slice(0, 3).map((method) => (
                        <div key={method} className="flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded">
                          {getMethodIcon(method)}
                          <span>{method.replace('_', ' ')}</span>
                        </div>
                      ))}
                      {plugin.methods.length > 3 && (
                        <span className="text-xs text-gray-500">+{plugin.methods.length - 3} more</span>
                      )}
                    </div>

                    {/* Features */}
                    <div className="flex flex-wrap gap-1">
                      {plugin.features.slice(0, 4).map((feature) => (
                        <Badge key={feature} variant="outline" className="text-xs">
                          {feature.replace('_', ' ')}
                        </Badge>
                      ))}
                      {plugin.features.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{plugin.features.length - 4}
                        </Badge>
                      )}
                    </div>

                    {/* Price and Install */}
                    <div className="flex justify-between items-center pt-2">
                      <div className="flex items-center gap-1">
                        {plugin.price ? (
                          <>
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <span className="font-semibold text-green-600">
                              ${plugin.price}/month
                            </span>
                          </>
                        ) : (
                          <span className="font-semibold text-green-600">Free</span>
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
                          className="flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Install
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="installed" className="space-y-4">
          {installedPlugins.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No plugins installed</h3>
                <p className="text-gray-600 mb-4">
                  Install plugins from the marketplace to extend your payment capabilities.
                </p>
                <Button onClick={() => setSearchTerm('')}>
                  Browse Marketplace
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {installedPlugins.map((plugin) => (
                <Card key={plugin.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{plugin.name}</CardTitle>
                        <CardDescription className="text-sm mt-1">
                          by {plugin.author} • v{plugin.version}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {plugin.isActive ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {plugin.description}
                    </p>

                    <div className="flex justify-between items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = `/plugins/${plugin.id}/configure`}
                      >
                        <Settings className="w-3 h-3 mr-1" />
                        Configure
                      </Button>

                      <Button
                        variant={plugin.isActive ? "destructive" : "default"}
                        size="sm"
                      >
                        {plugin.isActive ? 'Deactivate' : 'Activate'}
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
  );
}
