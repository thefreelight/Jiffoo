/**
 * Theme Detail Page
 * 
 * Shows detailed information about a theme and allows installation/preview.
 */

'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Palette, 
  Star, 
  Download,
  ChevronLeft,
  CheckCircle,
  ExternalLink,
  Eye,
  Tag,
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

export default function ThemeDetailPage({ params }: PageProps) {
  const { slug } = use(params);
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [installing, setInstalling] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  // Fetch theme details
  const { data: theme, isLoading, error } = useQuery({
    queryKey: ['marketplace', 'theme', slug],
    queryFn: async () => {
      const res = await marketplaceApi.themes.getBySlug(slug);
      return res.data;
    },
  });

  // Install mutation
  const installMutation = useMutation({
    mutationFn: () => marketplaceApi.themes.install(slug),
    onSuccess: () => {
      toast.success('主题安装成功');
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'theme', slug] });
    },
    onError: (err: any) => {
      toast.error(err.message || '安装失败');
    },
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: () => marketplaceApi.themes.preview(slug),
    onSuccess: (data) => {
      if (data.data?.previewUrl) {
        window.open(data.data.previewUrl, '_blank');
      }
    },
    onError: (err: any) => {
      toast.error(err.message || '预览失败');
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto" />
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !theme) {
    return (
      <div className="p-6">
        <Link href={`/${locale}/marketplace/themes`}>
          <Button variant="ghost" size="sm">
            <ChevronLeft className="w-4 h-4 mr-1" />
            返回主题列表
          </Button>
        </Link>
        <Card className="text-center py-12 mt-6">
          <CardContent>
            <Palette className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">主题不存在</h3>
            <p className="text-gray-500">找不到该主题，可能已被下架</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back button */}
      <Link href={`/${locale}/marketplace/themes`}>
        <Button variant="ghost" size="sm">
          <ChevronLeft className="w-4 h-4 mr-1" />
          返回主题列表
        </Button>
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-20 h-20 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0">
          <Palette className="w-10 h-10 text-purple-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{theme.name}</h1>
            {theme.developer?.verified && (
              <CheckCircle className="w-5 h-5 text-purple-500" />
            )}
          </div>
          <p className="text-gray-600 mb-4">{theme.description}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500" />
              {theme.rating.toFixed(1)} ({theme.reviewCount} 评价)
            </span>
            <span className="flex items-center gap-1">
              <Download className="w-4 h-4" />
              {theme.downloadCount.toLocaleString()} 次下载
            </span>
            {theme.style && (
              <Badge variant="outline">{theme.style}</Badge>
            )}
            {theme.industries?.map((ind) => (
              <Badge key={ind} variant="secondary">{ind}</Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <div className="text-2xl font-bold">
            {theme.pricing.type === 'free' ? (
              <span className="text-green-600">免费</span>
            ) : theme.pricing.type === 'freemium' ? (
              <span className="text-purple-600">免费增值</span>
            ) : (
              <span>${theme.pricing.price}</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => previewMutation.mutate()}
              disabled={previewMutation.isPending}
            >
              <Eye className="w-4 h-4 mr-2" />
              预览
            </Button>
            <Button 
              onClick={handleInstall}
              disabled={installing}
            >
              {installing ? '安装中...' : '安装主题'}
            </Button>
          </div>
        </div>
      </div>

      {/* Screenshots */}
      {theme.screenshots && theme.screenshots.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden mb-4">
              <img 
                src={theme.screenshots[selectedImage]} 
                alt={`${theme.name} screenshot`}
                className="w-full h-full object-cover"
              />
            </div>
            {theme.screenshots.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {theme.screenshots.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      selectedImage === i ? 'border-purple-500' : 'border-transparent'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
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
              <TabsTrigger value="features">功能特点</TabsTrigger>
              <TabsTrigger value="reviews">评价</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <Card>
                <CardContent className="p-6 prose prose-sm max-w-none">
                  <p>{theme.description}</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="features" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-gray-500 text-center py-8">功能特点即将推出</p>
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
                  {theme.developer?.avatar ? (
                    <img 
                      src={theme.developer.avatar} 
                      alt={theme.developer.name}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <Users className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">{theme.developer?.name || '未知'}</span>
                    {theme.developer?.verified && (
                      <CheckCircle className="w-4 h-4 text-purple-500" />
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {theme.developer?.itemCount || 0} 个作品
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
                <span className="text-gray-500">更新时间</span>
                <span>{new Date(theme.updatedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">发布时间</span>
                <span>{new Date(theme.createdAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
