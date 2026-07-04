'use client';

/**
 * Featured Categories Block
 *
 * Display featured product categories.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { BlockComponentProps } from '../types';

interface FeaturedCategoriesSettings {
  /** Section title */
  title?: string;
  /** Maximum number of categories to show */
  limit?: number;
  /** Number of columns */
  columns?: number;
  /** Whether to show section title */
  showTitle?: boolean;
  /** Specific category slugs to show (if empty, show featured/all) */
  categories?: string[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  productCount?: number;
}

export function FeaturedCategoriesBlock({ settings, themeConfig, blockId }: BlockComponentProps) {
  const categorySettings = settings as FeaturedCategoriesSettings;
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const {
    title = 'Shop by Category',
    limit = 6,
    columns = 3,
    showTitle = true,
    categories: specificCategories,
  } = categorySettings;

  // Fetch categories
  useEffect(() => {
    let mounted = true;

    async function fetchCategories() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/products/categories?limit=${limit}`);
        if (!response.ok) throw new Error('Failed to fetch categories');

        const data = await response.json();
        let items = data.data?.items || data.items || [];

        // Filter by specific slugs if provided
        if (specificCategories && specificCategories.length > 0) {
          items = items.filter((cat: Category) =>
            specificCategories.includes(cat.slug)
          );
        }

        if (mounted) {
          setCategories(items.slice(0, limit));
        }
      } catch (error) {
        console.error('[FeaturedCategoriesBlock] Error fetching categories:', error);
        if (mounted) setCategories([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    fetchCategories();

    return () => {
      mounted = false;
    };
  }, [limit, specificCategories]);

  const getColumnClasses = (cols: number): string => {
    const colMap: Record<number, string> = {
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
      4: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
      6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-6',
    };
    return colMap[cols] || colMap[3];
  };

  const primaryColor = themeConfig?.colors?.primary || 'var(--theme-color-primary, #2563eb)';

  return (
    <section id={blockId} className="py-12 px-4">
      <div className="container mx-auto">
        {showTitle && title && (
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">{title}</h2>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className={`grid ${getColumnClasses(columns)} gap-4`}>
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-lg mb-2" />
                <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto" />
              </div>
            ))}
          </div>
        )}

        {/* Categories Grid */}
        {!isLoading && categories.length > 0 && (
          <div className={`grid ${getColumnClasses(columns)} gap-4`}>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="group block text-center"
              >
                <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 mb-3">
                  {category.image ? (
                    <Image
                      src={category.image}
                      alt={category.name}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-4xl"
                      style={{ backgroundColor: `${primaryColor}20` }}
                    >
                      {category.name.charAt(0)}
                    </div>
                  )}
                </div>
                <h3 className="font-medium group-hover:underline">{category.name}</h3>
                {category.productCount !== undefined && (
                  <p className="text-sm text-gray-500">{category.productCount} products</p>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && categories.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No categories found</p>
          </div>
        )}
      </div>
    </section>
  );
}
