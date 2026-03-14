import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const files = [
  '../../../../packages/shop-themes/default/src/components/ProductDetailPage.tsx',
  '../../../../packages/shop-themes/default/src/components/CartPage.tsx',
  '../../../../packages/shop-themes/default/src/components/CheckoutPage.tsx',
  '../../../../packages/shop-themes/default/src/ui/ProductCard.tsx',
].map((relativePath) => path.resolve(__dirname, relativePath));

describe('default theme placeholder assets', () => {
  it('uses svg placeholder assets instead of missing jpg assets', () => {
    const combinedSource = files.map((filePath) => readFileSync(filePath, 'utf8')).join('\n');

    expect(combinedSource).not.toContain('/placeholder-product.jpg');
    expect(combinedSource).toContain('/placeholder-product.svg');
  });
});
