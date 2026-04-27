import React from 'react';
import type {
  BestsellersPageProps,
  DealsPageProps,
  NewArrivalsPageProps,
  SearchPageProps,
} from 'shared/src/types/theme';
import { DirectoryCatalog } from './DirectoryCatalog';
import { getNavCopy } from '../i18n';

export const BestsellersPage = React.memo(function BestsellersPage(props: BestsellersPageProps) {
  const copy = getNavCopy(props.locale);

  return (
    <DirectoryCatalog
      products={props.products}
      isLoading={props.isLoading}
      totalProducts={props.totalProducts ?? props.products?.length ?? 0}
      currentPage={props.currentPage ?? 1}
      totalPages={props.totalPages ?? 1}
      sortBy={props.sortBy}
      viewMode="grid"
      locale={props.locale}
      config={props.config}
      activeNavId="rankings"
      title={copy.catalog.bestsellersTitle}
      description={copy.catalog.bestsellersDescription}
      eyebrow={copy.catalog.bestsellersEyebrow}
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
  const copy = getNavCopy(props.locale);

  return (
    <DirectoryCatalog
      products={props.products}
      isLoading={props.isLoading}
      totalProducts={props.totalProducts ?? props.products?.length ?? 0}
      currentPage={props.currentPage ?? 1}
      totalPages={props.totalPages ?? 1}
      sortBy={props.sortBy}
      viewMode="grid"
      locale={props.locale}
      config={props.config}
      activeNavId="news"
      title={copy.catalog.newArrivalsTitle}
      description={copy.catalog.newArrivalsDescription}
      eyebrow={copy.catalog.newArrivalsEyebrow}
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
  const copy = getNavCopy(props.locale);

  return (
    <DirectoryCatalog
      products={props.products}
      isLoading={props.isLoading}
      totalProducts={props.products?.length ?? 0}
      currentPage={1}
      totalPages={1}
      sortBy="price"
      viewMode="grid"
      locale={props.locale}
      config={props.config}
      activeNavId="collections"
      title={copy.catalog.dealsTitle}
      description={copy.catalog.dealsDescription}
      eyebrow={copy.catalog.dealsEyebrow}
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
  const copy = getNavCopy(props.locale);

  return (
    <DirectoryCatalog
      products={props.products}
      isLoading={props.isLoading}
      totalProducts={props.products?.length ?? 0}
      currentPage={1}
      totalPages={1}
      sortBy={props.sortBy}
      viewMode={props.viewMode}
      locale={props.locale}
      config={props.config}
      activeNavId="apps"
      title={copy.catalog.searchTitle}
      description={copy.catalog.searchDescription}
      eyebrow={copy.sidebar.apps}
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
