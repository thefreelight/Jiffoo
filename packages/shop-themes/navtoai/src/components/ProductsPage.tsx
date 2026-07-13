import React from 'react';
import type { ProductsPageProps } from 'shared/src/types/theme';
import { DirectoryCatalog } from './DirectoryCatalog';

export const ProductsPage = React.memo(function ProductsPage({
  products,
  isLoading,
  totalProducts,
  currentPage,
  totalPages,
  sortBy,
  viewMode,
  onSortChange,
  onViewModeChange,
  onPageChange,
  onAddToCart,
  onProductClick,
  onSearch,
}: ProductsPageProps) {
  return (
    <DirectoryCatalog
      products={products}
      isLoading={isLoading}
      totalProducts={totalProducts}
      currentPage={currentPage}
      totalPages={totalPages}
      sortBy={sortBy}
      viewMode={viewMode}
      title="Discover tools that belong in an actual AI workflow."
      description="Use the storefront like a navigation site: shortlist by category, scan the strongest signals fast, then open the tool page or add it straight into the buying stack."
      eyebrow="AI tool directory"
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
