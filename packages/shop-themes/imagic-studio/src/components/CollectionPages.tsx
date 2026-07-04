'use client';

import type {
  BestsellersPageProps,
  CategoriesPageProps,
  DealsPageProps,
  NewArrivalsPageProps,
  ProfileSettingsPageProps,
  SearchPageProps,
} from 'shared/src/types/theme';

import { ProductsPage } from './ProductsPage';
import { ProfilePage } from './ProfilePage';

export function BestsellersPage(props: BestsellersPageProps) {
  return <ProductsPage {...(props as any)} />;
}

export function NewArrivalsPage(props: NewArrivalsPageProps) {
  return <ProductsPage {...(props as any)} />;
}

export function CategoriesPage(props: CategoriesPageProps) {
  return <ProductsPage {...(props as any)} />;
}

export function SearchPage(props: SearchPageProps) {
  return <ProductsPage {...(props as any)} />;
}

export function DealsPage(props: DealsPageProps) {
  return <ProductsPage {...(props as any)} />;
}

export function ProfileSettingsPage(props: ProfileSettingsPageProps) {
  return <ProfilePage {...(props as any)} />;
}
