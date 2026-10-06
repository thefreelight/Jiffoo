import 'server-only';
import type { ShopLocale } from './locale';
import { serverCoreResponse } from './core-transport';
import { withAvailability } from './availability-boundary';
import { ShopAvailability } from './availability';
import { CoreHttpError, coreErrorCode } from './core-errors';

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
  return withAvailability(async () => {
  try {
    const response = await serverCoreResponse(`/store/theme?target=shop&locale=${encodeURIComponent(locale)}`);
    if (response.status === 404 && await coreErrorCode(response) === 'THEME_NOT_FOUND') return null;
    if (!response.ok) throw new CoreHttpError(response.status);
    const body = await response.json() as { data: ShopTheme };
    return body.data;
  } catch (error) {
    if (error instanceof ShopAvailability) throw error;
    throw error;
  }
  });
}
