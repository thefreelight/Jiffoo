'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Search, Globe, Wifi, ArrowRight, Cpu, Zap, Radio, Loader2 } from 'lucide-react';
import { productsApi, type Product } from '../../../lib/api';
import {
  getFirstImageUrl,
  YEVBI_SEARCH_FALLBACK_VISUAL,
} from '../../../lib/theme-assets';
import { Button } from '../../../ui/Button';
import { cn } from '../../../lib/utils';

export default function SearchPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'en';
  const query = searchParams.get('q') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(query);

  useEffect(() => {
    async function fetchProducts() {
      setIsLoading(true);
      try {
        const response = await productsApi.getProducts(1, 20, {}, locale);
        // Filter products by search query (client-side for demo)
        const filtered = query
          ? response.items.filter(
            (p) =>
              p.name.toLowerCase().includes(query.toLowerCase()) ||
              p.description?.toLowerCase().includes(query.toLowerCase())
          )
          : response.items;
        setProducts(filtered);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchProducts();
  }, [query, locale]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/${locale}/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const handleViewProduct = (id: string) => {
    router.push(`/${locale}/products/${id}`);
  };

  const getProductImage = (product: Product): string => {
    return getFirstImageUrl(product.images, YEVBI_SEARCH_FALLBACK_VISUAL);
  };

  return (
    <div className="min-h-screen bg-background pb-40 transition-colors duration-300">
      {/* Hero / Terminal Header */}
      <section className="py-12 px-4 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-foreground mb-2">
                <div className="w-10 h-10 rounded-none bg-muted flex items-center justify-center border border-border animate-pulse">
                  <Radio className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] italic leading-none">Scanning Data Network</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-black text-muted-foreground uppercase italic tracking-tighter leading-none">
                Neural Results
              </h1>
            </div>

            <div className="flex-1 max-w-xl w-full">
              <form onSubmit={handleSearch} className="relative group">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="INPUT COORDINATES..."
                  className="w-full h-20 pl-20 pr-32 bg-muted border-2 border-border rounded-none focus:outline-none focus:ring-4 focus:ring-border focus:border-border transition-all font-black uppercase italic tracking-widest placeholder:text-muted-foreground/50"
                />
                <div className="absolute inset-y-0 left-0 pl-8 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-foreground transition-colors">
                  <Search className="w-7 h-7" />
                </div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Button size="sm" type="submit" className="rounded-none h-12 px-6 font-black uppercase italic tracking-widest text-[10px]">
                    Search
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {query && (
            <div className="flex items-center gap-6 mb-12 px-8 py-4 bg-muted rounded-none border border-border w-fit">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">Target Archive: <span className="text-muted-foreground">"{query.toUpperCase()}"</span></span>
              <div className="w-1 h-4 bg-background rounded-none" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">Status:
                <span className={cn("ml-2", isLoading ? "text-foreground animate-pulse" : "text-muted-foreground")}>
                  {isLoading ? 'SEARCHING...' : `${products.length} ENTRIES LOCATED`}
                </span>
              </span>
            </div>
          )}

          {/* Results Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-muted rounded-none border border-border overflow-hidden animate-pulse p-4">
                  <div className="h-64 bg-background rounded-none mb-8" />
                  <div className="px-6 pb-10 space-y-6">
                    <div className="h-6 bg-background rounded-none w-3/4" />
                    <div className="h-4 bg-background rounded-none w-full" />
                    <div className="flex justify-between items-center pt-4">
                      <div className="h-8 bg-background rounded-none w-24" />
                      <div className="h-10 bg-background rounded-none w-28" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-40 bg-muted rounded-none border-2 border-dashed border-border group transition-colors">
              <div className="w-32 h-32 bg-background rounded-none flex items-center justify-center mx-auto mb-10 text-foreground group-hover:bg-muted group-hover:text-foreground transition-all duration-700 group-hover:rotate-12 border border-border">
                <Search className="w-16 h-16" />
              </div>
              <h3 className="text-4xl font-black text-muted-foreground uppercase italic tracking-tighter mb-4">Zero Matches Detected</h3>
              <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] italic text-xs mb-12">Target data does not exist in the current neural archive.</p>
              <Button
                variant="outline"
                onClick={() => router.push(`/${locale}/products`)}
                className="rounded-none h-20 px-12 font-black border-2 border-border hover:border-foreground hover:text-foreground transition-all uppercase italic tracking-widest text-sm"
              >
                Browse Global Catalog <ArrowRight className="w-5 h-5 ml-4" />
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-muted rounded-none border border-border overflow-hidden transition-all duration-500 hover:-translate-y-2 group cursor-pointer"
                  onClick={() => handleViewProduct(product.id)}
                >
                  <div className="relative h-64 overflow-hidden p-4">
                    <img
                      src={getProductImage(product)}
                      alt={product.name}
                      className="w-full h-full object-cover rounded-none group-hover:scale-110 transition-transform duration-1000"
                    />
                    <div className="absolute top-8 right-8 px-4 py-2 bg-background/20 backdrop-blur-md rounded-none border border-border">
                      <span className="text-[10px] font-black text-foreground uppercase tracking-widest italic">NEURAL LINK ACTIVE</span>
                    </div>
                  </div>

                  <div className="p-10 pt-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-1.5 h-6 bg-border rounded-none" />
                      <span className="text-[10px] font-black text-foreground uppercase tracking-[0.3em] italic">Archive Node {product.id.slice(0, 4).toUpperCase()}</span>
                    </div>

                    <h3 className="text-2xl font-black text-muted-foreground uppercase italic tracking-tighter mb-3 line-clamp-1 group-hover:text-foreground transition-colors">
                      {product.name}
                    </h3>

                    <p className="text-muted-foreground font-bold uppercase tracking-widest italic text-[10px] leading-relaxed mb-8 line-clamp-2">
                      {product.description}
                    </p>

                    <div className="flex justify-between items-center bg-background p-6 rounded-none group-hover:bg-muted transition-colors border border-border">
                      <div>
                        <span className="block text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1 italic">Activation Fee</span>
                        <span className="text-2xl font-black text-muted-foreground uppercase italic tracking-tighter">${product.price.toFixed(2)}</span>
                      </div>
                      <div className="w-12 h-12 bg-muted rounded-none flex items-center justify-center text-foreground border border-border group-hover:scale-110 transition-transform group-hover:bg-background group-hover:text-foreground group-hover:border-foreground">
                        <ArrowRight className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
