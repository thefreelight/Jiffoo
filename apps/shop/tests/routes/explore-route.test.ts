import { describe, expect, it } from 'vitest';

import ExplorePage from '@/app/[locale]/explore/page';
import ProductsPage from '@/app/[locale]/products/page';

describe('explore storefront route', () => {
  it('uses the product discovery page for direct explore links', () => {
    expect(ExplorePage).toBe(ProductsPage);
  });
});
