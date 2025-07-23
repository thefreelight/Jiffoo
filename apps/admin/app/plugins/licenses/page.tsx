'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Shield, 
  Calendar, 
  CheckCircle,
  AlertCircle,
  XCircle,
  Key,
  CreditCard,
  Download,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';

interface License {
  id: string;
  pluginId: string;
  pluginName: string;
  userId: string;
  type: 'basic' | 'premium' | 'enterprise';
  status: 'active' | 'expired' | 'suspended';
  issuedAt: string;
  expiresAt?: string;
  features: string[];
  metadata?: Record<string, any>;
}

interface LicenseStats {
  total: number;
  active: number;
  expired: number;
  suspended: number;
  byType: {
    basic: number;
    premium: number;
    enterprise: number;
  };
  byPlugin: Record<string, number>;
}

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [stats, setStats] = useState<LicenseStats | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showLicenseKeys, setShowLicenseKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchLicenseData();
  }, []);

  const fetchLicenseData = async () => {
    try {
      setLoading(true);
      
      // Mock license data for demo
      const mockLicenses: License[] = [
        {
          id: 'stripe-license-123',
          pluginId: 'stripe-payment-plugin',
          pluginName: 'Stripe Payment Plugin',
          userId: 'test-user',
          type: 'basic',
          status: 'active',
          issuedAt: '2024-01-15T10:00:00Z',
          expiresAt: '2025-01-15T10:00:00Z',
          features: ['payments', 'refunds', 'webhooks'],
        },
        {
          id: 'paypal-license-456',
          pluginId: 'paypal-payment-plugin',
          pluginName: 'PayPal Payment Plugin',
          userId: 'test-user',
          type: 'basic',
          status: 'active',
          issuedAt: '2024-01-20T14:30:00Z',
          expiresAt: '2025-01-20T14:30:00Z',
          features: ['payments', 'refunds'],
        },
        {
          id: 'wechat-license-789',
          pluginId: 'wechat-payment-plugin',
          pluginName: 'WeChat Pay Plugin',
          userId: 'test-user',
          type: 'premium',
          status: 'active',
          issuedAt: '2024-02-01T09:15:00Z',
          expiresAt: '2025-02-01T09:15:00Z',
          features: ['payments', 'refunds', 'webhooks', 'analytics'],
        },
        {
          id: 'old-license-001',
          pluginId: 'old-plugin',
          pluginName: 'Legacy Plugin',
          userId: 'test-user',
          type: 'basic',
          status: 'expired',
          issuedAt: '2023-01-01T00:00:00Z',
          expiresAt: '2024-01-01T00:00:00Z',
          features: ['basic_features'],
        },
      ];

      setLicenses(mockLicenses);

      // Calculate stats
      const stats: LicenseStats = {
        total: mockLicenses.length,
        active: mockLicenses.filter(l => l.status === 'active').length,
        expired: mockLicenses.filter(l => l.status === 'expired').length,
        suspended: mockLicenses.filter(l => l.status === 'suspended').length,
        byType: {
          basic: mockLicenses.filter(l => l.type === 'basic').length,
          premium: mockLicenses.filter(l => l.type === 'premium').length,
          enterprise: mockLicenses.filter(l => l.type === 'enterprise').length,
        },
        byPlugin: mockLicenses.reduce((acc, license) => {
          acc[license.pluginId] = (acc[license.pluginId] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };

      setStats(stats);
    } catch (error) {
      console.error('Failed to fetch license data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLicenses = licenses.filter(license => {
    const matchesSearch = license.pluginName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         license.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || license.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'suspended': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4" />;
      case 'expired': return <XCircle className="w-4 h-4" />;
      case 'suspended': return <AlertCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'basic': return 'bg-blue-100 text-blue-800';
      case 'premium': return 'bg-purple-100 text-purple-800';
      case 'enterprise': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysUntilExpiry = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const toggleLicenseKeyVisibility = (licenseId: string) => {
    setShowLicenseKeys(prev => ({
      ...prev,
      [licenseId]: !prev[licenseId]
    }));
  };

  const maskLicenseKey = (licenseId: string) => {
    if (showLicenseKeys[licenseId]) {
      return licenseId;
    }
    return licenseId.substring(0, 8) + '•••••••••••••••••••••••••••••••';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading licenses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">License Management</h1>
          <p className="text-gray-600">Manage your plugin licenses and subscriptions</p>
        </div>
        <Button onClick={fetchLicenseData} className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Licenses</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Key className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Expired</p>
                  <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Premium</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.byType.premium}</p>
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
            placeholder="Search licenses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Licenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Licenses</CardTitle>
          <CardDescription>
            Manage and monitor your plugin licenses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLicenses.length === 0 ? (
            <div className="text-center py-8">
              <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No licenses found</h3>
              <p className="text-gray-600">
                {searchTerm || selectedStatus !== 'all' 
                  ? 'No licenses match your search criteria.' 
                  : 'You don\'t have any plugin licenses yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLicenses.map((license) => {
                const daysUntilExpiry = getDaysUntilExpiry(license.expiresAt);
                const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0;
                
                return (
                  <div key={license.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{license.pluginName}</h3>
                          <Badge className={getStatusBadgeColor(license.status)}>
                            {getStatusIcon(license.status)}
                            <span className="ml-1">{license.status}</span>
                          </Badge>
                          <Badge className={getTypeBadgeColor(license.type)}>
                            {license.type}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">License Key:</span>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                                {maskLicenseKey(license.id)}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleLicenseKeyVisibility(license.id)}
                                className="p-1 h-auto"
                              >
                                {showLicenseKeys[license.id] ? (
                                  <EyeOff className="w-3 h-3" />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                          
                          <div>
                            <span className="font-medium">Issued:</span>
                            <div className="flex items-center gap-1 mt-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(license.issuedAt)}</span>
                            </div>
                          </div>
                          
                          <div>
                            <span className="font-medium">Expires:</span>
                            <div className="flex items-center gap-1 mt-1">
                              <Calendar className="w-3 h-3" />
                              <span>
                                {license.expiresAt ? formatDate(license.expiresAt) : 'Never'}
                              </span>
                              {isExpiringSoon && (
                                <Badge className="bg-yellow-100 text-yellow-800 text-xs ml-2">
                                  {daysUntilExpiry} days left
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-3">
                          <span className="font-medium text-sm text-gray-600">Features:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {license.features.map((feature) => (
                              <Badge key={feature} variant="outline" className="text-xs">
                                {feature}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2 ml-4">
                        {license.status === 'active' && (
                          <Button variant="outline" size="sm">
                            <Download className="w-3 h-3 mr-1" />
                            Download
                          </Button>
                        )}
                        
                        {license.status === 'expired' && (
                          <Button size="sm">
                            <CreditCard className="w-3 h-3 mr-1" />
                            Renew
                          </Button>
                        )}
                        
                        {license.status === 'suspended' && (
                          <Button variant="outline" size="sm">
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
