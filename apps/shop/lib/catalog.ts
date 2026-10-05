import 'server-only';
import { notFound } from 'next/navigation';
import { storefrontMessages } from './storefront-messages';
import { isShopLocale, type ShopLocale } from './locale';
import { serverCoreResponse } from './core-transport';
import { withAvailability } from './availability-boundary';

export type StoreContext = {
  storeName: string;
  logo: string | null;
  currency: string;
  defaultLocale: ShopLocale;
  supportedLocales: ShopLocale[];
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  productCount: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  price: number;
  images: string[];
  stock: number;
  variants?: Array<{
    id: string;
    name: string;
    skuCode: string | null;
    salePrice: number;
    stock: number;
    attributes: Record<string, unknown> | null;
  }>;
};

export type PageResult<T> = { items: T[]; page: number; totalPages: number; total: number };

async function api<T>(path: string, params: Record<string, string | number> = {}): Promise<T | null> {
  return withAvailability(async () => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) query.set(key, String(value));
  const response = await serverCoreResponse(`${path}${query.size ? `?${query}` : ''}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Shop API request failed: ${response.status}`);
  const body = await response.json() as { data: T };
  return body.data;
  });
}

export async function readStoreContext(): Promise<StoreContext> {
  const context = await api<StoreContext>('/store/context');
  if (!context) throw new Error('Store context unavailable');
  return context;
}

export async function getStoreContext(): Promise<StoreContext> {
  const { shopBootstrap } = await import('./server-bootstrap');
  return (await shopBootstrap()).context;
}

export async function requireLocale(value: string) {
  const context = await getStoreContext();
  if (!isShopLocale(value) || !context.supportedLocales.includes(value)) notFound();
  return { context, locale: value };
}

export function messages(locale: ShopLocale) {
  return storefrontMessages(locale);
}

export async function categories(locale: ShopLocale): Promise<Category[]> {
  const items: Category[] = [];
  for (let page = 1; ; page += 1) {
    const result = await api<PageResult<Category>>('/products/categories', { locale, page, limit: 100 });
    if (!result) return items;
    items.push(...result.items);
    if (page >= result.totalPages) return items;
  }
}

export async function products(locale: ShopLocale, page = 1, category?: string, limit = 12) {
  return api<PageResult<Product>>('/products', { locale, page, limit, ...(category ? { category } : {}) });
}

export async function productById(locale: ShopLocale, id: string) {
  return api<Product>(`/products/${encodeURIComponent(id)}`, { locale });
}

export async function search(locale: ShopLocale, q: string, page = 1) {
  return api<PageResult<Product>>('/products/search', { locale, q, page, limit: 12 });
}

export async function productBySlug(locale: ShopLocale, slug: string) {
  return api<Product>(`/products/by-slug/${encodeURIComponent(slug)}`, { locale });
}
