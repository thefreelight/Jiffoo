import React from 'react';
import type {
  BestsellersPageProps,
  DealsPageProps,
  NewArrivalsPageProps,
  SearchPageProps,
} from 'shared/src/types/theme';
import { DirectoryCatalog } from './DirectoryCatalog';

export const BestsellersPage = React.memo(function BestsellersPage(props: BestsellersPageProps) {
  return (
    <DirectoryCatalog
      products={props.products}
      isLoading={props.isLoading}
      totalProducts={props.totalProducts ?? props.products?.length ?? 0}
      currentPage={props.currentPage ?? 1}
      totalPages={props.totalPages ?? 1}
      sortBy={props.sortBy}
      viewMode="grid"
      title="Bestselling AI picks that operators keep coming back to."
      description="A tighter shortlist of popular tools, packages, and workflow starters that already carry stronger buying intent."
      eyebrow="Bestsellers"
      canSearch={false}
      onSortChange={props.onSortChange}
      onViewModeChange={() => undefined}
      onPageChange={props.onPageChange}
      onAddToCart={props.onAddToCart}
      onProductClick={props.onProductClick}
    />
  );
});

export const NewArrivalsPage = React.memo(function NewArrivalsPage(props: NewArrivalsPageProps) {
  return (
    <DirectoryCatalog
      products={props.products}
      isLoading={props.isLoading}
      totalProducts={props.totalProducts ?? props.products?.length ?? 0}
      currentPage={props.currentPage ?? 1}
      totalPages={props.totalPages ?? 1}
      sortBy={props.sortBy}
      viewMode="grid"
      title="Fresh AI launches that are worth reviewing before the feed moves on."
      description="New arrivals stay easier to scan when the storefront highlights category, fit, and the strongest signals instead of noise."
      eyebrow="New arrivals"
      canSearch={false}
      onSortChange={props.onSortChange}
      onViewModeChange={() => undefined}
      onPageChange={props.onPageChange}
      onAddToCart={props.onAddToCart}
      onProductClick={props.onProductClick}
    />
  );
});

export const DealsPage = React.memo(function DealsPage(props: DealsPageProps) {
  return (
    <DirectoryCatalog
      products={props.products}
      isLoading={props.isLoading}
      totalProducts={props.products?.length ?? 0}
      currentPage={1}
      totalPages={1}
      sortBy="price"
      viewMode="grid"
      title="Price-aware bundles and offers for teams building an AI stack with discipline."
      description="Use deals when you want easier experimentation without losing the curated directory feel."
      eyebrow="Deals"
      canSearch={false}
      onSortChange={() => undefined}
      onViewModeChange={() => undefined}
      onPageChange={() => undefined}
      onAddToCart={props.onAddToCart}
      onProductClick={props.onProductClick}
    />
  );
});

export const SearchPage = React.memo(function SearchPage(props: SearchPageProps) {
  return (
    <DirectoryCatalog
      products={props.products}
      isLoading={props.isLoading}
      totalProducts={props.products?.length ?? 0}
      currentPage={1}
      totalPages={1}
      sortBy={props.sortBy}
      viewMode={props.viewMode}
      title="Search results tuned for faster AI tool comparison."
      description="Keep the directory framing while narrowing the catalog to one model family, workflow, or operator need."
      eyebrow="Search"
      searchQueryLabel={props.searchQuery}
      canSearch={false}
      onSortChange={props.onSortChange}
      onViewModeChange={props.onViewModeChange}
      onPageChange={() => undefined}
      onAddToCart={props.onAddToCart}
      onProductClick={props.onProductClick}
    />
  );
});
