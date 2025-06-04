'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Filter, Key, Calendar, User, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface License {
  id: string;
  pluginName: string;
  licenseKey: string;
  userId: string;
  licenseType: string;
  status: string;
  features: string[];
  expiresAt?: string;
  createdAt: string;
  user?: {
    username: string;
    email: string;
  };
}

interface GenerateLicenseForm {
  pluginName: string;
  licenseType: 'trial' | 'monthly' | 'yearly' | 'lifetime';
  features: string[];
  durationDays?: number;
  targetUserId: string;
  usageLimits?: Record<string, number>;
}

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateForm, setGenerateForm] = useState<GenerateLicenseForm>({
    pluginName: '',
    licenseType: 'monthly',
    features: [],
    targetUserId: ''
  });
  const { toast } = useToast();

  const availablePlugins = [
    'advanced-analytics',
    'marketing-automation',
    'enterprise-integration'
  ];

  const availableFeatures = {
    'advanced-analytics': [
      'real-time-dashboard',
      'predictive-analytics',
      'custom-reports',
      'data-export',
      'advanced-segmentation',
      'cohort-analysis',
      'revenue-forecasting'
    ],
    'marketing-automation': [
      'email-automation',
      'customer-segmentation',
      'campaign-builder',
      'ab-testing',
      'conversion-tracking',
      'personalization',
      'workflow-automation'
    ],
    'enterprise-integration': [
      'erp-integration',
      'crm-sync',
      'inventory-sync',
      'financial-integration',
      'data-mapping',
      'real-time-sync',
      'webhook-support'
    ]
  };

  useEffect(() => {
    fetchLicenses();
  }, []);

  const fetchLicenses = async () => {
    try {
      const response = await fetch('/api/licenses/all', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLicenses(data.licenses || []);
      }
    } catch (error) {
      console.error('Failed to fetch licenses:', error);
      toast({
        title: 'Error',
        description: 'Failed to load licenses',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLicense = async () => {
    try {
      const response = await fetch('/api/licenses/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(generateForm)
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'License generated successfully'
        });
        setShowGenerateDialog(false);
        setGenerateForm({
          pluginName: '',
          licenseType: 'monthly',
          features: [],
          targetUserId: ''
        });
        fetchLicenses();
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to generate license',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate license',
        variant: 'destructive'
      });
    }
  };

  const handleRevokeLicense = async (licenseId: string) => {
    try {
      const response = await fetch(`/api/licenses/${licenseId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'License revoked successfully'
        });
        fetchLicenses();
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to revoke license',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to revoke license',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      expired: 'destructive',
      suspended: 'secondary',
      revoked: 'outline'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  const getLicenseTypeBadge = (type: string) => {
    const colors = {
      trial: 'bg-blue-100 text-blue-800',
      monthly: 'bg-green-100 text-green-800',
      yearly: 'bg-purple-100 text-purple-800',
      lifetime: 'bg-yellow-100 text-yellow-800'
    } as const;

    return (
      <Badge className={colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {type}
      </Badge>
    );
  };

  const filteredLicenses = licenses.filter(license => {
    const matchesSearch = !searchQuery || 
      license.pluginName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      license.user?.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      license.user?.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = !statusFilter || license.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">License Management</h1>
          <p className="text-gray-600">Manage plugin licenses and subscriptions</p>
        </div>
        <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Generate License
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Generate New License</DialogTitle>
              <DialogDescription>
                Create a new plugin license for a user
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="plugin">Plugin</Label>
                <Select 
                  value={generateForm.pluginName} 
                  onValueChange={(value) => setGenerateForm({...generateForm, pluginName: value, features: []})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select plugin" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlugins.map(plugin => (
                      <SelectItem key={plugin} value={plugin}>
                        {plugin.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="licenseType">License Type</Label>
                <Select 
                  value={generateForm.licenseType} 
                  onValueChange={(value: any) => setGenerateForm({...generateForm, licenseType: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="lifetime">Lifetime</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  value={generateForm.targetUserId}
                  onChange={(e) => setGenerateForm({...generateForm, targetUserId: e.target.value})}
                  placeholder="Enter user ID"
                />
              </div>

              {generateForm.licenseType === 'trial' && (
                <div>
                  <Label htmlFor="duration">Trial Duration (days)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={generateForm.durationDays || ''}
                    onChange={(e) => setGenerateForm({...generateForm, durationDays: parseInt(e.target.value)})}
                    placeholder="14"
                  />
                </div>
              )}

              {generateForm.pluginName && (
                <div>
                  <Label>Features</Label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {availableFeatures[generateForm.pluginName as keyof typeof availableFeatures]?.map(feature => (
                      <label key={feature} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={generateForm.features.includes(feature)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setGenerateForm({
                                ...generateForm,
                                features: [...generateForm.features, feature]
                              });
                            } else {
                              setGenerateForm({
                                ...generateForm,
                                features: generateForm.features.filter(f => f !== feature)
                              });
                            }
                          }}
                        />
                        <span className="text-sm">{feature.replace('-', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerateLicense}>
                Generate License
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Licenses</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{licenses.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Licenses</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {licenses.filter(l => l.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired Licenses</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {licenses.filter(l => l.status === 'expired').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(licenses.map(l => l.userId)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search licenses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Licenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Licenses</CardTitle>
          <CardDescription>
            Manage all plugin licenses and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plugin</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLicenses.map((license) => (
                <TableRow key={license.id}>
                  <TableCell className="font-medium">
                    {license.pluginName.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{license.user?.username || 'Unknown'}</div>
                      <div className="text-sm text-gray-500">{license.user?.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{getLicenseTypeBadge(license.licenseType)}</TableCell>
                  <TableCell>{getStatusBadge(license.status)}</TableCell>
                  <TableCell>
                    {license.expiresAt 
                      ? new Date(license.expiresAt).toLocaleDateString()
                      : 'Never'
                    }
                  </TableCell>
                  <TableCell>
                    {new Date(license.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      {license.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevokeLicense(license.id)}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredLicenses.length === 0 && (
            <div className="text-center py-8">
              <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No licenses found</h3>
              <p className="text-gray-500">No licenses match your current filters</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
