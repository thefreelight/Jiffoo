/**
 * Plugin Detail Page
 * 
 * Shows detailed information about a plugin and allows installation.
 */

'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Puzzle, 
  Star, 
  Download,
  ChevronLeft,
  CheckCircle,
  ExternalLink,
  Calendar,
  Tag,
  Shield,
  Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLocale } from 'shared/src/i18n/react';
import { marketplaceApi } from '@/lib/marketplace-api';
import { toast } from 'sonner';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function PluginDetailPage({ params }: PageProps) {
  const { slug } = use(params);
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [installing, setInstalling] = useState(false);

  // Fetch plugin details
  const { data: plugin, isLoading, error } = useQuery({
    queryKey: ['marketplace', 'plugin', slug],
    queryFn: async () => {
      const res = await marketplaceApi.plugins.getBySlug(slug);
      return res.data;
    },
  });

  // Install mutation
  const installMutation = useMutation({
    mutationFn: () => marketplaceApi.plugins.install(slug),
    onSuccess: () => {
      toast.success('插件安装成功');
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'plugin', slug] });
    },
    onError: (err: any) => {
      toast.error(err.message || '安装失败');
    },
  });

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await installMutation.mutateAsync();
    } finally {
      setInstalling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !plugin) {
    return (
      <div className="p-6">
        <Link href={`/${locale}/marketplace/plugins`}>
          <Button variant="ghost" size="sm">
            <ChevronLeft className="w-4 h-4 mr-1" />
            返回插件列表
          </Button>
        </Link>
        <Card className="text-center py-12 mt-6">
          <CardContent>
            <Puzzle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">插件不存在</h3>
            <p className="text-gray-500">找不到该插件，可能已被下架</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back button */}
      <Link href={`/${locale}/marketplace/plugins`}>
        <Button variant="ghost" size="sm">
          <ChevronLeft className="w-4 h-4 mr-1" />
          返回插件列表
        </Button>
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-20 h-20 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
          {plugin.icon ? (
            <img src={plugin.icon} alt={plugin.name} className="w-14 h-14 rounded-xl" />
          ) : (
            <Puzzle className="w-10 h-10 text-blue-600" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{plugin.name}</h1>
            {plugin.developer?.verified && (
              <CheckCircle className="w-5 h-5 text-blue-500" />
            )}
          </div>
          <p className="text-gray-600 mb-4">{plugin.description}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500" />
              {plugin.rating.toFixed(1)} ({plugin.reviewCount} 评价)
            </span>
            <span className="flex items-center gap-1">
              <Download className="w-4 h-4" />
              {plugin.downloadCount.toLocaleString()} 次下载
            </span>
            <span className="flex items-center gap-1">
              <Tag className="w-4 h-4" />
              v{plugin.latestVersion}
            </span>
            {plugin.category && (
              <Badge variant="outline">{plugin.category}</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <div className="text-2xl font-bold">
            {plugin.pricing.type === 'free' ? (
              <span className="text-green-600">免费</span>
            ) : plugin.pricing.type === 'freemium' ? (
              <span className="text-blue-600">免费增值</span>
            ) : (
              <span>${plugin.pricing.price}</span>
            )}
          </div>
          <Button 
            size="lg" 
            onClick={handleInstall}
            disabled={installing}
          >
            {installing ? '安装中...' : '安装插件'}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">概述</TabsTrigger>
              <TabsTrigger value="screenshots">截图</TabsTrigger>
              <TabsTrigger value="reviews">评价</TabsTrigger>
              <TabsTrigger value="changelog">更新日志</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <Card>
                <CardContent className="p-6 prose prose-sm max-w-none">
                  <p>{plugin.description}</p>
                  {plugin.compatibility && plugin.compatibility.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">兼容性</h4>
                      <div className="flex flex-wrap gap-2">
                        {plugin.compatibility.map((v) => (
                          <Badge key={v} variant="secondary">{v}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="screenshots" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  {plugin.screenshots && plugin.screenshots.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {plugin.screenshots.map((url, i) => (
                        <img 
                          key={i} 
                          src={url} 
                          alt={`Screenshot ${i + 1}`}
                          className="rounded-lg border"
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">暂无截图</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reviews" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-gray-500 text-center py-8">暂无评价</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="changelog" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-gray-500 text-center py-8">暂无更新日志</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Developer info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">开发者</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  {plugin.developer?.avatar ? (
                    <img 
                      src={plugin.developer.avatar} 
                      alt={plugin.developer.name}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <Users className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">{plugin.developer?.name || '未知'}</span>
                    {plugin.developer?.verified && (
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {plugin.developer?.itemCount || 0} 个作品
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">版本</span>
                <span>{plugin.latestVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">更新时间</span>
                <span>{new Date(plugin.updatedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">发布时间</span>
                <span>{new Date(plugin.createdAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
