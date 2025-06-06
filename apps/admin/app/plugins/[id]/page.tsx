'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Download, 
  Settings, 
  Shield, 
  Star, 
  DollarSign,
  Globe,
  CreditCard,
  Smartphone,
  CheckCircle,
  AlertTriangle,
  Package,
  ExternalLink,
  Code,
  BookOpen,
  Users,
  Calendar
} from 'lucide-react';

interface PluginDetail {
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
  documentation?: {
    overview: string;
    features: string[];
    setup: {
      steps: string[];
      webhookEvents?: string[];
    };
    pricing?: {
      transactionFees: string;
      internationalFees?: string;
      disputeFee?: string;
      note: string;
    };
    security: string[];
    examples: Array<{
      title: string;
      config: Record<string, any>;
    }>;
    troubleshooting?: Array<{
      issue: string;
      solution: string;
    }>;
  };
  isInstalled?: boolean;
  isActive?: boolean;
}

export default function PluginDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [plugin, setPlugin] = useState<PluginDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPluginDetail();
  }, [params.id]);

  const fetchPluginDetail = async () => {
    try {
      setLoading(true);
      
      // Fetch available plugins and find the one we need
      const response = await fetch('/api/payments/plugins/available');
      const data = await response.json();
      
      if (data.success) {
        const foundPlugin = data.data.plugins.find((p: any) => p.id === params.id);
        if (foundPlugin) {
          // Add mock documentation for demo
          const pluginWithDocs = {
            ...foundPlugin,
            documentation: getPluginDocumentation(foundPlugin.id),
          };
          setPlugin(pluginWithDocs);
        }
      }
    } catch (error) {
      console.error('Failed to fetch plugin detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPluginDocumentation = (pluginId: string) => {
    // Mock documentation based on plugin ID
    const docs = {
      'stripe-payment-plugin': {
        overview: 'Stripe Payment Plugin enables secure credit and debit card processing through Stripe\'s industry-leading payment infrastructure.',
        features: [
          'Accept major credit and debit cards worldwide',
          'PCI DSS compliant payment processing',
          'Advanced fraud protection with Stripe Radar',
          'Support for 135+ currencies',
          'Saved payment methods for returning customers',
          'Recurring payments and subscriptions',
          'Real-time payment processing',
          'Comprehensive webhook notifications'
        ],
        setup: {
          steps: [
            'Create a Stripe account at https://stripe.com',
            'Get your API keys from the Stripe Dashboard',
            'Set up webhook endpoints for real-time notifications',
            'Configure the plugin with your API keys',
            'Test payments in sandbox mode',
            'Switch to production when ready'
          ],
          webhookEvents: [
            'payment_intent.succeeded',
            'payment_intent.payment_failed',
            'charge.dispute.created',
            'invoice.payment_succeeded'
          ]
        },
        pricing: {
          transactionFees: '2.9% + 30¢ per successful charge',
          internationalFees: 'Additional 1.5% for international cards',
          disputeFee: '$15.00 per dispute',
          note: 'Stripe fees are separate from plugin licensing fees'
        },
        security: [
          'PCI DSS Level 1 certified',
          'End-to-end encryption',
          'Tokenized payment data',
          'Advanced fraud detection',
          'Machine learning risk scoring',
          'Real-time monitoring'
        ],
        examples: [
          {
            title: 'Basic Configuration',
            config: {
              apiKey: 'sk_test_...',
              webhookSecret: 'whsec_...',
              environment: 'sandbox',
              currency: 'USD'
            }
          }
        ],
        troubleshooting: [
          {
            issue: 'Invalid API key error',
            solution: 'Verify your API key format and ensure it matches your environment'
          },
          {
            issue: 'Webhook verification failed',
            solution: 'Check your webhook secret and ensure the endpoint URL is correct'
          }
        ]
      },
      'paypal-payment-plugin': {
        overview: 'PayPal Payment Plugin enables secure payments through PayPal\'s trusted global payment platform with buyer protection and fraud prevention.',
        features: [
          'Accept PayPal payments globally',
          'PayPal buyer protection for customers',
          'Support for 200+ markets worldwide',
          'Guest checkout without PayPal account required',
          'One Touch payments for returning customers',
          'Mobile-optimized checkout experience',
          'Real-time payment processing',
          'Multi-currency support'
        ],
        setup: {
          steps: [
            'Create a PayPal Business account at https://paypal.com',
            'Access PayPal Developer Dashboard',
            'Create a new application to get Client ID and Secret',
            'Configure webhook endpoints for notifications',
            'Configure the plugin with your credentials',
            'Test payments in sandbox mode'
          ],
          webhookEvents: [
            'PAYMENT.CAPTURE.COMPLETED',
            'PAYMENT.CAPTURE.DENIED',
            'CHECKOUT.ORDER.APPROVED'
          ]
        },
        pricing: {
          transactionFees: '2.9% + fixed fee per transaction',
          internationalFees: 'Additional fees for cross-border transactions',
          disputeFee: '$20.00 per dispute',
          note: 'PayPal fees are separate from plugin licensing fees'
        },
        security: [
          'PCI DSS compliant',
          'Advanced fraud protection',
          'Buyer and seller protection',
          'Encrypted data transmission',
          'Risk monitoring and scoring'
        ],
        examples: [
          {
            title: 'Basic Configuration',
            config: {
              clientId: 'your-client-id',
              clientSecret: 'your-client-secret',
              environment: 'sandbox',
              currency: 'USD'
            }
          }
        ],
        troubleshooting: [
          {
            issue: 'Invalid client credentials',
            solution: 'Verify your Client ID and Secret from PayPal Developer Dashboard'
          }
        ]
      }
    };

    return docs[pluginId as keyof typeof docs] || {
      overview: 'Plugin documentation not available.',
      features: [],
      setup: { steps: [] },
      security: [],
      examples: []
    };
  };

  const handleInstallPlugin = async () => {
    if (!plugin) return;

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        alert('Please login to install plugins');
        return;
      }

      const licenseKey = plugin.id === 'stripe-payment-plugin' ? 'stripe-license-123' : 'paypal-license-456';

      const response = await fetch(`/api/payments/plugins/${plugin.id}/install`, {
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
        setPlugin({ ...plugin, isInstalled: true });
      } else {
        alert(`Installation failed: ${data.message}`);
      }
    } catch (error) {
      console.error('Installation failed:', error);
      alert('Installation failed. Please try again.');
    }
  };

  const getLicenseBadgeColor = (license: string) => {
    switch (license) {
      case 'free': return 'bg-green-100 text-green-800';
      case 'basic': return 'bg-blue-100 text-blue-800';
      case 'premium': return 'bg-purple-100 text-purple-800';
      case 'enterprise': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading plugin details...</p>
        </div>
      </div>
    );
  }

  if (!plugin) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Plugin not found</h2>
        <p className="text-gray-600 mb-4">The requested plugin could not be found.</p>
        <Button onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
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
            <h1 className="text-3xl font-bold text-gray-900">{plugin.name}</h1>
            <Badge className={getLicenseBadgeColor(plugin.license)}>
              {plugin.license}
            </Badge>
          </div>
          <p className="text-gray-600">by {plugin.author} • Version {plugin.version}</p>
        </div>
        <div className="flex items-center gap-3">
          {plugin.price ? (
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">${plugin.price}</div>
              <div className="text-sm text-gray-500">per month</div>
            </div>
          ) : (
            <div className="text-2xl font-bold text-green-600">Free</div>
          )}
          {plugin.isInstalled ? (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="w-4 h-4 mr-1" />
              Installed
            </Badge>
          ) : (
            <Button onClick={handleInstallPlugin} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Install Plugin
            </Button>
          )}
        </div>
      </div>

      {/* Plugin Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-4">{plugin.description}</p>
          {plugin.documentation && (
            <p className="text-gray-600">{plugin.documentation.overview}</p>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="features" className="space-y-4">
        <TabsList>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
        </TabsList>

        <TabsContent value="features" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Key Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plugin.documentation?.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Payment Methods
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {plugin.methods.map((method) => (
                    <div key={method} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium">{method.replace('_', ' ').toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Supported Regions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {plugin.regions.map((region) => (
                    <Badge key={region} variant="outline">
                      {region === '*' ? 'Global' : region}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Supported Currencies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {plugin.currencies.map((currency) => (
                    <Badge key={currency} variant="outline">
                      {currency}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="setup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Installation Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {plugin.documentation?.setup.steps.map((step, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white text-sm rounded-full flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="text-sm">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {plugin.documentation?.setup.webhookEvents && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="w-5 h-5" />
                  Webhook Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {plugin.documentation.setup.webhookEvents.map((event) => (
                    <div key={event} className="p-2 bg-gray-50 rounded font-mono text-sm">
                      {event}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4">
          {plugin.documentation?.pricing && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Transaction Fees
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">Standard Fees</h4>
                    <p className="text-blue-800">{plugin.documentation.pricing.transactionFees}</p>
                  </div>
                  
                  {plugin.documentation.pricing.internationalFees && (
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <h4 className="font-semibold text-orange-900 mb-2">International Fees</h4>
                      <p className="text-orange-800">{plugin.documentation.pricing.internationalFees}</p>
                    </div>
                  )}
                  
                  {plugin.documentation.pricing.disputeFee && (
                    <div className="p-4 bg-red-50 rounded-lg">
                      <h4 className="font-semibold text-red-900 mb-2">Dispute Fee</h4>
                      <p className="text-red-800">{plugin.documentation.pricing.disputeFee}</p>
                    </div>
                  )}
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    {plugin.documentation.pricing.note}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Security Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {plugin.documentation?.security.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support" className="space-y-4">
          {plugin.documentation?.troubleshooting && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Troubleshooting
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {plugin.documentation.troubleshooting.map((item, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4">
                      <h4 className="font-semibold text-gray-900 mb-1">{item.issue}</h4>
                      <p className="text-sm text-gray-600">{item.solution}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <BookOpen className="w-4 h-4 mr-2" />
                View Documentation
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <ExternalLink className="w-4 h-4 mr-2" />
                Contact Support
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Users className="w-4 h-4 mr-2" />
                Community Forum
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
