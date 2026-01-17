/**
 * Official Products List Page
 * 
 * Browse Jiffoo official products and services.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { 
  Package, 
  Star, 
  ChevronLeft,
  CheckCircle,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocale } from 'shared/src/i18n/react';
import { marketplaceApi, type ProductItem } from '@/lib/marketplace-api';

// Product card component
function ProductCard({ product }: { product: ProductItem }) {
  const locale = useLocale();

  return (
    <Link href={`/${locale}/marketplace/products/${product.slug}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center">
              {product.icon ? (
                <img src={product.icon} alt={product.name} className="w-10 h-10 rounded-lg" />
              ) : (
                <Package className="w-7 h-7 text-green-600" />
              )}
            </div>
            {product.featured && (
              <Badge className="bg-yellow-100 text-yellow-800">
                <Sparkles className="w-3 h-3 mr-1" />
                推荐
              </Badge>
            )}
          </div>
          <CardTitle className="text-lg mt-3">{product.name}</CardTitle>
          <CardDescription className="line-clamp-2">
            {product.shortDescription || product.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Highlights */}
          {product.highlights && product.highlights.length > 0 && (
            <ul className="space-y-1 mb-4">
              {product.highlights.slice(0, 3).map((h, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="truncate">{h}</span>
                </li>
              ))}
            </ul>
          )}
          
          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Star className="w-4 h-4 text-yellow-500" />
              {product.rating.toFixed(1)}
            </div>
            <div className="text-lg font-bold text-green-600">
              {product.pricing.type === 'free' ? '免费' : `$${product.pricing.price}`}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ProductsListPage() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [page, setPage] = useState(1);

  // Fetch products
  const { data, isLoading } = useQuery({
    queryKey: ['marketplace', 'products', { category, page }],
    queryFn: async () => {
      const res = await marketplaceApi.products.list({
        category: category !== 'all' ? category : undefined,
        page,
        limit: 12,
      });
      return res.data;
    },
  });

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
          <Package className="w-7 h-7 text-green-600" />
          官方产品
        </h1>
        <p className="text-gray-600 mt-1">
          Jiffoo 官方增值服务和解决方案
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            {data?.filters?.categories?.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" />
            <p className="mt-2 text-gray-600">加载中...</p>
          </div>
        </div>
      ) : data?.products && data.products.length > 0 ? (
        <>
          <div className="text-sm text-gray-500">
            共 {data.pagination.total} 个产品
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.products.map((product) => (
              <ProductCard key={product.id} product={product} />
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
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无产品</h3>
            <p className="text-gray-500">官方产品即将上线，敬请期待</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
