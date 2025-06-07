'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PluginConfigForm from '@/components/plugins/plugin-config-form';
import ConfigTemplates from '@/components/plugins/config-templates';
import {
  ArrowLeft,
  Settings,
  FileText,
  TestTube,
  AlertTriangle,
  CheckCircle,
  Info,
  Code,
  BookOpen
} from 'lucide-react';

interface PluginConfig {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  isInstalled: boolean;
  isActive: boolean;
  currentConfig?: Record<string, any>;
  schema: any;
  documentation?: {
    overview: string;
    examples: Array<{
      title: string;
      config: Record<string, any>;
    }>;
  };
}

export default function PluginConfigurePage() {
  const params = useParams();
  const router = useRouter();
  const [plugin, setPlugin] = useState<PluginConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [configHistory, setConfigHistory] = useState<Array<{
    timestamp: string;
    config: Record<string, any>;
    status: 'success' | 'failed';
  }>>([]);
  const [currentConfig, setCurrentConfig] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchPluginConfig();
  }, [params.id]);

  const fetchPluginConfig = async () => {
    try {
      setLoading(true);

      // Mock plugin configuration data
      const mockPluginConfigs: Record<string, PluginConfig> = {
        'stripe-payment-plugin': {
          id: 'stripe-payment-plugin',
          name: 'Stripe Payment Plugin',
          version: '1.0.0',
          author: 'Jiffoo Team',
          description: 'Accept credit card and debit card payments via Stripe',
          isInstalled: true,
          isActive: true,
          currentConfig: {
            environment: 'sandbox',
            currency: 'USD',
            region: 'US',
            captureMethod: 'automatic',
            enableSavedCards: true,
            enableRecurring: false,
          },
          schema: {
            type: 'object',
            properties: {
              apiKey: {
                type: 'string',
                description: 'Stripe Secret API Key (sk_test_... or sk_live_...)',
                pattern: '^sk_(test|live)_[a-zA-Z0-9]{24,}$',
                minLength: 32,
                sensitive: true,
                required: true,
              },
              webhookSecret: {
                type: 'string',
                description: 'Stripe Webhook Endpoint Secret (whsec_...)',
                pattern: '^whsec_[a-zA-Z0-9]{32,}$',
                minLength: 32,
                sensitive: true,
                required: true,
              },
              environment: {
                type: 'string',
                enum: ['sandbox', 'production'],
                default: 'sandbox',
                description: 'Environment for Stripe integration',
              },
              currency: {
                type: 'string',
                enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
                default: 'USD',
                description: 'Default currency for payments',
              },
              region: {
                type: 'string',
                enum: ['US', 'EU', 'CA', 'AU', 'GB'],
                default: 'US',
                description: 'Primary region for operations',
              },
              captureMethod: {
                type: 'string',
                enum: ['automatic', 'manual'],
                default: 'automatic',
                description: 'Payment capture method',
              },
              statementDescriptor: {
                type: 'string',
                maxLength: 22,
                description: 'Statement descriptor for customer bank statements',
              },
              enableSavedCards: {
                type: 'boolean',
                default: true,
                description: 'Allow customers to save payment methods',
              },
              enableRecurring: {
                type: 'boolean',
                default: false,
                description: 'Enable recurring payment support',
              },
            },
            required: ['apiKey', 'webhookSecret'],
            additionalProperties: false,
          },
          documentation: {
            overview: 'Configure your Stripe integration settings below. Make sure to use the correct API keys for your environment.',
            examples: [
              {
                title: 'Development Setup',
                config: {
                  apiKey: 'sk_test_...',
                  webhookSecret: 'whsec_...',
                  environment: 'sandbox',
                  currency: 'USD',
                  region: 'US',
                  captureMethod: 'automatic',
                  enableSavedCards: true,
                  enableRecurring: false,
                },
              },
              {
                title: 'Production Setup',
                config: {
                  apiKey: 'sk_live_...',
                  webhookSecret: 'whsec_...',
                  environment: 'production',
                  currency: 'USD',
                  region: 'US',
                  captureMethod: 'automatic',
                  statementDescriptor: 'MYSTORE',
                  enableSavedCards: true,
                  enableRecurring: true,
                },
              },
            ],
          },
        },
        'paypal-payment-plugin': {
          id: 'paypal-payment-plugin',
          name: 'PayPal Payment Plugin',
          version: '1.0.0',
          author: 'Jiffoo Team',
          description: 'Accept payments via PayPal',
          isInstalled: true,
          isActive: true,
          currentConfig: {
            environment: 'sandbox',
            currency: 'USD',
            brandName: 'Jiffoo Mall',
            landingPage: 'BILLING',
            userAction: 'PAY_NOW',
            enableShipping: true,
            enableGuestCheckout: true,
          },
          schema: {
            type: 'object',
            properties: {
              clientId: {
                type: 'string',
                description: 'PayPal Client ID from PayPal Developer Dashboard',
                pattern: '^[A-Za-z0-9_-]+$',
                minLength: 20,
                sensitive: false,
                required: true,
              },
              clientSecret: {
                type: 'string',
                description: 'PayPal Client Secret from PayPal Developer Dashboard',
                pattern: '^[A-Za-z0-9_-]+$',
                minLength: 20,
                sensitive: true,
                required: true,
              },
              environment: {
                type: 'string',
                enum: ['sandbox', 'production'],
                default: 'sandbox',
                description: 'Environment for PayPal integration',
              },
              currency: {
                type: 'string',
                enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
                default: 'USD',
                description: 'Default currency for payments',
              },
              brandName: {
                type: 'string',
                maxLength: 127,
                default: 'Jiffoo Mall',
                description: 'Brand name displayed in PayPal checkout',
              },
              landingPage: {
                type: 'string',
                enum: ['LOGIN', 'BILLING', 'NO_PREFERENCE'],
                default: 'BILLING',
                description: 'PayPal checkout landing page preference',
              },
              userAction: {
                type: 'string',
                enum: ['CONTINUE', 'PAY_NOW'],
                default: 'PAY_NOW',
                description: 'Call-to-action text on PayPal checkout',
              },
              enableShipping: {
                type: 'boolean',
                default: true,
                description: 'Enable shipping address collection',
              },
              enableGuestCheckout: {
                type: 'boolean',
                default: true,
                description: 'Allow guest checkout without PayPal account',
              },
            },
            required: ['clientId', 'clientSecret'],
            additionalProperties: false,
          },
          documentation: {
            overview: 'Configure your PayPal integration settings. Ensure you have the correct Client ID and Secret from your PayPal Developer Dashboard.',
            examples: [
              {
                title: 'Basic Setup',
                config: {
                  clientId: 'your-sandbox-client-id',
                  clientSecret: 'your-sandbox-client-secret',
                  environment: 'sandbox',
                  currency: 'USD',
                  brandName: 'Your Store',
                },
              },
              {
                title: 'Production Setup',
                config: {
                  clientId: 'your-live-client-id',
                  clientSecret: 'your-live-client-secret',
                  environment: 'production',
                  currency: 'USD',
                  brandName: 'Your Store',
                  landingPage: 'BILLING',
                  userAction: 'PAY_NOW',
                  enableShipping: true,
                  enableGuestCheckout: true,
                },
              },
            ],
          },
        },
      };

      const pluginConfig = mockPluginConfigs[params.id as string];
      if (pluginConfig) {
        setPlugin(pluginConfig);
        setCurrentConfig(pluginConfig.currentConfig || {});

        // Mock configuration history
        setConfigHistory([
          {
            timestamp: '2024-12-06T10:30:00Z',
            config: pluginConfig.currentConfig || {},
            status: 'success',
          },
          {
            timestamp: '2024-12-05T15:45:00Z',
            config: { ...pluginConfig.currentConfig, environment: 'production' },
            status: 'failed',
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch plugin configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (config: Record<string, any>) => {
    try {
      // Simulate API call to save configuration
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update plugin config
      if (plugin) {
        setPlugin({ ...plugin, currentConfig: config });
        setCurrentConfig(config);

        // Add to history
        setConfigHistory(prev => [{
          timestamp: new Date().toISOString(),
          config,
          status: 'success',
        }, ...prev]);
      }

      console.log('Configuration saved:', config);
    } catch (error) {
      throw new Error('Failed to save configuration');
    }
  };

  const handleTestConfig = async (config: Record<string, any>): Promise<boolean> => {
    try {
      // Simulate API call to test configuration
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock test logic - fail if using test keys in production
      if (config.environment === 'production' && config.apiKey?.includes('test')) {
        throw new Error('Cannot use test API keys in production environment');
      }

      return true;
    } catch (error) {
      throw error;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleApplyTemplate = (templateConfig: Record<string, any>) => {
    setCurrentConfig(templateConfig);
    if (plugin) {
      setPlugin({ ...plugin, currentConfig: templateConfig });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading plugin configuration...</p>
        </div>
      </div>
    );
  }

  if (!plugin) {
    return (
      <div className="text-center py-12">
        <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Plugin not found</h2>
        <p className="text-gray-600 mb-4">The requested plugin could not be found or is not installed.</p>
        <Button onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  if (!plugin.isInstalled) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Plugin not installed</h2>
        <p className="text-gray-600 mb-4">This plugin must be installed before it can be configured.</p>
        <Button onClick={() => router.push(`/plugins/${plugin.id}`)}>
          View Plugin Details
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Configure {plugin.name}</h1>
            <Badge className={plugin.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
              {plugin.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-gray-600">by {plugin.author} • Version {plugin.version}</p>
        </div>
      </div>

      {/* Status Alert */}
      {!plugin.isActive && (
        <Alert className="border-yellow-500">
          <AlertTriangle className="w-4 h-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            This plugin is currently inactive. Activate it after configuration to start processing payments.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="configuration" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="examples">Examples</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-4">
          <PluginConfigForm
            pluginId={plugin.id}
            pluginName={plugin.name}
            schema={plugin.schema}
            currentConfig={currentConfig}
            onSave={handleSaveConfig}
            onTest={handleTestConfig}
          />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Configuration Templates
              </CardTitle>
              <CardDescription>
                Quick-start templates for common configuration scenarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfigTemplates
                pluginId={plugin.id}
                onApplyTemplate={handleApplyTemplate}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="examples" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Configuration Examples
              </CardTitle>
              <CardDescription>
                Common configuration examples for different use cases
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {plugin.documentation?.examples.map((example, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">{example.title}</h3>
                  <div className="bg-gray-50 rounded p-3">
                    <pre className="text-sm text-gray-800 overflow-x-auto">
                      {JSON.stringify(example.config, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Configuration History
              </CardTitle>
              <CardDescription>
                Previous configuration changes and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {configHistory.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No configuration history available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {configHistory.map((entry, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {entry.status === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                          )}
                          <span className="font-medium">
                            {entry.status === 'success' ? 'Configuration Saved' : 'Configuration Failed'}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                          View Configuration
                        </summary>
                        <div className="mt-2 bg-gray-50 rounded p-3">
                          <pre className="text-xs text-gray-800 overflow-x-auto">
                            {JSON.stringify(entry.config, null, 2)}
                          </pre>
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
