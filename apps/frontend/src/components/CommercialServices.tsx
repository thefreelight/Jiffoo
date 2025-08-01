'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, Cloud, Shield, Download, Star, DollarSign } from 'lucide-react';

interface Plugin {
  id: string;
  name: string;
  description: string;
  price: number;
  rating: number;
  category: string;
}

interface SaaSService {
  id: string;
  name: string;
  description: string;
  plans: Array<{
    id: string;
    name: string;
    price: number;
    features: string[];
  }>;
}

/**
 * 商业服务组件
 * 使用预加密的服务器地址，开源用户可以访问但无法修改
 */
export default function CommercialServices() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [saasServices, setSaasServices] = useState<SaaSService[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('plugins');

  useEffect(() => {
    loadCommercialData();
  }, []);

  const loadCommercialData = async () => {
    try {
      setLoading(true);
      
      // 并行加载插件和 SaaS 服务
      const [pluginsResponse, saasResponse] = await Promise.all([
        fetch('/api/commercial/plugins/browse'),
        fetch('/api/commercial/saas/services')
      ]);

      if (pluginsResponse.ok) {
        const pluginsData = await pluginsResponse.json();
        setPlugins(pluginsData.plugins || []);
      }

      if (saasResponse.ok) {
        const saasData = await saasResponse.json();
        setSaasServices(saasData.services || []);
      }
    } catch (error) {
      console.error('Failed to load commercial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchasePlugin = async (plugin: Plugin) => {
    const email = prompt('请输入您的邮箱地址：');
    if (!email) return;

    const paymentToken = prompt('请输入支付令牌（完成支付后获得）：');
    if (!paymentToken) return;

    try {
      const response = await fetch('/api/commercial/plugins/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pluginId: plugin.id,
          userEmail: email,
          paymentToken: paymentToken
        })
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`插件购买成功！\n许可证密钥：${result.licenseKey}\n请保存好此密钥用于下载和激活插件。`);
      } else {
        alert(`购买失败：${result.error}`);
      }
    } catch (error) {
      alert('购买过程中发生错误，请稍后重试。');
    }
  };

  const handleSubscribeSaaS = async (service: SaaSService, planId: string) => {
    const email = prompt('请输入您的邮箱地址：');
    if (!email) return;

    const paymentToken = prompt('请输入支付令牌（完成支付后获得）：');
    if (!paymentToken) return;

    try {
      const response = await fetch('/api/commercial/saas/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId: service.id,
          planId: planId,
          userEmail: email,
          paymentToken: paymentToken
        })
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`SaaS 服务订阅成功！\n订阅ID：${result.subscriptionId}\n服务将在24小时内激活。`);
      } else {
        alert(`订阅失败：${result.error}`);
      }
    } catch (error) {
      alert('订阅过程中发生错误，请稍后重试。');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">加载商业服务中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Jiffoo 商业服务</h1>
        <p className="text-gray-600">
          扩展您的电商平台功能，获得专业级的商业服务支持
        </p>
        
        {/* 开源版本提示 */}
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-blue-800">开源版本用户</span>
          </div>
          <p className="text-sm text-blue-700 mt-1">
            您可以购买商业插件和订阅 SaaS 服务来增强平台功能。所有服务器连接都经过加密保护。
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="plugins">商业插件</TabsTrigger>
          <TabsTrigger value="saas">SaaS 服务</TabsTrigger>
        </TabsList>

        {/* 商业插件标签页 */}
        <TabsContent value="plugins" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plugins.map((plugin) => (
              <Card key={plugin.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{plugin.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {plugin.description}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">{plugin.category}</Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex-1">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                        <span className="text-sm">{plugin.rating}</span>
                      </div>
                      <div className="flex items-center gap-1 text-lg font-bold text-green-600">
                        <DollarSign className="h-5 w-5" />
                        <span>${plugin.price}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>

                <div className="p-6 pt-0">
                  <Button
                    onClick={() => handlePurchasePlugin(plugin)}
                    className="w-full"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    购买插件
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {plugins.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">暂无可用的商业插件</p>
            </div>
          )}
        </TabsContent>

        {/* SaaS 服务标签页 */}
        <TabsContent value="saas" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {saasServices.map((service) => (
              <Card key={service.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cloud className="h-5 w-5" />
                    {service.name}
                  </CardTitle>
                  <CardDescription>{service.description}</CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="space-y-4">
                    {service.plans.map((plan) => (
                      <div key={plan.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">{plan.name}</h4>
                          <div className="flex items-center gap-1 font-bold text-green-600">
                            <DollarSign className="h-4 w-4" />
                            <span>${plan.price}/月</span>
                          </div>
                        </div>
                        
                        <ul className="text-sm text-gray-600 space-y-1 mb-4">
                          {plan.features.map((feature, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                              {feature}
                            </li>
                          ))}
                        </ul>

                        <Button
                          onClick={() => handleSubscribeSaaS(service, plan.id)}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          订阅此计划
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {saasServices.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">暂无可用的 SaaS 服务</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
