'use client';

/**
 * Product Grid Block
 *
 * A responsive grid of product cards.
 * This is a built-in block that Theme Packs can use in their templates.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { BlockComponentProps } from '../types';

interface ProductGridSettings {
  /** Section title */
  title?: string;
  /** Number of columns (1-6) */
  columns?: number;
  /** Maximum number of products to display */
  limit?: number;
  /** Gap size: 'sm' | 'md' | 'lg' */
  gap?: 'sm' | 'md' | 'lg';
  /** Whether to show the section title */
  showTitle?: boolean;
  /** Filter by category slug */
  category?: string;
  /** Sort by: 'newest' | 'price-asc' | 'price-desc' | 'popular' */
  sortBy?: 'newest' | 'price-asc' | 'price-desc' | 'popular';
  /** Show "View All" link */
  showViewAll?: boolean;
  /** Custom view all link */
  viewAllLink?: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  images: Array<{ url: string; alt?: string }>;
  category?: { name: string };
}

export function ProductGridBlock({ settings, themeConfig, blockId }: BlockComponentProps) {
  const gridSettings = settings as ProductGridSettings;
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const {
    title = 'Featured Products',
    columns = 4,
    limit = 8,
    gap = 'md',
    showTitle = true,
    category = '',
    sortBy = 'newest',
    showViewAll = true,
    viewAllLink = '/products',
  } = gridSettings;

  // Fetch products
  useEffect(() => {
    let mounted = true;

    async function fetchProducts() {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        params.set('limit', String(limit));
        if (category) params.set('category', category);

        // Map sortBy to API params
        switch (sortBy) {
          case 'price-asc':
            params.set('sortBy', 'price');
            params.set('sortOrder', 'asc');
            break;
          case 'price-desc':
            params.set('sortBy', 'price');
            params.set('sortOrder', 'desc');
            break;
          case 'popular':
            params.set('sortBy', 'popularity');
            break;
          default:
            params.set('sortBy', 'createdAt');
            params.set('sortOrder', 'desc');
        }

        const response = await fetch(`/api/products?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch products');

        const data = await response.json();
        if (mounted) {
          setProducts(data.data?.items || data.items || []);
        }
      } catch (error) {
        console.error('[ProductGridBlock] Error fetching products:', error);
        if (mounted) setProducts([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    fetchProducts();

    return () => {
      mounted = false;
    };
  }, [limit, category, sortBy]);

  // Gap classes
  const gapClasses: Record<string, string> = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };

  // Column classes (responsive)
  const getColumnClasses = (cols: number): string => {
    const colMap: Record<number, string> = {
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
      5: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
      6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
    };
    return colMap[cols] || colMap[4];
  };

  const primaryColor = themeConfig?.colors?.primary || 'var(--theme-color-primary, #2563eb)';

  return (
    <section id={blockId} className="py-12 px-4">
      <div className="container mx-auto">
        {/* Header */}
        {showTitle && (
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold">{title}</h2>
            {showViewAll && (
              <Link
                href={viewAllLink}
                className="text-sm font-medium hover:underline"
                style={{ color: primaryColor }}
              >
                View All →
              </Link>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className={`grid ${getColumnClasses(columns)} ${gapClasses[gap]}`}>
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-lg mb-3" />
                <div className="h-4 bg-gray-200 rounded mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Products Grid */}
        {!isLoading && products.length > 0 && (
          <div className={`grid ${getColumnClasses(columns)} ${gapClasses[gap]}`}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                primaryColor={primaryColor}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && products.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No products found</p>
          </div>
        )}
      </div>
    </section>
  );
}

interface ProductCardProps {
  product: Product;
  primaryColor: string;
}

function ProductCard({ product, primaryColor }: ProductCardProps) {
  const imageUrl = product.images?.[0]?.url || '/placeholder.png';
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 mb-3">
        <Image
          src={imageUrl}
          alt={product.name}
          fill
          className="object-cover transition-transform group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        {hasDiscount && (
          <span
            className="absolute top-2 left-2 px-2 py-1 text-xs font-semibold text-white rounded"
            style={{ backgroundColor: '#ef4444' }}
          >
            Sale
          </span>
        )}
      </div>

      {/* Info */}
      <div>
        {product.category && (
          <p className="text-xs text-gray-500 mb-1">{product.category.name}</p>
        )}
        <h3 className="font-medium text-sm mb-1 group-hover:underline line-clamp-2">
          {product.name}
        </h3>
        <div className="flex items-center gap-2">
          <span className="font-semibold" style={{ color: primaryColor }}>
            ${product.price.toFixed(2)}
          </span>
          {hasDiscount && (
            <span className="text-sm text-gray-400 line-through">
              ${product.compareAtPrice!.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
