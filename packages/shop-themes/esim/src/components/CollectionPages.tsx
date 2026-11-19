import React from 'react';
import type {
  BestsellersPageProps,
  DealsPageProps,
  NewArrivalsPageProps,
  SearchPageProps,
} from 'shared/src/types/theme';
import { ProductsPage } from './ProductsPage';
import { filterEsimPlans } from '../site';
<<<<<<< HEAD

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const esimPlansOf = (props: { products?: any[] }) => filterEsimPlans(props.products);
=======
>>>>>>> origin/main

export const BestsellersPage = (props: BestsellersPageProps) => (
  <ProductsPage
    {...props}
    products={filterEsimPlans(props.products)}
<<<<<<< HEAD
    totalProducts={props.totalProducts ?? esimPlansOf(props).length ?? 0}
=======
    totalProducts={props.totalProducts ?? props.products?.length ?? 0}
>>>>>>> origin/main
    currentPage={props.currentPage ?? 1}
    totalPages={props.totalPages ?? 1}
    viewMode="grid"
    onViewModeChange={() => undefined}
    onSearch={() => undefined}
  />
);

export const NewArrivalsPage = (props: NewArrivalsPageProps) => (
  <ProductsPage
    {...props}
    products={filterEsimPlans(props.products)}
<<<<<<< HEAD
    totalProducts={props.totalProducts ?? esimPlansOf(props).length ?? 0}
=======
    totalProducts={props.totalProducts ?? props.products?.length ?? 0}
>>>>>>> origin/main
    currentPage={props.currentPage ?? 1}
    totalPages={props.totalPages ?? 1}
    viewMode="grid"
    onViewModeChange={() => undefined}
    onSearch={() => undefined}
  />
);

export const DealsPage = (props: DealsPageProps) => (
  <ProductsPage
    products={filterEsimPlans(props.products)}
    isLoading={props.isLoading}
    totalProducts={esimPlansOf(props).length}
    currentPage={1}
    totalPages={1}
    sortBy="createdAt"
    viewMode="grid"
    config={props.config}
    locale={props.locale}
    t={props.t}
    onSortChange={() => undefined}
    onViewModeChange={() => undefined}
    onPageChange={() => undefined}
    onAddToCart={props.onAddToCart}
    onProductClick={props.onProductClick}
    onSearch={() => undefined}
  />
);

export const SearchPage = (props: SearchPageProps) => (
  <ProductsPage
    products={filterEsimPlans(props.products)}
    isLoading={props.isLoading}
    totalProducts={esimPlansOf(props).length}
    currentPage={1}
    totalPages={1}
    sortBy={props.sortBy}
    viewMode={props.viewMode}
    config={props.config}
    locale={props.locale}
    t={props.t}
    onSortChange={props.onSortChange}
    onViewModeChange={props.onViewModeChange}
    onPageChange={() => undefined}
    onAddToCart={props.onAddToCart}
    onProductClick={props.onProductClick}
    onSearch={() => undefined}
  />
);
