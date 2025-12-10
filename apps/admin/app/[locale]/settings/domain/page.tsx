/**
 * Domain Settings Page
 * 域名配置页面 - 支持自定义域名和子域名配置
 * 🆕 增强版：展示 Frontend/Admin/API 三种域名的访问 URL 和 DNS 配置
 */
'use client';

import { AlertTriangle, CheckCircle, Clock, Globe, RefreshCw, Server, Shield } from 'lucide-react'
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { useT } from 'shared/src/i18n';

// 🆕 增强的域名配置接口 - 支持 Frontend/Admin/API 三种域名
interface DomainSettings {
  tenantId: string;
  companyName: string;
  domain: string | null;
  subdomain: string | null;
  domainStatus: 'not_configured' | 'pending_dns' | 'active';
  accessUrls: {
    // 🆕 新结构：按应用类型分组
    frontend?: {
      custom?: string;
      subdomain?: string;
      platform?: string;
      fallback?: string;
    };
    admin?: {
      custom?: string;
      platform?: string;
    };
    api?: {
      custom?: string;
      platform?: string;
    };
    // 兼容旧结构
    customDomain?: string;
    subdomain?: string;
    fallback?: string;
  };
  dnsInstructions?: {
    // 🆕 新结构：按应用类型分组
    frontend?: DnsRecord;
    admin?: DnsRecord;
    api?: DnsRecord;
    // 兼容旧结构
    type?: 'A' | 'CNAME';
    host?: string;
    value?: string;
    ttl?: number;
  };
}

interface DnsRecord {
  type: 'A' | 'CNAME';
  host: string;
  value: string;
  ttl: number;
}

export default function DomainSettingsPage() {
  const router = useRouter();
  const t = useT();

  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<DomainSettings | null>(null);
  const [formData, setFormData] = useState({
    domain: '',
    subdomain: '',
  });
  const [validating, setValidating] = useState({
    domain: false,
    subdomain: false,
  });
  const [validation, setValidation] = useState({
    domain: { available: true, message: '' },
    subdomain: { available: true, message: '' },
  });

  // 加载当前配置
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/domain-settings');
      
      if (response.success && response.data) {
        setSettings(response.data);
        setFormData({
          domain: response.data.domain || '',
          subdomain: response.data.subdomain || '',
        });
      }
    } catch (error) {
      console.error('Failed to load domain settings:', error);
      toast.error('Failed to load domain settings');
    } finally {
      setLoading(false);
    }
  };

  // 验证域名
  const validateDomain = async (domain: string) => {
    if (!domain) {
      setValidation(prev => ({ ...prev, domain: { available: true, message: '' } }));
      return;
    }

    try {
      setValidating(prev => ({ ...prev, domain: true }));
      const response = await apiClient.get(`/admin/domain-settings/validate-domain?domain=${domain}`);

      if (response.success && response.data) {
        setValidation(prev => ({
          ...prev,
          domain: {
            available: response.data.available ?? false,
            message: response.data.message || '',
          },
        }));
      }
    } catch (error) {
      console.error('Domain validation error:', error);
    } finally {
      setValidating(prev => ({ ...prev, domain: false }));
    }
  };

  // 验证子域名
  const validateSubdomain = async (subdomain: string) => {
    if (!subdomain) {
      setValidation(prev => ({ ...prev, subdomain: { available: true, message: '' } }));
      return;
    }

    try {
      setValidating(prev => ({ ...prev, subdomain: true }));
      const response = await apiClient.get(`/admin/domain-settings/validate-subdomain?subdomain=${subdomain}`);

      if (response.success && response.data) {
        setValidation(prev => ({
          ...prev,
          subdomain: {
            available: response.data.available ?? false,
            message: response.data.message || '',
          },
        }));
      }
    } catch (error) {
      console.error('Subdomain validation error:', error);
    } finally {
      setValidating(prev => ({ ...prev, subdomain: false }));
    }
  };

  // 保存配置
  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await apiClient.put('/admin/domain-settings', {
        domain: formData.domain || null,
        subdomain: formData.subdomain || null,
      });

      if (response.success) {
        toast.success('Domain settings updated successfully');
        await loadSettings();
      } else {
        toast.error(response.message || 'Failed to update domain settings');
      }
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(error.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-4 h-4 mr-1" />
            {getText('tenant.settings.domainSettings.statusActive', 'Active')}
          </span>
        );
      case 'pending_dns':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-4 h-4 mr-1" />
            {getText('tenant.settings.domainSettings.statusPendingDns', 'Pending DNS')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            {getText('tenant.settings.domainSettings.statusNotConfigured', 'Not Configured')}
          </span>
        );
    }
  };

  // 🆕 DNS 记录展示组件
  const DnsRecordItem = ({ label, record, icon }: { label: string; record: DnsRecord; icon: React.ReactNode }) => (
    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center mb-2">
        {icon}
        <span className="ml-2 font-medium text-sm text-gray-900">{label}</span>
      </div>
      <div className="space-y-1 text-sm ml-6">
        <p>Type: <code className="bg-white px-2 py-0.5 rounded border">{record.type}</code></p>
        <p>Host: <code className="bg-white px-2 py-0.5 rounded border">{record.host}</code></p>
        <p>Value: <code className="bg-white px-2 py-0.5 rounded border text-xs">{record.value}</code></p>
        <p>TTL: <code className="bg-white px-2 py-0.5 rounded border">{record.ttl}</code></p>
      </div>
    </div>
  );

  // 🆕 URL 展示组件
  const UrlItem = ({ label, url, color }: { label: string; url: string; color: string }) => {
    const colorClasses: Record<string, { bg: string; text: string; icon: string }> = {
      blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'text-blue-600' },
      green: { bg: 'bg-green-50', text: 'text-green-600', icon: 'text-green-600' },
      purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'text-purple-600' },
      orange: { bg: 'bg-orange-50', text: 'text-orange-600', icon: 'text-orange-600' },
      gray: { bg: 'bg-gray-50', text: 'text-gray-600', icon: 'text-gray-500' },
    };
    const classes = colorClasses[color] || colorClasses.gray;

    return (
      <div className={`flex items-center justify-between p-3 ${classes.bg} rounded-lg`}>
        <div>
          <p className="text-sm font-medium text-gray-700">{label}</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${classes.text} hover:underline text-sm`}
          >
            {url}
          </a>
        </div>
        <Globe className={`w-5 h-5 ${classes.icon}`} />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{getText('tenant.settings.domainSettings.title', 'Domain Settings')}</h1>
        <p className="text-gray-600 mt-2">
          {getText('tenant.settings.domainSettings.subtitle', 'Configure your custom domain and subdomain for your online store')}
        </p>
      </div>

      {/* Current Status - 🆕 增强版：展示 Frontend/Admin/API 三种域名 */}
      {settings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{getText('tenant.settings.domainSettings.currentConfig', 'Current Configuration')}</span>
              {getStatusBadge(settings.domainStatus)}
            </CardTitle>
            <CardDescription>
              {getText('tenant.settings.domainSettings.accessUrlsDesc', 'Your store can be accessed through the following URLs')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Frontend URLs */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <Globe className="w-4 h-4 mr-2 text-blue-600" />
                {getText('tenant.settings.domainSettings.frontendStore', 'Frontend (Store)')}
              </h4>
              <div className="space-y-2">
                {settings.accessUrls.frontend?.custom && (
                  <UrlItem
                    label={getText('tenant.settings.domainSettings.customDomain', 'Custom Domain')}
                    url={settings.accessUrls.frontend.custom}
                    color="blue"
                  />
                )}
                {settings.accessUrls.frontend?.subdomain && (
                  <UrlItem
                    label={getText('tenant.settings.domainSettings.subdomain', 'Subdomain')}
                    url={settings.accessUrls.frontend.subdomain}
                    color="green"
                  />
                )}
                {settings.accessUrls.frontend?.fallback && (
                  <UrlItem
                    label={getText('tenant.settings.domainSettings.platformUrl', 'Platform URL')}
                    url={settings.accessUrls.frontend.fallback}
                    color="gray"
                  />
                )}
                {/* 兼容旧结构 */}
                {!settings.accessUrls.frontend && settings.accessUrls.customDomain && (
                  <UrlItem
                    label={getText('tenant.settings.domainSettings.customDomain', 'Custom Domain')}
                    url={settings.accessUrls.customDomain}
                    color="blue"
                  />
                )}
                {!settings.accessUrls.frontend && settings.accessUrls.subdomain && (
                  <UrlItem
                    label={getText('tenant.settings.domainSettings.subdomain', 'Subdomain')}
                    url={settings.accessUrls.subdomain}
                    color="green"
                  />
                )}
                {!settings.accessUrls.frontend && settings.accessUrls.fallback && (
                  <UrlItem
                    label={getText('tenant.settings.domainSettings.platformUrl', 'Platform URL')}
                    url={settings.accessUrls.fallback}
                    color="gray"
                  />
                )}
              </div>
            </div>

            {/* Admin URLs */}
            {(settings.accessUrls.admin?.custom || settings.accessUrls.admin?.platform) && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <Shield className="w-4 h-4 mr-2 text-purple-600" />
                  {getText('tenant.settings.domainSettings.adminDashboard', 'Admin Dashboard')}
                </h4>
                <div className="space-y-2">
                  {settings.accessUrls.admin?.custom && (
                    <UrlItem
                      label={getText('tenant.settings.domainSettings.customAdminDomain', 'Custom Admin Domain')}
                      url={settings.accessUrls.admin.custom}
                      color="purple"
                    />
                  )}
                  {settings.accessUrls.admin?.platform && (
                    <UrlItem
                      label={getText('tenant.settings.domainSettings.platformAdminUrl', 'Platform Admin URL')}
                      url={settings.accessUrls.admin.platform}
                      color="gray"
                    />
                  )}
                </div>
              </div>
            )}

            {/* API URLs */}
            {(settings.accessUrls.api?.custom || settings.accessUrls.api?.platform) && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <Server className="w-4 h-4 mr-2 text-orange-600" />
                  {getText('tenant.settings.domainSettings.apiEndpoint', 'API Endpoint')}
                </h4>
                <div className="space-y-2">
                  {settings.accessUrls.api?.custom && (
                    <UrlItem
                      label={getText('tenant.settings.domainSettings.customApiDomain', 'Custom API Domain')}
                      url={settings.accessUrls.api.custom}
                      color="orange"
                    />
                  )}
                  {settings.accessUrls.api?.platform && (
                    <UrlItem
                      label={getText('tenant.settings.domainSettings.platformApiUrl', 'Platform API URL')}
                      url={settings.accessUrls.api.platform}
                      color="gray"
                    />
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Domain Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>{getText('tenant.settings.domainSettings.customDomainTitle', 'Custom Domain')}</CardTitle>
          <CardDescription>
            {getText('tenant.settings.domainSettings.customDomainDesc', 'Use your own domain name (e.g., shop.yourcompany.com or yourcompany.com)')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="domain">{getText('tenant.settings.domainSettings.domainName', 'Domain Name')}</Label>
            <Input
              id="domain"
              type="text"
              placeholder="example.com"
              value={formData.domain}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, domain: e.target.value }));
                validateDomain(e.target.value);
              }}
              className="mt-1"
            />
            {validating.domain && (
              <p className="text-sm text-gray-500 mt-1">{getText('tenant.settings.domainSettings.checkingAvailability', 'Checking availability...')}</p>
            )}
            {!validating.domain && validation.domain.message && (
              <p className={`text-sm mt-1 ${validation.domain.available ? 'text-green-600' : 'text-red-600'}`}>
                {validation.domain.message}
              </p>
            )}
          </div>

          {/* 🆕 增强版 DNS 配置说明 - 展示 Frontend/Admin/API 三种域名 */}
          {settings?.dnsInstructions && formData.domain && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-3">{getText('tenant.settings.domainSettings.dnsConfigRequired', 'DNS Configuration Required')}:</p>

                {/* 新结构：按应用类型分组 */}
                {settings.dnsInstructions.frontend && (
                  <DnsRecordItem
                    label={getText('tenant.settings.domainSettings.frontendStore', 'Frontend (Store)')}
                    record={settings.dnsInstructions.frontend}
                    icon={<Globe className="w-4 h-4 text-blue-600" />}
                  />
                )}
                {settings.dnsInstructions.admin && (
                  <DnsRecordItem
                    label={getText('tenant.settings.domainSettings.adminDashboard', 'Admin Dashboard')}
                    record={settings.dnsInstructions.admin}
                    icon={<Shield className="w-4 h-4 text-purple-600" />}
                  />
                )}
                {settings.dnsInstructions.api && (
                  <DnsRecordItem
                    label={getText('tenant.settings.domainSettings.apiEndpoint', 'API Endpoint')}
                    record={settings.dnsInstructions.api}
                    icon={<Server className="w-4 h-4 text-orange-600" />}
                  />
                )}

                {/* 兼容旧结构 */}
                {!settings.dnsInstructions.frontend && settings.dnsInstructions.type && (
                  <div className="space-y-1 text-sm mb-3">
                    <p>Type: <code className="bg-gray-100 px-2 py-1 rounded">{settings.dnsInstructions.type}</code></p>
                    <p>Host: <code className="bg-gray-100 px-2 py-1 rounded">{settings.dnsInstructions.host}</code></p>
                    <p>Value: <code className="bg-gray-100 px-2 py-1 rounded">{settings.dnsInstructions.value}</code></p>
                    <p>TTL: <code className="bg-gray-100 px-2 py-1 rounded">{settings.dnsInstructions.ttl}</code></p>
                  </div>
                )}

                <p className="mt-3 text-gray-600 text-sm">
                  {getText('tenant.settings.domainSettings.dnsNote', 'Please contact your IT team or submit a support ticket to configure DNS records. DNS propagation may take up to 48 hours.')}
                </p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Subdomain Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>{getText('tenant.settings.domainSettings.subdomainTitle', 'Subdomain')}</CardTitle>
          <CardDescription>
            {getText('tenant.settings.domainSettings.subdomainDesc', 'Choose a subdomain on our platform (e.g., yourstore.jiffoo.com)')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="subdomain">{getText('tenant.settings.domainSettings.subdomain', 'Subdomain')}</Label>
            <div className="flex items-center mt-1">
              <Input
                id="subdomain"
                type="text"
                placeholder="yourstore"
                value={formData.subdomain}
                onChange={(e) => {
                  const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                  setFormData(prev => ({ ...prev, subdomain: value }));
                  validateSubdomain(value);
                }}
                className="rounded-r-none"
              />
              <span className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 rounded-r-md">
                .jiffoo.com
              </span>
            </div>
            {validating.subdomain && (
              <p className="text-sm text-gray-500 mt-1">{getText('tenant.settings.domainSettings.checkingAvailability', 'Checking availability...')}</p>
            )}
            {!validating.subdomain && validation.subdomain.message && (
              <p className={`text-sm mt-1 ${validation.subdomain.available ? 'text-green-600' : 'text-red-600'}`}>
                {validation.subdomain.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        <Button variant="outline" onClick={() => router.push('/settings')}>
          {getText('tenant.settings.domainSettings.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !validation.domain.available || !validation.subdomain.available}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {saving ? getText('tenant.settings.domainSettings.saving', 'Saving...') : getText('tenant.settings.domainSettings.saveChanges', 'Save Changes')}
        </Button>
      </div>
    </div>
  );
}

