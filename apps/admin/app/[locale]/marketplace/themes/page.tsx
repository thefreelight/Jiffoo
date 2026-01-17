/**
 * Theme Marketplace List Page
 * 
 * Browse and filter available themes.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { 
  Search, 
  Palette, 
  Star, 
  Download,
  ChevronLeft,
  CheckCircle,
  Eye
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocale } from 'shared/src/i18n/react';
import { marketplaceApi, type ThemeItem } from '@/lib/marketplace-api';

// Theme card component
function ThemeCard({ theme }: { theme: ThemeItem }) {
  const locale = useLocale();

  return (
    <Link href={`/${locale}/marketplace/themes/${theme.slug}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full overflow-hidden">
        {/* Preview image */}
        <div className="aspect-video bg-gray-100 relative">
          {theme.screenshots && theme.screenshots[0] ? (
            <img 
              src={theme.screenshots[0]} 
              alt={theme.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Palette className="w-12 h-12 text-gray-300" />
            </div>
          )}
          {theme.previewUrl && (
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="bg-white/90">
                <Eye className="w-3 h-3 mr-1" />
                预览
              </Badge>
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-base truncate">{theme.name}</h3>
            {theme.developer?.verified && (
              <CheckCircle className="w-4 h-4 text-purple-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">
            {theme.shortDescription || theme.description}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500" />
                {theme.rating.toFixed(1)}
              </span>
              <span className="flex items-center gap-1">
                <Download className="w-4 h-4" />
                {theme.downloadCount.toLocaleString()}
              </span>
            </div>
            <Badge variant={theme.pricing.type === 'free' ? 'secondary' : 'default'}>
              {theme.pricing.type === 'free' ? '免费' : 
               theme.pricing.type === 'freemium' ? '免费增值' : 
               `$${theme.pricing.price}`}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ThemesListPage() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [style, setStyle] = useState(searchParams.get('style') || 'all');
  const [industry, setIndustry] = useState(searchParams.get('industry') || 'all');
  const [pricing, setPricing] = useState(searchParams.get('pricing') || 'all');
  const [sort, setSort] = useState<'popular' | 'newest' | 'rating'>(
    (searchParams.get('sort') as any) || 'popular'
  );
  const [page, setPage] = useState(1);

  // Fetch themes
  const { data, isLoading } = useQuery({
    queryKey: ['marketplace', 'themes', { search, style, industry, pricing, sort, page }],
    queryFn: async () => {
      const res = await marketplaceApi.themes.list({
        search: search || undefined,
        style: style !== 'all' ? style : undefined,
        industry: industry !== 'all' ? industry : undefined,
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
          <Palette className="w-7 h-7 text-purple-600" />
          主题市场
        </h1>
        <p className="text-gray-600 mt-1">
          发现精美的商城主题模板
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px] max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜索主题..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </form>

        <Select value={style} onValueChange={(v) => { setStyle(v); setPage(1); }}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="风格" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部风格</SelectItem>
            {data?.filters?.styles?.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={industry} onValueChange={(v) => { setIndustry(v); setPage(1); }}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="行业" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部行业</SelectItem>
            {data?.filters?.industries?.map((ind) => (
              <SelectItem key={ind} value={ind}>{ind}</SelectItem>
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto" />
            <p className="mt-2 text-gray-600">加载中...</p>
          </div>
        </div>
      ) : data?.themes && data.themes.length > 0 ? (
        <>
          <div className="text-sm text-gray-500">
            共 {data.pagination.total} 个主题
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.themes.map((theme) => (
              <ThemeCard key={theme.id} theme={theme} />
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
            <Palette className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无主题</h3>
            <p className="text-gray-500">没有找到符合条件的主题</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
