import React from 'react';
import type { ProductsPageProps } from 'shared/src/types/theme';
import { DirectoryCatalog } from './DirectoryCatalog';
import { getNavCopy } from '../i18n';

export const ProductsPage = React.memo(function ProductsPage({
  products,
  isLoading,
  totalProducts,
  currentPage,
  totalPages,
  sortBy,
  viewMode,
  config,
  locale,
  onSortChange,
  onViewModeChange,
  onPageChange,
  onAddToCart,
  onProductClick,
  onSearch,
}: ProductsPageProps) {
  const copy = getNavCopy(locale);

  return (
    <DirectoryCatalog
      products={products}
      isLoading={isLoading}
      totalProducts={totalProducts}
      currentPage={currentPage}
      totalPages={totalPages}
      sortBy={sortBy}
      viewMode={viewMode}
      locale={locale}
      config={config}
      activeNavId="tools"
      title={copy.catalog.toolsTitle}
      description={copy.catalog.toolsDescription}
      eyebrow={copy.catalog.toolsEyebrow}
      canSearch={Boolean(onSearch)}
      onSortChange={onSortChange}
      onViewModeChange={onViewModeChange}
      onPageChange={onPageChange}
      onAddToCart={onAddToCart}
      onProductClick={onProductClick}
      onSearch={onSearch}
    />
  );
});
