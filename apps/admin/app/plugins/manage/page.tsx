/**
 * Super Admin Plugin Management Page
 * 
 * Provides functionality to view, create, edit, and manage plugins,
 * including configuration for external plugins with OAuth support.
 */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { pluginManagementApi } from '@/lib/api';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  Package,
  Globe,
  Key,
  RefreshCw,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';

interface Plugin {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category: string;
  status: string;
  runtimeType: string;
  externalBaseUrl?: string;
  oauthConfig?: {
    installUrl?: string;
    tokenUrl?: string;
    redirectUri?: string;
    scopes?: string;
  };
  integrationSecrets?: {
    sharedSecret?: string;
  };
  tags?: string;
  iconUrl?: string;
  version: string;
  createdAt: string;
  installationsCount: number;
  subscriptionsCount: number;
}

interface FormData {
  slug: string;
  name: string;
  description: string;
  category: string;
  runtimeType: 'internal-fastify' | 'external-http';
  externalBaseUrl: string;
  oauthConfig: {
    installUrl: string;
    tokenUrl: string;
    redirectUri: string;
    scopes: string;
  };
  integrationSecrets: {
    sharedSecret: string;
  };
  autoGenerateSecret: boolean;
  tags: string;
  iconUrl: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const initialFormData: FormData = {
  slug: '',
  name: '',
  description: '',
  category: 'integration',
  runtimeType: 'internal-fastify',
  externalBaseUrl: '',
  oauthConfig: { installUrl: '', tokenUrl: '', redirectUri: '', scopes: '' },
  integrationSecrets: { sharedSecret: '' },
  autoGenerateSecret: false,
  tags: '',
  iconUrl: '',
  status: 'ACTIVE'
};

export default function PluginManagePage() {
  const router = useRouter();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRuntime, setFilterRuntime] = useState<string>('all');

  const loadPlugins = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterRuntime !== 'all') params.runtimeType = filterRuntime;
      
      const response = await pluginManagementApi.getAllPlugins(params);
      if (response.success && response.data?.plugins) {
        setPlugins(response.data.plugins);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load plugins');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterRuntime]);

  useEffect(() => { loadPlugins(); }, [loadPlugins]);

  const resetForm = () => setFormData(initialFormData);

  const openEditDialog = async (plugin: Plugin) => {
    try {
      const response = await pluginManagementApi.getPluginById(plugin.id);
      if (response.success && response.data?.plugin) {
        const p = response.data.plugin;
        setFormData({
          slug: p.slug, name: p.name, description: p.description || '',
          category: p.category || 'integration', runtimeType: p.runtimeType || 'internal-fastify',
          externalBaseUrl: p.externalBaseUrl || '',
          oauthConfig: p.oauthConfig || { installUrl: '', tokenUrl: '', redirectUri: '', scopes: '' },
          integrationSecrets: p.integrationSecrets || { sharedSecret: '' },
          autoGenerateSecret: false, tags: p.tags || '', iconUrl: p.iconUrl || '',
          status: p.status || 'ACTIVE'
        });
        setSelectedPlugin(p);
        setShowEditDialog(true);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load plugin details');
    }
  };

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      const data: any = { ...formData };
      if (formData.runtimeType !== 'external-http') {
        delete data.externalBaseUrl; delete data.oauthConfig; delete data.integrationSecrets;
      }
      const response = await pluginManagementApi.createPlugin(data);
      if (response.success) {
        setShowCreateDialog(false); resetForm(); loadPlugins();
      } else {
        setError(response.message || 'Failed to create plugin');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create plugin');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedPlugin) return;
    try {
      setSubmitting(true);
      const data: any = { ...formData };
      delete data.slug; // Can't change slug
      delete data.autoGenerateSecret;
      if (formData.runtimeType !== 'external-http') {
        data.externalBaseUrl = null;
        data.oauthConfig = null;
        data.integrationSecrets = null;
      }
      const response = await pluginManagementApi.updatePlugin(selectedPlugin.id, data);
      if (response.success) {
        setShowEditDialog(false); setSelectedPlugin(null); resetForm(); loadPlugins();
      } else {
        setError(response.message || 'Failed to update plugin');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update plugin');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPlugin) return;
    try {
      setSubmitting(true);
      const response = await pluginManagementApi.deletePlugin(selectedPlugin.id);
      if (response.success) {
        setShowDeleteDialog(false); setSelectedPlugin(null); loadPlugins();
      } else {
        setError(response.message || 'Failed to delete plugin');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete plugin');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerateSecret = async () => {
    if (!selectedPlugin) return;
    try {
      const response = await pluginManagementApi.regeneratePluginSecret(selectedPlugin.id);
      if (response.success && response.data?.plugin?.integrationSecrets) {
        setFormData(prev => ({
          ...prev,
          integrationSecrets: response.data.plugin.integrationSecrets
        }));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to regenerate secret');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const getRuntimeBadge = (runtimeType: string) => {
    if (runtimeType === 'external-http') {
      return <Badge variant="outline" className="bg-purple-50 text-purple-700"><Globe className="h-3 w-3 mr-1" />External</Badge>;
    }
    return <Badge variant="outline" className="bg-blue-50 text-blue-700"><Package className="h-3 w-3 mr-1" />Internal</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading plugins...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/plugins')}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back to Overview
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Plugin Management</h1>
            <p className="text-gray-600">{plugins.length} plugins registered</p>
          </div>
        </div>
        <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" />Create Plugin
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
          <div>
            <p className="text-red-800">{error}</p>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="mt-2">Dismiss</Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterRuntime} onValueChange={setFilterRuntime}>
              <SelectTrigger><SelectValue placeholder="Filter by runtime" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Runtimes</SelectItem>
                <SelectItem value="internal-fastify">Internal (Fastify)</SelectItem>
                <SelectItem value="external-http">External (HTTP)</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadPlugins}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
          </div>
        </CardContent>
      </Card>

      {/* Plugin List */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Plugins</CardTitle>
          <CardDescription>All plugins in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {plugins.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No plugins found</p>
            ) : (
              plugins.map((plugin) => (
                <div key={plugin.id} className="flex items-center justify-between p-4 border rounded-lg hover:border-blue-500 transition-all">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Package className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold">{plugin.name}</h3>
                        {getRuntimeBadge(plugin.runtimeType)}
                        <Badge variant={plugin.status === 'ACTIVE' ? 'default' : 'secondary'}>
                          {plugin.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{plugin.slug} • {plugin.category}</p>
                      {plugin.runtimeType === 'external-http' && plugin.externalBaseUrl && (
                        <p className="text-xs text-purple-600 flex items-center mt-1">
                          <ExternalLink className="h-3 w-3 mr-1" />{plugin.externalBaseUrl}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">{plugin.installationsCount} installs</span>
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(plugin)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setSelectedPlugin(plugin); setShowDeleteDialog(true); }}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setShowEditDialog(false); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showEditDialog ? 'Edit Plugin' : 'Create New Plugin'}</DialogTitle>
            <DialogDescription>
              {showEditDialog ? 'Update plugin configuration' : 'Configure a new plugin for the platform'}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="external" disabled={formData.runtimeType !== 'external-http'}>
                External Config
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Slug *</label>
                  <Input value={formData.slug} onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="my-plugin" disabled={showEditDialog} />
                </div>
                <div>
                  <label className="text-sm font-medium">Name *</label>
                  <Input value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My Plugin" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Plugin description..." rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Select value={formData.category} onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="payment">Payment</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="integration">Integration</SelectItem>
                      <SelectItem value="theme">Theme</SelectItem>
                      <SelectItem value="analytics">Analytics</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Runtime Type</label>
                  <Select value={formData.runtimeType} onValueChange={(v: 'internal-fastify' | 'external-http') => setFormData(prev => ({ ...prev, runtimeType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal-fastify">Internal (Fastify)</SelectItem>
                      <SelectItem value="external-http">External (HTTP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select value={formData.status} onValueChange={(v: 'ACTIVE' | 'INACTIVE') => setFormData(prev => ({ ...prev, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Tags</label>
                  <Input value={formData.tags} onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="tag1, tag2" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="external" className="space-y-4 mt-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-medium text-purple-800 flex items-center">
                  <Globe className="h-4 w-4 mr-2" />External Plugin Configuration
                </h4>
                <p className="text-sm text-purple-600 mt-1">Configure the external service endpoint and authentication</p>
              </div>

              <div>
                <label className="text-sm font-medium">External Base URL *</label>
                <Input value={formData.externalBaseUrl} onChange={(e) => setFormData(prev => ({ ...prev, externalBaseUrl: e.target.value }))}
                  placeholder="https://my-plugin.example.com" />
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium flex items-center"><Key className="h-4 w-4 mr-2" />OAuth Configuration (Optional)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Install URL</label>
                    <Input value={formData.oauthConfig.installUrl} onChange={(e) => setFormData(prev => ({ ...prev, oauthConfig: { ...prev.oauthConfig, installUrl: e.target.value } }))}
                      placeholder="https://..." />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Token URL</label>
                    <Input value={formData.oauthConfig.tokenUrl} onChange={(e) => setFormData(prev => ({ ...prev, oauthConfig: { ...prev.oauthConfig, tokenUrl: e.target.value } }))}
                      placeholder="https://..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Redirect URI</label>
                    <Input value={formData.oauthConfig.redirectUri} onChange={(e) => setFormData(prev => ({ ...prev, oauthConfig: { ...prev.oauthConfig, redirectUri: e.target.value } }))}
                      placeholder="https://..." />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Scopes</label>
                    <Input value={formData.oauthConfig.scopes} onChange={(e) => setFormData(prev => ({ ...prev, oauthConfig: { ...prev.oauthConfig, scopes: e.target.value } }))}
                      placeholder="read write" />
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium flex items-center"><Key className="h-4 w-4 mr-2" />Shared Secret</h4>
                <div className="flex items-center space-x-2">
                  <Input value={formData.integrationSecrets.sharedSecret} readOnly className="font-mono text-sm" placeholder="Secret will be generated" />
                  {formData.integrationSecrets.sharedSecret && (
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(formData.integrationSecrets.sharedSecret)}>
                      {copiedSecret ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
                {showCreateDialog && (
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={formData.autoGenerateSecret} onChange={(e) => setFormData(prev => ({ ...prev, autoGenerateSecret: e.target.checked }))} />
                    <span className="text-sm">Auto-generate secret on creation</span>
                  </label>
                )}
                {showEditDialog && (
                  <Button variant="outline" size="sm" onClick={handleRegenerateSecret}>
                    <RefreshCw className="h-4 w-4 mr-2" />Regenerate Secret
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setShowEditDialog(false); resetForm(); }}>Cancel</Button>
            <Button onClick={showEditDialog ? handleEdit : handleCreate} disabled={submitting}>
              {submitting ? 'Saving...' : (showEditDialog ? 'Update Plugin' : 'Create Plugin')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Plugin</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedPlugin?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting ? 'Deleting...' : 'Delete Plugin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

