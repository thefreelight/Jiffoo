/**
 * Marketplace Homepage
 * 
 * Unified marketplace entry point showing plugins, themes, and official products.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { 
  Search, 
  Puzzle, 
  Palette, 
  Package, 
  Star, 
  TrendingUp, 
  Clock,
  ArrowRight,
  Download
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useT, useLocale } from 'shared/src/i18n/react';
import { marketplaceApi, type MarketplaceItem } from '@/lib/marketplace-api';

// Category card component
function CategoryCard({ 
  icon: Icon, 
  title, 
  description, 
  count, 
  href, 
  color 
}: { 
  icon: React.ElementType;
  title: string;
  description: string;
  count: number;
  href: string;
  color: string;
}) {
  const locale = useLocale();
  
  return (
    <Link href={`/${locale}${href}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </CardHeader>
        <CardContent>
          <CardTitle className="text-lg mb-1">{title}</CardTitle>
          <CardDescription className="mb-2">{description}</CardDescription>
          <Badge variant="secondary">{count} 个可用</Badge>
        </CardContent>
      </Card>
    </Link>
  );
}

// Item card component
function ItemCard({ item }: { item: MarketplaceItem }) {
  const locale = useLocale();
  const typeMap = {
    PLUGIN: { path: 'plugins', icon: Puzzle, color: 'bg-blue-500' },
    THEME: { path: 'themes', icon: Palette, color: 'bg-purple-500' },
    PRODUCT: { path: 'products', icon: Package, color: 'bg-green-500' },
  };
  const config = typeMap[item.type];
  const Icon = config.icon;

  return (
    <Link href={`/${locale}/marketplace/${config.path}/${item.slug}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.color} flex-shrink-0`}>
              {item.icon ? (
                <img src={item.icon} alt={item.name} className="w-6 h-6 rounded" />
              ) : (
                <Icon className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm truncate">{item.name}</h3>
              <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                {item.shortDescription || item.description}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500" />
                  {item.rating.toFixed(1)}
                </span>
                <span className="flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  {item.downloadCount}
                </span>
                <Badge variant={item.pricing.type === 'free' ? 'secondary' : 'default'} className="text-xs">
                  {item.pricing.type === 'free' ? '免费' : `$${item.pricing.price}`}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function MarketplacePage() {
  const t = useT();
  const locale = useLocale();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch homepage data
  const { data, isLoading } = useQuery({
    queryKey: ['marketplace', 'homepage'],
    queryFn: async () => {
      const res = await marketplaceApi.getHomepage();
      return res.data;
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/${locale}/marketplace/search?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  const categories = [
    {
      icon: Puzzle,
      title: '插件市场',
      description: '扩展商城功能的插件',
      count: data?.categories.find(c => c.type === 'plugin')?.count || 0,
      href: '/marketplace/plugins',
      color: 'bg-blue-500',
    },
    {
      icon: Palette,
      title: '主题市场',
      description: '精美的商城主题模板',
      count: data?.categories.find(c => c.type === 'theme')?.count || 0,
      href: '/marketplace/themes',
      color: 'bg-purple-500',
    },
    {
      icon: Package,
      title: '官方产品',
      description: 'Jiffoo 官方增值服务',
      count: data?.categories.find(c => c.type === 'product')?.count || 0,
      href: '/marketplace/products',
      color: 'bg-green-500',
    },
  ];

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

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">扩展市场</h1>
        <p className="text-gray-600 mb-6">
          发现插件、主题和官方产品，扩展您的商城功能
        </p>
        
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 max-w-md mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜索插件、主题、产品..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit">搜索</Button>
        </form>
      </div>

      {/* Categories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {categories.map((cat) => (
          <CategoryCard key={cat.href} {...cat} />
        ))}
      </div>

      {/* Featured */}
      {data?.featured && data.featured.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              <h2 className="text-xl font-semibold">精选推荐</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.featured.slice(0, 6).map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* Trending */}
      {data?.trending && data.trending.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              <h2 className="text-xl font-semibold">热门下载</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.trending.slice(0, 6).map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* New Arrivals */}
      {data?.newArrivals && data.newArrivals.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl font-semibold">最新上架</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.newArrivals.slice(0, 6).map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {!data?.featured?.length && !data?.trending?.length && !data?.newArrivals?.length && (
        <Card className="text-center py-12">
          <CardContent>
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">市场暂无内容</h3>
            <p className="text-gray-500">稍后再来看看，我们正在添加更多精彩内容</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
