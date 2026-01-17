/**
 * Plugin Marketplace List Page
 * 
 * Browse and filter available plugins.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { 
  Search, 
  Puzzle, 
  Star, 
  Download,
  Filter,
  ChevronLeft,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocale } from 'shared/src/i18n/react';
import { marketplaceApi, type PluginItem } from '@/lib/marketplace-api';

// Plugin card component
function PluginCard({ plugin }: { plugin: PluginItem }) {
  const locale = useLocale();

  return (
    <Link href={`/${locale}/marketplace/plugins/${plugin.slug}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              {plugin.icon ? (
                <img src={plugin.icon} alt={plugin.name} className="w-10 h-10 rounded-lg" />
              ) : (
                <Puzzle className="w-7 h-7 text-blue-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base truncate">{plugin.name}</h3>
                {plugin.developer?.verified && (
                  <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                )}
              </div>
              <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                {plugin.shortDescription || plugin.description}
              </p>
              <div className="flex items-center gap-4 mt-3">
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <Star className="w-4 h-4 text-yellow-500" />
                  {plugin.rating.toFixed(1)} ({plugin.reviewCount})
                </span>
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <Download className="w-4 h-4" />
                  {plugin.downloadCount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-400">
                  {plugin.developer?.name || '未知开发者'}
                </span>
                <Badge variant={plugin.pricing.type === 'free' ? 'secondary' : 'default'}>
                  {plugin.pricing.type === 'free' ? '免费' : 
                   plugin.pricing.type === 'freemium' ? '免费增值' : 
                   `$${plugin.pricing.price}`}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function PluginsListPage() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [pricing, setPricing] = useState(searchParams.get('pricing') || 'all');
  const [sort, setSort] = useState<'popular' | 'newest' | 'rating'>(
    (searchParams.get('sort') as any) || 'popular'
  );
  const [page, setPage] = useState(1);

  // Fetch plugins
  const { data, isLoading } = useQuery({
    queryKey: ['marketplace', 'plugins', { search, category, pricing, sort, page }],
    queryFn: async () => {
      const res = await marketplaceApi.plugins.list({
        search: search || undefined,
        category: category !== 'all' ? category : undefined,
        pricing: pricing !== 'all' ? pricing as any : undefined,
        sort,
        page,
        limit: 12,
      });
      return res.data;
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/${locale}/marketplace`}>
          <Button variant="ghost" size="sm">
            <ChevronLeft className="w-4 h-4 mr-1" />
            返回市场
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Puzzle className="w-7 h-7 text-blue-600" />
          插件市场
        </h1>
        <p className="text-gray-600 mt-1">
          发现并安装扩展商城功能的插件
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px] max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜索插件..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </form>

        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            {data?.filters?.categories?.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={pricing} onValueChange={(v) => { setPricing(v); setPage(1); }}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="价格" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="free">免费</SelectItem>
            <SelectItem value="freemium">免费增值</SelectItem>
            <SelectItem value="paid">付费</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => { setSort(v as any); setPage(1); }}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="排序" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">最热门</SelectItem>
            <SelectItem value="newest">最新</SelectItem>
            <SelectItem value="rating">评分最高</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-2 text-gray-600">加载中...</p>
          </div>
        </div>
      ) : data?.plugins && data.plugins.length > 0 ? (
        <>
          <div className="text-sm text-gray-500">
            共 {data.pagination.total} 个插件
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.plugins.map((plugin) => (
              <PluginCard key={plugin.id} plugin={plugin} />
            ))}
          </div>

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                上一页
              </Button>
              <span className="flex items-center px-4 text-sm text-gray-600">
                {page} / {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <Puzzle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无插件</h3>
            <p className="text-gray-500">没有找到符合条件的插件</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
