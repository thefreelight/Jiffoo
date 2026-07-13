'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Zap,
  Wifi,
  Calendar,
  X,
} from 'lucide-react';
import { productsApi, cartApi, authApi, type Product, type Category, type ProductFilters } from '../../../lib/api';
import { cn } from '../../../lib/utils';

const readTypeDataValue = (typeData: Product['typeData'], keys: string[]): string | null => {
  if (!typeData || typeof typeData !== 'object') return null;
  for (const key of keys) {
    const value = (typeData as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  return null;
};

function ProductsContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'en';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [sortBy, setSortBy] = useState('price-low');
  const [currentPage, setCurrentPage] = useState(() => {
    const pageParam = searchParams.get('page');
    return pageParam ? parseInt(pageParam, 10) : 1;
  });
  const [totalPages, setTotalPages] = useState(1);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const categoryList = await productsApi.getCategories();
        setCategories(categoryList);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    }
    fetchCategories();
  }, []);

  useEffect(() => {
    async function fetchProducts() {
      setIsLoading(true);
      setError(null);
      try {
        const filters: ProductFilters = {};
        if (searchTerm.trim()) {
          filters.search = searchTerm.trim();
        }
        if (selectedCategoryId !== 'all') {
          filters.category = selectedCategoryId;
        }
        if (sortBy === 'price-low') {
          filters.sortBy = 'price';
          filters.sortOrder = 'asc';
        } else if (sortBy === 'price-high') {
          filters.sortBy = 'price';
          filters.sortOrder = 'desc';
        } else {
          filters.sortBy = 'createdAt';
          filters.sortOrder = 'desc';
        }

        const response = await productsApi.getProducts(currentPage, 12, filters, locale);
        const sortedItems = [...response.items];
        if (sortBy === 'price-low') {
          sortedItems.sort((a, b) => a.price - b.price);
        } else if (sortBy === 'price-high') {
          sortedItems.sort((a, b) => b.price - a.price);
        }
        setProducts(sortedItems);
        setTotalPages(response.totalPages);
      } catch (err) {
        console.error('Failed to fetch products:', err);
        setError(err instanceof Error ? err.message : 'Failed to load products');
      } finally {
        setIsLoading(false);
      }
    }
    fetchProducts();
  }, [currentPage, locale, searchTerm, selectedCategoryId, sortBy]);

  const handleViewProduct = (id: string) => {
    router.push(`/${locale}/products/${id}?page=${currentPage}`);
  };

  const handleAddToCart = async (productId: string) => {
    if (!authApi.isAuthenticated()) {
      router.push(`/${locale}/auth/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const product = products.find((item) => item.id === productId);
    if (!product) {
      return;
    }
    const stockValue = (product as any).stock ?? product.inventory?.available ?? 0;
    if (product.inventory?.isInStock === false || stockValue <= 0) {
      return;
    }
    const variantId = product.variants?.find((variant) => variant.isActive && variant.baseStock > 0)?.id
      ?? product.variants?.find((variant) => variant.isActive)?.id;
    setAddingToCart(productId);
    try {
      await cartApi.addToCart(productId, 1, variantId);
      // Trigger cart update event
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err) {
      console.error('Failed to add to cart:', err);
    } finally {
      setAddingToCart(null);
    }
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setCurrentPage(1);
    setSearchTerm(searchDraft);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">[ Loading... ]</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card p-8 border border-border text-center">
          <X className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-mono text-sm mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 border border-border bg-primary text-primary-foreground font-mono text-xs uppercase tracking-widest hover:bg-transparent hover:text-foreground transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="network-grid-bg"></div>
      {/* Filter Bar */}
      <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 lg:px-8 py-3">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 flex-wrap">
            <input
              type="text"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search plans..."
              className="h-10 min-w-[220px] flex-1 bg-background border border-border text-foreground font-mono text-xs px-3 outline-none focus:border-foreground"
            />
            <button
              type="submit"
              className="h-10 px-4 border border-border bg-primary text-primary-foreground font-mono text-xs uppercase tracking-widest hover:bg-muted hover:text-foreground transition-all"
            >
              Search
            </button>

            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 bg-background border border-border text-muted-foreground font-mono text-xs uppercase px-3 outline-none hover:border-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest hidden sm:block">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 bg-background border border-border text-muted-foreground font-mono text-xs uppercase px-3 outline-none hover:border-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <option value="price-low">Price: Low → High</option>
                <option value="price-high">Price: High → Low</option>
                <option value="newest">Newest</option>
              </select>
            </div>

            <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-widest pl-2 border-l border-border">
              {products.length} Plans
            </span>
          </form>
        </div>
      </div>

      {/* Product Grid */}
      <div className="container mx-auto px-4 lg:px-8 py-6 relative z-10">
        {products.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-border">
            <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">[ No plans match current filters ]</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-border">
              {products.map((product) => {
                const stockValue = (product as any).stock ?? product.inventory?.available ?? 0;
                const isOutOfStock = product.inventory?.isInStock === false || stockValue <= 0;
                const isAdding = addingToCart === product.id;
                const hasDiscount = product.originalPrice && product.originalPrice > product.price;
                const dataSize = readTypeDataValue(product.typeData, ['dataSize', 'datasize']) || '—';
                const sourceProductType = readTypeDataValue(product.typeData, ['sourceProductType']) || '—';
                const network = '4G/5G';

                return (
                  <div
                    key={product.id}
                    onClick={() => handleViewProduct(product.id)}
                    className="bg-background p-5 flex flex-col gap-4 cursor-pointer hover:bg-accent transition-colors group"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">
                          {(product as any).category || 'eSIM'}
                        </p>
                        <h3 className="font-bold text-sm text-foreground uppercase leading-tight truncate">
                          {product.name}
                        </h3>
                      </div>
                    </div>

                    {/* Specs Row */}
                    <div className="grid grid-cols-3 gap-3 py-3 border-t border-b border-border">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                          <Wifi className="w-2.5 h-2.5" /> Data
                        </span>
                        <span className="font-mono text-sm font-bold text-foreground leading-none">
                          {dataSize}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" /> Valid
                        </span>
                        <span className="font-mono text-sm font-bold text-foreground leading-none">
                          {sourceProductType}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest">Network</span>
                        <span className="font-mono text-sm font-bold text-foreground leading-none">{network}</span>
                      </div>
                    </div>

                    {/* Price + Action */}
                    <div className="flex items-end justify-between mt-auto">
                      <div>
                        <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Price</p>
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-2xl font-bold text-foreground leading-none">
                            ${product.price.toFixed(2)}
                          </span>
                          {hasDiscount && (
                            <span className="font-mono text-xs text-muted-foreground line-through">
                              ${product.originalPrice?.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isOutOfStock || isAdding) return;
                          void handleAddToCart(product.id);
                        }}
                        aria-disabled={isOutOfStock || isAdding}
                        className={cn(
                          "font-mono text-xs uppercase tracking-widest px-4 py-2 border transition-all",
                          isOutOfStock
                            ? "border-border text-muted-foreground cursor-not-allowed"
                            : "border-border bg-primary text-primary-foreground hover:bg-transparent hover:text-foreground flex items-center gap-1.5"
                        )}
                      >
                        {isAdding ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : isOutOfStock ? (
                          'Sold Out'
                        ) : (
                          <>Get<Zap className="w-3 h-3 fill-current" /></>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-1.5 mt-8">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-9 h-9 border border-border flex items-center justify-center text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                    className={cn(
                      "w-9 h-9 border font-mono text-xs transition-all",
                      currentPage === i + 1
                        ? "border-border bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                    )}
                  >
                    {i + 1}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-9 h-9 border border-border flex items-center justify-center text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
      </div>
    }>
      <ProductsContent />
    </Suspense>
  );
}
