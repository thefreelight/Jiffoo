/**
 * Business Model Page
 *
 * Displays pricing plans, plugin comparisons, and SaaS services with i18n support.
 */

'use client'

import { CheckCircle, Cloud, Gift, Heart, Settings, ShieldCheck, Users, X, Zap } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useT } from 'shared/src/i18n'

export default function BusinessModelPage() {
  const [selectedPlan, setSelectedPlan] = useState('open-source')
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const plans = [
    {
      id: 'open-source',
      name: 'Open Source',
      price: 'Free',
      description: 'Perfect for learning and small projects',
      icon: Heart,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      features: [
        'Core e-commerce functionality',
        'Basic product management',
        'Order processing',
        'User management',
        'Plugin system framework',
        'Demo authentication plugins',
        'Basic payment interface',
        'Community support',
        'Open source code'
      ],
      limitations: [
        'Demo plugins only',
        'Limited authentication (100/month)',
        'Basic features only',
        'No commercial support',
        'No advanced analytics'
      ]
    },
    {
      id: 'professional',
      name: 'Professional',
      price: '$99/month',
      description: 'For growing businesses',
      icon: Zap,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      features: [
        'Everything in Open Source',
        'Commercial authentication plugins',
        'Advanced payment gateways',
        'Email marketing automation',
        'Advanced analytics',
        'Priority support',
        'Custom themes',
        'Multi-language support',
        'Inventory management'
      ],
      limitations: [
        'Single domain license',
        'Standard support hours',
        'Limited customization'
      ]
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '$499/month',
      description: 'For large organizations',
      icon: ShieldCheck,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      features: [
        'Everything in Professional',
        'Multi-tenant support',
        'White-label solutions',
        'Custom development',
        'Dedicated support',
        'SLA guarantee',
        'Advanced security',
        'API rate limiting',
        'Custom integrations'
      ],
      limitations: [
        'Custom pricing for 100+ sites'
      ]
    }
  ]

  const plugins = [
    {
      name: 'WeChat Pay',
      openSource: 'Demo only (10 transactions/month)',
      commercial: 'Full integration + unlimited transactions',
      price: '$29.99/month'
    },
    {
      name: 'Alipay',
      openSource: 'Demo only (5 transactions/month)',
      commercial: 'Full integration + automatic reconciliation',
      price: '$29.99/month'
    },
    {
      name: 'Stripe Pro',
      openSource: 'Basic integration',
      commercial: 'Advanced features + webhooks + analytics',
      price: '$39.99/month'
    },
    {
      name: 'Email Marketing',
      openSource: 'Basic SMTP (50 emails/month)',
      commercial: 'Automation + templates + analytics',
      price: '$49.99/month'
    },
    {
      name: 'Smart Recommendations',
      openSource: 'Not available',
      commercial: 'AI-powered product recommendations',
      price: '$79.99/month'
    },
    {
      name: 'Enterprise Auth',
      openSource: 'Basic OAuth',
      commercial: 'SAML + LDAP + SSO + MFA',
      price: '$99.99/month'
    }
  ]

  const saasServices = [
    {
      name: 'Smart Customer Service',
      description: 'AI-powered customer support with live chat',
      price: '$199/month',
      features: ['AI chatbot', 'Live chat', 'Ticket management', 'Knowledge base']
    },
    {
      name: 'Marketing Automation',
      description: 'Advanced marketing campaigns and automation',
      price: '$299/month',
      features: ['Campaign builder', 'A/B testing', 'Customer segmentation', 'Analytics']
    },
    {
      name: 'Supply Chain Management',
      description: 'Complete supply chain and inventory optimization',
      price: '$399/month',
      features: ['Inventory optimization', 'Supplier management', 'Demand forecasting', 'Reporting']
    },
    {
      name: 'Business Intelligence',
      description: 'Advanced analytics and business insights',
      price: '$499/month',
      features: ['Custom dashboards', 'Predictive analytics', 'Data visualization', 'API access']
    }
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{getText('tenant.businessModel.title', 'Jiffoo Mall Business Model')}</h1>
        <p className="text-lg text-gray-600 max-w-3xl">
          {getText('tenant.businessModel.subtitle', 'Open source core with commercial plugins and SaaS services. Start free, scale with your business needs.')}
        </p>
      </div>

      <Tabs defaultValue="pricing" className="space-y-8">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pricing">{getText('tenant.businessModel.tabs.pricing', 'Pricing Plans')}</TabsTrigger>
          <TabsTrigger value="plugins">{getText('tenant.businessModel.tabs.plugins', 'Plugin Comparison')}</TabsTrigger>
          <TabsTrigger value="saas">{getText('tenant.businessModel.tabs.saas', 'SaaS Services')}</TabsTrigger>
          <TabsTrigger value="roadmap">{getText('tenant.businessModel.tabs.roadmap', 'Roadmap')}</TabsTrigger>
        </TabsList>

        {/* Pricing Plans */}
        <TabsContent value="pricing" className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan) => {
              const IconComponent = plan.icon
              const isSelected = selectedPlan === plan.id
              
              return (
                <Card 
                  key={plan.id} 
                  className={`relative cursor-pointer transition-all ${
                    isSelected ? `ring-2 ring-blue-500 ${plan.borderColor}` : 'hover:shadow-lg'
                  }`}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className={`p-2 rounded-lg ${plan.bgColor}`}>
                        <IconComponent className={`w-6 h-6 ${plan.color}`} />
                      </div>
                      {plan.id === 'open-source' && (
                        <Badge className="bg-green-100 text-green-800">
                          <Gift className="w-3 h-3 mr-1" />
                          {getText('tenant.businessModel.free', 'Free')}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <div className="text-3xl font-bold text-gray-900">
                      {plan.price}
                      {plan.price !== 'Free' && <span className="text-sm font-normal text-gray-500">/month</span>}
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">{getText('tenant.businessModel.featuresIncluded', 'Features included:')}:</h4>
                        <ul className="space-y-2">
                          {plan.features.map((feature, index) => (
                            <li key={index} className="flex items-center text-sm">
                              <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {plan.limitations.length > 0 && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">{getText('tenant.businessModel.limitations', 'Limitations')}:</h4>
                          <ul className="space-y-2">
                            {plan.limitations.map((limitation, index) => (
                              <li key={index} className="flex items-center text-sm text-gray-600">
                                <X className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                                {limitation}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <Button
                        className="w-full mt-6"
                        variant={plan.id === 'open-source' ? 'outline' : 'default'}
                      >
                        {plan.id === 'open-source' ? getText('tenant.businessModel.getStartedFree', 'Get Started Free') : getText('tenant.businessModel.startTrial', 'Start Trial')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Plugin Comparison */}
        <TabsContent value="plugins" className="space-y-6">
          <div className="bg-white rounded-lg border">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">{getText('tenant.businessModel.pluginComparison', 'Plugin Feature Comparison')}</h3>
              <p className="text-gray-600">{getText('tenant.businessModel.pluginComparisonDesc', "See what's included in open source vs commercial versions")}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-4 font-medium">{getText('tenant.businessModel.plugin', 'Plugin')}</th>
                    <th className="text-left p-4 font-medium">{getText('tenant.businessModel.openSource', 'Open Source')}</th>
                    <th className="text-left p-4 font-medium">{getText('tenant.businessModel.commercial', 'Commercial')}</th>
                    <th className="text-left p-4 font-medium">{getText('tenant.businessModel.price', 'Price')}</th>
                  </tr>
                </thead>
                <tbody>
                  {plugins.map((plugin, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="p-4 font-medium">{plugin.name}</td>
                      <td className="p-4 text-gray-600">{plugin.openSource}</td>
                      <td className="p-4 text-green-600">{plugin.commercial}</td>
                      <td className="p-4">
                        <Badge variant="outline">{plugin.price}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* SaaS Services */}
        <TabsContent value="saas" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {saasServices.map((service, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                    <Badge className="bg-blue-100 text-blue-800">{service.price}</Badge>
                  </div>
                  <CardDescription>{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-4">
                    {service.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" variant="outline">
                    {getText('tenant.businessModel.learnMore', 'Learn More')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Roadmap */}
        <TabsContent value="roadmap" className="space-y-6">
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-semibold mb-4">{getText('tenant.businessModel.developmentRoadmap', 'Development Roadmap')}</h3>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">{getText('tenant.businessModel.phase1Title', 'Phase 1: Open Source Foundation (Completed)')}</h4>
                    <p className="text-gray-600">{getText('tenant.businessModel.phase1Desc', 'Core e-commerce functionality, plugin system, demo plugins')}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Settings className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">{getText('tenant.businessModel.phase2Title', 'Phase 2: Commercial Plugins (In Progress)')}</h4>
                    <p className="text-gray-600">{getText('tenant.businessModel.phase2Desc', 'Payment gateways, authentication providers, marketing tools')}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <Cloud className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">{getText('tenant.businessModel.phase3Title', 'Phase 3: SaaS Services (Q2 2024)')}</h4>
                    <p className="text-gray-600">{getText('tenant.businessModel.phase3Desc', 'Cloud-based services, AI features, advanced analytics')}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">{getText('tenant.businessModel.phase4Title', 'Phase 4: Enterprise Features (Q3 2024)')}</h4>
                    <p className="text-gray-600">{getText('tenant.businessModel.phase4Desc', 'Multi-tenant, white-label, enterprise security')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
