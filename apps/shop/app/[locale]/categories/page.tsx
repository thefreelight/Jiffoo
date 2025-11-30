/**
 * Categories Page for Shop Application
 *
 * Displays product categories with navigation to filtered products.
 * Supports i18n through the translation function.
 */

'use client';

import * as React from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { productsApi } from '@/lib/api';
import { useT } from 'shared/src/i18n';

interface Category {
  id: string;
  name: string;
  description: string;
  image: string;
  productCount: number;
  featured?: boolean;
}

export default function CategoriesPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const t = useT();

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Load categories data
  React.useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await productsApi.getCategories();
        if (response.success && response.data) {
          // Transform API data to match component structure
          const transformedCategories = (response.data as unknown as { name: string; count: number }[]).map((cat: { name: string; count: number }, index: number) => ({
            id: cat.name.toLowerCase().replace(/\s+/g, '-'),
            name: cat.name,
            description: `Discover ${cat.count} amazing products`,
            image: getDefaultCategoryImage(cat.name),
            productCount: cat.count,
            featured: cat.count > 50, // Mark categories with more than 50 products as featured
          }));
          setCategories(transformedCategories);
        } else {
          setError(getText('common.errors.general', 'Failed to load categories'));
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
        setError(getText('common.errors.general', 'Failed to load categories'));
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [getText]);

  // Helper function to get default category images
  const getDefaultCategoryImage = (categoryName: string) => {
    const imageMap: Record<string, string> = {
      'Electronics': 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600&h=400&fit=crop',
      'Fashion': 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&h=400&fit=crop',
      'Home & Garden': 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=400&fit=crop',
      'Sports': 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop',
      'Books': 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=400&fit=crop',
      'Beauty': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&h=400&fit=crop',
      'Automotive': 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600&h=400&fit=crop',
      'Toys': 'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=600&h=400&fit=crop',
    };
    return imageMap[categoryName] || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=400&fit=crop';
  };

  // Helper function to get category colors
  const getCategoryColor = (index: number) => {
    const colors = [
      'from-blue-500 to-purple-600',
      'from-pink-500 to-rose-600',
      'from-green-500 to-emerald-600',
      'from-orange-500 to-red-600',
      'from-indigo-500 to-blue-600',
      'from-purple-500 to-pink-600',
      'from-gray-500 to-slate-600',
      'from-yellow-500 to-orange-600',
    ];
    return colors[index % colors.length];
  };

  // Handle category click
  const handleCategoryClick = (categoryId: string) => {
    nav.push(`/products?category=${categoryId}`);
  };

  // Theme loading state
  if (themeLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="mt-4 text-sm text-gray-600">{getText('common.actions.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  // If theme component is not available, use NotFound fallback
  if (!theme?.components?.CategoriesPage) {
    const NotFoundComponent = theme?.components?.NotFound;
    if (NotFoundComponent) {
      return (
        <NotFoundComponent
          route="/categories"
          message={getText('common.errors.componentUnavailable', 'Categories page component is not available')}
          config={config}
          locale={nav.locale}
          t={t}
          onGoHome={() => nav.push('/')}
        />
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">{getText('common.errors.themeUnavailable', 'Theme Component Unavailable')}</h1>
          <p className="mt-2 text-sm text-gray-600">{getText('common.errors.componentUnavailable', 'Unable to load categories page component')}</p>
        </div>
      </div>
    );
  }

  // Render with theme component
  const CategoriesPageComponent = theme.components.CategoriesPage;

  return (
    <CategoriesPageComponent
      categories={categories}
      isLoading={loading}
      error={error}
      config={config}
      locale={nav.locale}
      t={t}
      onCategoryClick={handleCategoryClick}
    />
  );
}
