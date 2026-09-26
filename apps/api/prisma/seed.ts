import { PrismaClient } from '@prisma/client';
import { assertSeedAllowed } from './seed-guard';

const prisma = new PrismaClient();

/**
 * Jiffoo Mall seed script.
 *
 * Goals:
 * - Idempotent (safe to re-run)
 * - Sample catalog data only
 */

// Export for potential external tooling (kept minimal)
export { prisma };

type SeedInventoryProfile = 'demo_mixed' | 'all_in_stock' | 'legacy_random';
type SeedInventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

const DEFAULT_INVENTORY_PROFILE: SeedInventoryProfile = 'demo_mixed';

const DEMO_PRODUCT_STOCK_STATUS: Record<string, SeedInventoryStatus> = {
  'prod-001': 'in_stock', // headphones
  'prod-002': 'in_stock', // classic blue watch
  'prod-003': 'in_stock', // leather cardholder
  'prod-004': 'low_stock', // scented candle
  'prod-005': 'in_stock', // minimalist vase
  'prod-006': 'out_of_stock', // leather notebook
  'prod-007': 'in_stock', // leather handbag
};

function getSeedInventoryProfile(): SeedInventoryProfile {
  const raw = process.env.JIFFOO_SEED_INVENTORY_PROFILE?.trim();
  if (!raw) return DEFAULT_INVENTORY_PROFILE;

  if (raw === 'demo_mixed' || raw === 'all_in_stock' || raw === 'legacy_random') {
    return raw;
  }

  console.warn(
    `⚠️ Unknown JIFFOO_SEED_INVENTORY_PROFILE="${raw}", falling back to ${DEFAULT_INVENTORY_PROFILE}`
  );
  return DEFAULT_INVENTORY_PROFILE;
}

function getInventoryStatusForProduct(
  profile: SeedInventoryProfile,
  productId: string
): SeedInventoryStatus {
  if (profile === 'all_in_stock') return 'in_stock';
  if (profile === 'legacy_random') return 'in_stock';
  return DEMO_PRODUCT_STOCK_STATUS[productId] ?? 'in_stock';
}

function buildStockSeed(
  profile: SeedInventoryProfile,
  status: SeedInventoryStatus,
  variantIndex: number
): number {
  if (profile === 'legacy_random') return 50 + ((variantIndex * 17) % 51);
  if (status === 'out_of_stock') return 0;
  const quantity = status === 'low_stock' ? 9 : 48;
  return quantity + (variantIndex % 3);
}

async function getExistingPublicTables(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `;
  return new Set(rows.map((row) => row.table_name));
}

function findMissingTables(existingTables: Set<string>, requiredTables: string[]): string[] {
  return requiredTables.filter((table) => !existingTables.has(table));
}

async function main() {
  try {
    assertSeedAllowed(process.env.NODE_ENV);
    console.log('🌱 Starting database seeding (Standalone Mode)...');
    const inventoryProfile = getSeedInventoryProfile();
    console.log(`📦 Inventory seed profile: ${inventoryProfile}`);

    // Create categories
    console.log('🗂️ Creating sample categories...');
    // Aligned with the storefront theme's category cards (theme-assets/default)
    const categories = [
      { id: 'cat-home-living', name: 'Home & Living', slug: 'home-living', description: 'Vases, candles and homeware', level: 1, sortOrder: 10 },
      { id: 'cat-bags', name: 'Bags & Accessories', slug: 'bags-accessories', description: 'Bags, wallets and leather goods', level: 1, sortOrder: 20 },
      { id: 'cat-watches', name: 'Watches', slug: 'watches', description: 'Classic and modern timepieces', level: 1, sortOrder: 30 },
      { id: 'cat-lifestyle', name: 'Lifestyle', slug: 'lifestyle', description: 'Stationery and everyday essentials', level: 1, sortOrder: 40 },
      { id: 'cat-electronics', name: 'Electronics', slug: 'electronics', description: 'Gadgets and devices', level: 1, sortOrder: 50 },
    ] as const;

    // Store category slug to id mapping
    const categoryIdMap: Record<string, string> = {};

    for (const category of categories) {
      const upsertedCategory = await prisma.category.upsert({
        where: { slug: category.slug },
        update: { name: category.name, description: category.description, level: category.level, sortOrder: category.sortOrder },
        create: category,
      });
      // Map original id to actual database id
      categoryIdMap[category.id] = upsertedCategory.id;
    }
    console.log(`✅ Created ${categories.length} categories`);

    // Create products + variants + translations
    console.log('📦 Creating sample products...');
    const sampleProducts: Array<{
      id: string;
      slug: string;
      name: string;
      description: string;
      zhName: string;
      zhDescription: string;
      categoryId: string;
      /** Stored in Product.typeData.images; served by the shop app from public/ */
      images: string[];
      variants: Array<{
        key: string;
        nameSuffix: string;
        skuSuffix: string;
        price: number;
        stock: number;
        sortOrder?: number;
        attributes?: Record<string, unknown>;
      }>;
    }> = [
        {
          id: 'prod-001',
          slug: 'wireless-bluetooth-headphones',
          name: 'Wireless Bluetooth Headphones',
          description: 'Premium noise-cancelling wireless headphones with 30-hour battery life',
          zhName: '無線藍牙耳機',
          zhDescription: '高端降噪無線耳機，續航長達30小時',
          categoryId: 'cat-electronics',
          images: ['/theme-assets/default/product-headphones.webp'],
          variants: [
            { key: 'black', nameSuffix: 'Midnight Blue', skuSuffix: 'BLACK', price: 199.99, stock: 50, sortOrder: 10, attributes: { color: 'midnight-blue' } },
            { key: 'white', nameSuffix: 'White', skuSuffix: 'WHITE', price: 199.99, stock: 45, sortOrder: 20, attributes: { color: 'white' } },
            { key: 'silver', nameSuffix: 'Silver', skuSuffix: 'SILVER', price: 209.99, stock: 40, sortOrder: 30, attributes: { color: 'silver' } },
          ],
        },
        {
          id: 'prod-002',
          slug: 'classic-blue-watch',
          name: 'Classic Blue Watch',
          description: 'Analog watch with a sapphire-blue sunray dial and leather strap',
          zhName: '經典藍面腕錶',
          zhDescription: '寶藍色太陽紋錶盤，皮革錶帶，經典三針設計',
          categoryId: 'cat-watches',
          images: ['/theme-assets/default/product-watch.webp'],
          variants: [
            { key: 'leather-blue', nameSuffix: 'Leather Strap Blue', skuSuffix: 'LEATHER-BLU', price: 199.0, stock: 20, sortOrder: 10, attributes: { strap: 'leather', color: 'blue' } },
            { key: 'leather-black', nameSuffix: 'Leather Strap Black', skuSuffix: 'LEATHER-BLK', price: 199.0, stock: 16, sortOrder: 20, attributes: { strap: 'leather', color: 'black' } },
            { key: 'mesh-silver', nameSuffix: 'Mesh Strap Silver', skuSuffix: 'MESH-SLV', price: 219.0, stock: 12, sortOrder: 30, attributes: { strap: 'mesh', color: 'silver' } },
          ],
        },
        {
          id: 'prod-003',
          slug: 'leather-cardholder',
          name: 'Leather Cardholder',
          description: 'Slim saffiano leather cardholder with five card slots',
          zhName: '真皮卡包',
          zhDescription: '十字紋真皮超薄卡包，五個卡位',
          categoryId: 'cat-bags',
          images: ['/theme-assets/default/product-cardholder.webp'],
          variants: [
            { key: 'navy', nameSuffix: 'Navy', skuSuffix: 'NAVY', price: 89.0, stock: 40, sortOrder: 10, attributes: { color: 'navy' } },
            { key: 'black', nameSuffix: 'Black', skuSuffix: 'BLK', price: 89.0, stock: 35, sortOrder: 20, attributes: { color: 'black' } },
            { key: 'tan', nameSuffix: 'Tan', skuSuffix: 'TAN', price: 89.0, stock: 28, sortOrder: 30, attributes: { color: 'tan' } },
          ],
        },
        {
          id: 'prod-004',
          slug: 'scented-candle',
          name: 'Scented Candle',
          description: 'Natural wax scented candle in a cobalt glass jar, 45-hour burn time',
          zhName: '香氛蠟燭',
          zhDescription: '鈷藍玻璃罐天然蠟香氛蠟燭，可燃燒45小時',
          categoryId: 'cat-home-living',
          images: ['/theme-assets/default/product-candle.webp'],
          variants: [
            { key: 'sea-salt', nameSuffix: 'Sea Salt', skuSuffix: 'SEASALT', price: 49.0, stock: 8, sortOrder: 10, attributes: { scent: 'sea-salt' } },
            { key: 'cedar', nameSuffix: 'Cedarwood', skuSuffix: 'CEDAR', price: 49.0, stock: 6, sortOrder: 20, attributes: { scent: 'cedarwood' } },
            { key: 'white-tea', nameSuffix: 'White Tea', skuSuffix: 'WHITETEA', price: 54.0, stock: 5, sortOrder: 30, attributes: { scent: 'white-tea' } },
          ],
        },
        {
          id: 'prod-005',
          slug: 'minimalist-vase',
          name: 'Minimalist Vase',
          description: 'Matte ceramic vase with a hand-finished indigo glaze',
          zhName: '極簡花瓶',
          zhDescription: '啞光陶瓷花瓶，手工靛藍釉面',
          categoryId: 'cat-home-living',
          images: ['/theme-assets/default/product-vase.webp'],
          variants: [
            { key: 'small', nameSuffix: 'Small', skuSuffix: 'S', price: 65.0, stock: 30, sortOrder: 10, attributes: { size: 'small' } },
            { key: 'large', nameSuffix: 'Large', skuSuffix: 'L', price: 85.0, stock: 22, sortOrder: 20, attributes: { size: 'large' } },
          ],
        },
        {
          id: 'prod-006',
          slug: 'leather-notebook',
          name: 'Leather Notebook',
          description: 'A5 leather-bound notebook with lay-flat binding and ribbon marker',
          zhName: '真皮筆記本',
          zhDescription: 'A5真皮筆記本，可平攤裝訂，附絲帶書籤',
          categoryId: 'cat-lifestyle',
          images: ['/theme-assets/default/product-notebook.webp'],
          variants: [
            { key: 'ruled', nameSuffix: 'Ruled', skuSuffix: 'RULED', price: 39.0, stock: 0, sortOrder: 10, attributes: { paper: 'ruled' } },
            { key: 'plain', nameSuffix: 'Plain', skuSuffix: 'PLAIN', price: 39.0, stock: 0, sortOrder: 20, attributes: { paper: 'plain' } },
          ],
        },
        {
          id: 'prod-007',
          slug: 'leather-handbag',
          name: 'Leather Handbag',
          description: 'Structured pebbled-leather handbag with detachable shoulder strap',
          zhName: '真皮手提包',
          zhDescription: '荔枝紋真皮手提包，附可拆卸肩帶',
          categoryId: 'cat-bags',
          images: ['/theme-assets/default/category-bags.webp'],
          variants: [
            { key: 'navy', nameSuffix: 'Navy', skuSuffix: 'NAVY', price: 129.0, stock: 26, sortOrder: 10, attributes: { color: 'navy' } },
            { key: 'black', nameSuffix: 'Black', skuSuffix: 'BLK', price: 129.0, stock: 24, sortOrder: 20, attributes: { color: 'black' } },
          ],
        },
      ];

    for (const prod of sampleProducts) {
      // Use mapped category ID
      const actualCategoryId = categoryIdMap[prod.categoryId] || prod.categoryId;

      await prisma.product.upsert({
        where: { id: prod.id },
        update: {
          name: prod.name,
          slug: prod.slug,
          description: prod.description,
          categoryId: actualCategoryId,
          typeData: { images: prod.images },
        },
        create: {
          id: prod.id,
          name: prod.name,
          slug: prod.slug,
          description: prod.description,
          categoryId: actualCategoryId,
          typeData: { images: prod.images },
        },
      });

      // Create 5 SKU variants for each SPU
      for (const variant of prod.variants) {
        const variantId = `var-${prod.id}-${variant.key}`;
        await prisma.productVariant.upsert({
          where: { id: variantId },
          update: {
            name: `${prod.name} - ${variant.nameSuffix}`,
            salePrice: variant.price,
            stock: variant.stock,
            skuCode: `SKU-${prod.id.toUpperCase()}-${variant.skuSuffix}`,
            sortOrder: variant.sortOrder ?? 0,
            isActive: true,
            attributes: variant.attributes ?? null,
          },
          create: {
            id: variantId,
            productId: prod.id,
            name: `${prod.name} - ${variant.nameSuffix}`,
            salePrice: variant.price,
            stock: variant.stock,
            skuCode: `SKU-${prod.id.toUpperCase()}-${variant.skuSuffix}`,
            sortOrder: variant.sortOrder ?? 0,
            isActive: true,
            attributes: variant.attributes ?? null,
          },
        });
      }

      // Keep base content in the default store locale.
      await prisma.productTranslation.upsert({
        where: { productId_locale: { productId: prod.id, locale: 'zh-Hant' } },
        update: { name: prod.zhName, description: prod.zhDescription },
        create: { productId: prod.id, locale: 'zh-Hant', name: prod.zhName, description: prod.zhDescription },
      });
    }
    console.log(`✅ Created ${sampleProducts.length} sample products`);

    // Set stock for existing products.
    const variants = await prisma.productVariant.findMany({
      select: { id: true, skuCode: true, productId: true },
      orderBy: [{ productId: 'asc' }, { id: 'asc' }],
    });

    for (const [index, variant] of variants.entries()) {
      const status = getInventoryStatusForProduct(inventoryProfile, variant.productId);
      await prisma.productVariant.update({
        where: { id: variant.id },
        data: { stock: buildStockSeed(inventoryProfile, status, index) },
      });
    }

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - ${sampleProducts.length} sample products created`);
    console.log('   - 5 categories created');
    console.log('   - Variants and product translations created');

  } catch (error) {
    console.error('❌ Seed error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
if (process.env.JIFFOO_SEED_SKIP_MAIN !== '1') {
  main();
}
