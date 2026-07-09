'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProductsPage as ProductsCatalogPage } from '../../../components/ProductsPage';
import { productsApi, cartApi, authApi, type Product } from '../../../lib/api';

export default function ProductsPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('price_asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  useEffect(() => {
    async function fetchProducts() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await productsApi.getProducts(currentPage, 12, {}, locale);
        setProducts(response.items);
        setTotalPages(response.totalPages);
        setTotalProducts(response.total);
      } catch (err) {
        console.error('Failed to fetch products:', err);
        setError(err instanceof Error ? err.message : 'Failed to load products');
      } finally {
        setIsLoading(false);
      }
    }

    fetchProducts();
  }, [currentPage, locale]);

  const handleProductClick = (productId: string) => {
    router.push(`/${locale}/products/${productId}`);
  };

  const handleAddToCart = async (productId: string) => {
    if (!authApi.isAuthenticated()) {
      router.push(`/${locale}/auth/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    try {
      await cartApi.addToCart(productId, 1);
    } catch (err) {
      console.error('Failed to add to cart:', err);
    }
  };

  if (error) {
    return (
      <div className="esim-shell min-h-screen px-5 pb-20 pt-32">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-[var(--esim-line)] bg-[var(--esim-surface-raised)] p-8 text-center shadow-[var(--esim-shadow-tight)]">
          <p className="esim-kicker mb-4">Catalog unavailable</p>
          <h1 className="text-4xl font-semibold text-[var(--esim-ink)]">We could not load eSIM plans.</h1>
          <p className="mt-4 text-[var(--esim-muted)]">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-full bg-[var(--esim-ink)] px-6 py-3 text-sm font-extrabold text-[var(--esim-surface-raised)] transition hover:bg-[var(--esim-primary-dark)]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <ProductsCatalogPage
      products={products as any}
      isLoading={isLoading}
      totalProducts={totalProducts}
      currentPage={currentPage}
      totalPages={totalPages}
      sortBy={sortBy}
      viewMode={viewMode}
      onSortChange={setSortBy}
      onViewModeChange={setViewMode}
      onPageChange={setCurrentPage}
      onAddToCart={handleAddToCart}
      onProductClick={handleProductClick}
    />
  );
}
