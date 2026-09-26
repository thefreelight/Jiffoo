import 'server-only';
import type { ShopLocale } from './locale';
import { shopApiHeaders } from './api-headers';

export type ThemeSection = {
  id: string;
  type: string;
  settings: Record<string, unknown>;
};
export type ShopTheme = {
  target: 'shop';
  slug: string;
  version: string;
  tokens: Record<string, unknown>;
  fonts: Array<{ id: string; family: string; url: string; weight: number; style: 'normal' | 'italic' }>;
  copy: Record<string, string>;
  layout: {
    header: { variant: 'logo-left' | 'logo-center'; menu: 'inline' | 'drawer'; showSearch: boolean };
    footer: { columns: Array<{ title: string; text: string; links: Array<{ label: string; href: string }> }> };
    pages: {
      home: { sections: ThemeSection[] };
      category: { columns: number; showFilters: boolean };
      product: { gallery: 'left' | 'right'; showRelatedProducts: boolean };
    };
    slots: Record<'category.top' | 'category.bottom' | 'product.bottom', ThemeSection[]>;
  };
};

export async function getShopTheme(locale: ShopLocale): Promise<ShopTheme | null> {
  try {
    const base = process.env.API_SERVICE_URL || 'http://127.0.0.1:3001';
    const url = new URL('/api/v1/store/theme', base);
    url.searchParams.set('target', 'shop');
    url.searchParams.set('locale', locale);
    const response = await fetch(url, { cache: 'no-store', headers: await shopApiHeaders() });
    if (!response.ok) throw new Error(`Theme API returned ${response.status}`);
    const body = await response.json() as { data: ShopTheme };
    return body.data;
  } catch (error) {
    console.error('Shop theme unavailable; using Core defaults', error);
    return null;
  }
}
