'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  Copy, 
  CheckCircle, 
  Info,
  Zap,
  Shield,
  Globe
} from 'lucide-react';

interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  category: 'development' | 'production' | 'testing';
  config: Record<string, any>;
  features: string[];
  warnings?: string[];
}

interface ConfigTemplatesProps {
  pluginId: string;
  onApplyTemplate: (config: Record<string, any>) => void;
}

export default function ConfigTemplates({ pluginId, onApplyTemplate }: ConfigTemplatesProps) {
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);

  const getTemplatesForPlugin = (pluginId: string): ConfigTemplate[] => {
    const templates: Record<string, ConfigTemplate[]> = {
      'stripe-payment-plugin': [
        {
          id: 'stripe-dev',
          name: 'Development Setup',
          description: 'Basic configuration for development and testing',
          category: 'development',
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
          features: ['Test mode', 'Automatic capture', 'Saved cards'],
        },
        {
          id: 'stripe-prod-basic',
          name: 'Production Basic',
          description: 'Basic production configuration with essential features',
          category: 'production',
          config: {
            apiKey: 'sk_live_...',
            webhookSecret: 'whsec_...',
            environment: 'production',
            currency: 'USD',
            region: 'US',
            captureMethod: 'automatic',
            statementDescriptor: 'MYSTORE',
            enableSavedCards: true,
            enableRecurring: false,
          },
          features: ['Live mode', 'Statement descriptor', 'Saved cards'],
          warnings: ['Requires live API keys', 'Real money transactions'],
        },
        {
          id: 'stripe-prod-advanced',
          name: 'Production Advanced',
          description: 'Full-featured production configuration',
          category: 'production',
          config: {
            apiKey: 'sk_live_...',
            webhookSecret: 'whsec_...',
            environment: 'production',
            currency: 'USD',
            region: 'US',
            captureMethod: 'manual',
            statementDescriptor: 'MYSTORE',
            enableSavedCards: true,
            enableRecurring: true,
          },
          features: ['Live mode', 'Manual capture', 'Recurring payments', 'Saved cards'],
          warnings: ['Requires live API keys', 'Manual capture requires additional handling'],
        },
        {
          id: 'stripe-testing',
          name: 'Testing & QA',
          description: 'Configuration optimized for testing scenarios',
          category: 'testing',
          config: {
            apiKey: 'sk_test_...',
            webhookSecret: 'whsec_...',
            environment: 'sandbox',
            currency: 'USD',
            region: 'US',
            captureMethod: 'automatic',
            enableSavedCards: false,
            enableRecurring: false,
          },
          features: ['Test mode', 'Simplified setup', 'No saved cards'],
        },
      ],
      'paypal-payment-plugin': [
        {
          id: 'paypal-dev',
          name: 'Development Setup',
          description: 'Basic PayPal configuration for development',
          category: 'development',
          config: {
            clientId: 'your-sandbox-client-id',
            clientSecret: 'your-sandbox-client-secret',
            environment: 'sandbox',
            currency: 'USD',
            brandName: 'Your Store',
            landingPage: 'BILLING',
            userAction: 'PAY_NOW',
            enableShipping: true,
            enableGuestCheckout: true,
          },
          features: ['Sandbox mode', 'Guest checkout', 'Shipping enabled'],
        },
        {
          id: 'paypal-prod',
          name: 'Production Setup',
          description: 'Production PayPal configuration',
          category: 'production',
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
          features: ['Live mode', 'Guest checkout', 'Shipping enabled'],
          warnings: ['Requires live credentials', 'Real money transactions'],
        },
        {
          id: 'paypal-minimal',
          name: 'Minimal Setup',
          description: 'Minimal PayPal configuration for testing',
          category: 'testing',
          config: {
            clientId: 'your-sandbox-client-id',
            clientSecret: 'your-sandbox-client-secret',
            environment: 'sandbox',
            currency: 'USD',
            brandName: 'Test Store',
          },
          features: ['Sandbox mode', 'Basic setup'],
        },
      ],
    };

    return templates[pluginId] || [];
  };

  const templates = getTemplatesForPlugin(pluginId);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'development':
        return <Zap className="w-4 h-4 text-blue-600" />;
      case 'production':
        return <Shield className="w-4 h-4 text-green-600" />;
      case 'testing':
        return <FileText className="w-4 h-4 text-purple-600" />;
      default:
        return <Globe className="w-4 h-4 text-gray-600" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'development':
        return 'bg-blue-100 text-blue-800';
      case 'production':
        return 'bg-green-100 text-green-800';
      case 'testing':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCopyConfig = async (template: ConfigTemplate) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(template.config, null, 2));
      setCopiedTemplate(template.id);
      setTimeout(() => setCopiedTemplate(null), 2000);
    } catch (error) {
      console.error('Failed to copy configuration:', error);
    }
  };

  const handleApplyTemplate = (template: ConfigTemplate) => {
    onApplyTemplate(template.config);
  };

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates available</h3>
          <p className="text-gray-600">
            Configuration templates are not available for this plugin.
          </p>
        </CardContent>
      </Card>
    );
  }

  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, ConfigTemplate[]>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
        <div key={category} className="space-y-4">
          <div className="flex items-center gap-2">
            {getCategoryIcon(category)}
            <h3 className="text-lg font-semibold text-gray-900 capitalize">
              {category} Templates
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categoryTemplates.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {template.description}
                      </CardDescription>
                    </div>
                    <Badge className={getCategoryColor(template.category)}>
                      {template.category}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Features */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Features:</h4>
                    <div className="flex flex-wrap gap-1">
                      {template.features.map((feature) => (
                        <Badge key={feature} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Warnings */}
                  {template.warnings && template.warnings.length > 0 && (
                    <Alert className="border-yellow-500">
                      <Info className="w-4 h-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-800">
                        <ul className="list-disc list-inside space-y-1">
                          {template.warnings.map((warning, index) => (
                            <li key={index} className="text-sm">{warning}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Configuration Preview */}
                  <details className="group">
                    <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                      <span>View Configuration</span>
                    </summary>
                    <div className="mt-2 bg-gray-50 rounded p-3 max-h-40 overflow-y-auto">
                      <pre className="text-xs text-gray-800">
                        {JSON.stringify(template.config, null, 2)}
                      </pre>
                    </div>
                  </details>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyConfig(template)}
                      className="flex items-center gap-1"
                    >
                      {copiedTemplate === template.id ? (
                        <CheckCircle className="w-3 h-3 text-green-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copiedTemplate === template.id ? 'Copied!' : 'Copy'}
                    </Button>
                    
                    <Button
                      size="sm"
                      onClick={() => handleApplyTemplate(template)}
                      className="flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3" />
                      Apply Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
