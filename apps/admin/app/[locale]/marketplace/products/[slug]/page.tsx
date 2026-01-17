/**
 * Product Detail Page
 * 
 * Shows detailed information about an official product and allows purchase.
 */

'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Package, 
  Star, 
  ChevronLeft,
  CheckCircle,
  Shield,
  Zap,
  HeadphonesIcon,
  Key
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useLocale } from 'shared/src/i18n/react';
import { marketplaceApi } from '@/lib/marketplace-api';
import { toast } from 'sonner';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function ProductDetailPage({ params }: PageProps) {
  const { slug } = use(params);
  const locale = useLocale();
  const [purchasing, setPurchasing] = useState(false);
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [domain, setDomain] = useState('');

  // Fetch product details
  const { data: product, isLoading, error } = useQuery({
    queryKey: ['marketplace', 'product', slug],
    queryFn: async () => {
      const res = await marketplaceApi.products.getBySlug(slug);
      return res.data;
    },
  });

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: () => marketplaceApi.products.purchase(slug, {
      paymentMethod: 'stripe',
    }),
    onSuccess: (data) => {
      if (data.data?.checkoutUrl) {
        window.location.href = data.data.checkoutUrl;
      } else {
        toast.success('购买成功');
      }
    },
    onError: (err: any) => {
      toast.error(err.message || '购买失败');
    },
  });

  // Activate mutation
  const activateMutation = useMutation({
    mutationFn: () => marketplaceApi.products.activate(slug, {
      licenseKey,
      domain: domain || undefined,
    }),
    onSuccess: () => {
      toast.success('许可证激活成功');
      setShowActivateDialog(false);
      setLicenseKey('');
      setDomain('');
    },
    onError: (err: any) => {
      toast.error(err.message || '激活失败');
    },
  });

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      await purchaseMutation.mutateAsync();
    } finally {
      setPurchasing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" />
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-6">
        <Link href={`/${locale}/marketplace/products`}>
          <Button variant="ghost" size="sm">
            <ChevronLeft className="w-4 h-4 mr-1" />
            返回产品列表
          </Button>
        </Link>
        <Card className="text-center py-12 mt-6">
          <CardContent>
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">产品不存在</h3>
            <p className="text-gray-500">找不到该产品，可能已被下架</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back button */}
      <Link href={`/${locale}/marketplace/products`}>
        <Button variant="ghost" size="sm">
          <ChevronLeft className="w-4 h-4 mr-1" />
          返回产品列表
        </Button>
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-20 h-20 rounded-2xl bg-green-100 flex items-center justify-center flex-shrink-0">
          {product.icon ? (
            <img src={product.icon} alt={product.name} className="w-14 h-14 rounded-xl" />
          ) : (
            <Package className="w-10 h-10 text-green-600" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            <Badge className="bg-green-100 text-green-800">官方</Badge>
          </div>
          <p className="text-gray-600 mb-4">{product.description}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500" />
              {product.rating.toFixed(1)} ({product.reviewCount} 评价)
            </span>
            {product.category && (
              <Badge variant="outline">{product.category}</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <div className="text-3xl font-bold text-green-600">
            {product.pricing.type === 'free' ? '免费' : `$${product.pricing.price}`}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setShowActivateDialog(true)}
            >
              <Key className="w-4 h-4 mr-2" />
              激活许可证
            </Button>
            <Button 
              size="lg"
              onClick={handlePurchase}
              disabled={purchasing || product.pricing.type === 'free'}
            >
              {purchasing ? '处理中...' : product.pricing.type === 'free' ? '免费获取' : '立即购买'}
            </Button>
          </div>
        </div>
      </div>

      {/* Highlights */}
      {product.highlights && product.highlights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>产品亮点</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {product.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">概述</TabsTrigger>
              <TabsTrigger value="features">功能详情</TabsTrigger>
              <TabsTrigger value="faq">常见问题</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <Card>
                <CardContent className="p-6 prose prose-sm max-w-none">
                  <p>{product.description}</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="features" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-gray-500 text-center py-8">功能详情即将推出</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="faq" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-gray-500 text-center py-8">常见问题即将推出</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Benefits */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">购买权益</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div>
                  <div className="font-medium text-sm">安全保障</div>
                  <div className="text-xs text-gray-500">官方正版，安全可靠</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <div>
                  <div className="font-medium text-sm">持续更新</div>
                  <div className="text-xs text-gray-500">免费获取后续更新</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <HeadphonesIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div>
                  <div className="font-medium text-sm">技术支持</div>
                  <div className="text-xs text-gray-500">专业团队提供支持</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">产品信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">发布商</span>
                <span>Jiffoo 官方</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">更新时间</span>
                <span>{new Date(product.updatedAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Activate License Dialog */}
      <Dialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>激活许可证</DialogTitle>
            <DialogDescription>
              输入您的许可证密钥来激活产品
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="licenseKey">许可证密钥</Label>
              <Input
                id="licenseKey"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">域名（可选）</Label>
              <Input
                id="domain"
                placeholder="example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                如果您的许可证绑定了特定域名，请在此输入
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActivateDialog(false)}>
              取消
            </Button>
            <Button 
              onClick={() => activateMutation.mutate()}
              disabled={!licenseKey || activateMutation.isPending}
            >
              {activateMutation.isPending ? '激活中...' : '激活'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
