'use client';

import * as React from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { ProductService } from '@/services/product.service';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useT } from 'shared/src/i18n/react';
import { LoadingState, ErrorState } from '@/components/ui/state-components';
import { TemplateRenderer } from '@/lib/theme-pack';

export default function CategoriesPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const t = useT();

  const [categories, setCategories] = React.useState<Array<{
    id: string;
    name: string;
    description: string;
    image: string;
    productCount: number;
    featured?: boolean;
  }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const getText = (key: string, fallback: string): string => (t ? t(key) : fallback);

  React.useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        setLoading(true);
        setError(null);
        const response = await ProductService.getCategories();

        if (cancelled) return;

        setCategories(
          response.items.map((category) => ({
            id: category.slug || category.id,
            name: category.name,
            description: category.description || '',
            image: '',
            productCount: category.productCount || 0,
            featured: false,
          }))
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : getText('common.errors.general', 'Failed to fetch categories'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, [getText]);

  if (themeLoading) {
    return <LoadingState type="spinner" message={getText('common.actions.loading', 'Loading...')} fullPage />;
  }

  if (!theme?.components?.CategoriesPage) {
    return (
      <ErrorState
        title={getText('common.errors.themeUnavailable', 'Theme Component Unavailable')}
        message={getText('common.errors.componentUnavailable', 'Unable to load categories page component')}
        onGoHome={() => nav.push('/')}
        fullPage
      />
    );
  }

  const CategoriesPageComponent = theme.components.CategoriesPage;
  const defaultCategoriesPage = (
    <CategoriesPageComponent
      categories={categories}
      isLoading={loading}
      error={error}
      config={config}
      locale={nav.locale}
      t={t}
      onCategoryClick={(categoryId) => nav.push(`/products?category=${encodeURIComponent(categoryId)}`)}
      onNavigateToHome={() => nav.push('/')}
    />
  );

  return <TemplateRenderer page="categories" fallback={defaultCategoriesPage} />;
}
