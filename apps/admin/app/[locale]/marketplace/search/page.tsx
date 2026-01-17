/**
 * Marketplace Search Results Page
 * 
 * Shows unified search results across plugins, themes, and products.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Search, 
  Puzzle, 
  Palette, 
  Package, 
  Star, 
  Download,
  ChevronLeft,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLocale } from 'shared/src/i18n/react';
import { marketplaceApi, type MarketplaceItem } from '@/lib/marketplace-api';

// Generic item card
function ItemCard({ item }: { item: MarketplaceItem }) {
  const locale = useLocale();
  const typeConfig = {
    PLUGIN: { path: 'plugins', icon: Puzzle, color: 'bg-blue-500', label: '插件' },
    THEME: { path: 'themes', icon: Palette, color: 'bg-purple-500', label: '主题' },
    PRODUCT: { path: 'products', icon: Package, color: 'bg-green-500', label: '产品' },
  };
  const config = typeConfig[item.type];
  const Icon = config.icon;

  return (
    <Link href={`/${locale}/marketplace/${config.path}/${item.slug}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl ${config.color} flex items-center justify-center flex-shrink-0`}>
              {item.icon ? (
                <img src={item.icon} alt={item.name} className="w-8 h-8 rounded-lg" />
              ) : (
                <Icon className="w-6 h-6 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold truncate">{item.name}</h3>
                <Badge variant="outline" className="text-xs">{config.label}</Badge>
              </div>
              <p className="text-sm text-gray-500 line-clamp-2">
                {item.shortDescription || item.description}
              </p>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500" />
                  {item.rating.toFixed(1)}
                </span>
                <span className="flex items-center gap-1">
                  <Download className="w-4 h-4" />
                  {item.downloadCount.toLocaleString()}
                </span>
                <Badge variant={item.pricing.type === 'free' ? 'secondary' : 'default'}>
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

// Section component
function ResultSection({ 
  title, 
  icon: Icon, 
  items, 
  color,
  emptyText 
}: { 
  title: string;
  icon: React.ElementType;
  items: MarketplaceItem[];
  color: string;
  emptyText: string;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Icon className={`w-8 h-8 mx-auto mb-2 ${color}`} />
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${color}`} />
        <h3 className="font-semibold">{title}</h3>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

export default function SearchPage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState('all');

  // Fetch search results
  const { data, isLoading } = useQuery({
    queryKey: ['marketplace', 'search', searchTerm],
    queryFn: async () => {
      if (!searchTerm) return null;
      const res = await marketplaceApi.search({ q: searchTerm });
      return res.data;
    },
    enabled: !!searchTerm,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchTerm(query.trim());
      router.push(`/${locale}/marketplace/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  // Update query when URL changes
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      setSearchTerm(q);
    }
  }, [searchParams]);

  const allItems = [
    ...(data?.plugins || []),
    ...(data?.themes || []),
    ...(data?.products || []),
  ];

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
          <Search className="w-7 h-7 text-gray-600" />
          搜索结果
        </h1>
        {searchTerm && (
          <p className="text-gray-600 mt-1">
            搜索 "{searchTerm}" 的结果
          </p>
        )}
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜索插件、主题、产品..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit">搜索</Button>
      </form>

      {/* Results */}
      {!searchTerm ? (
        <Card className="text-center py-12">
          <CardContent>
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">输入关键词开始搜索</h3>
            <p className="text-gray-500">搜索插件、主题或官方产品</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-2 text-gray-600">搜索中...</p>
          </div>
        </div>
      ) : data && data.total > 0 ? (
        <div className="space-y-6">
          <div className="text-sm text-gray-500">
            共找到 {data.total} 个结果
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">
                全部 ({data.total})
              </TabsTrigger>
              <TabsTrigger value="plugins">
                插件 ({data.plugins.length})
              </TabsTrigger>
              <TabsTrigger value="themes">
                主题 ({data.themes.length})
              </TabsTrigger>
              <TabsTrigger value="products">
                产品 ({data.products.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6 space-y-8">
              {data.plugins.length > 0 && (
                <ResultSection
                  title="插件"
                  icon={Puzzle}
                  items={data.plugins}
                  color="text-blue-600"
                  emptyText="没有找到相关插件"
                />
              )}
              {data.themes.length > 0 && (
                <ResultSection
                  title="主题"
                  icon={Palette}
                  items={data.themes}
                  color="text-purple-600"
                  emptyText="没有找到相关主题"
                />
              )}
              {data.products.length > 0 && (
                <ResultSection
                  title="官方产品"
                  icon={Package}
                  items={data.products}
                  color="text-green-600"
                  emptyText="没有找到相关产品"
                />
              )}
            </TabsContent>

            <TabsContent value="plugins" className="mt-6">
              <ResultSection
                title="插件"
                icon={Puzzle}
                items={data.plugins}
                color="text-blue-600"
                emptyText="没有找到相关插件"
              />
            </TabsContent>

            <TabsContent value="themes" className="mt-6">
              <ResultSection
                title="主题"
                icon={Palette}
                items={data.themes}
                color="text-purple-600"
                emptyText="没有找到相关主题"
              />
            </TabsContent>

            <TabsContent value="products" className="mt-6">
              <ResultSection
                title="官方产品"
                icon={Package}
                items={data.products}
                color="text-green-600"
                emptyText="没有找到相关产品"
              />
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">没有找到结果</h3>
            <p className="text-gray-500">尝试使用其他关键词搜索</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
