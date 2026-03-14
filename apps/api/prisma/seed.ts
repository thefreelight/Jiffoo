import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Jiffoo Mall seed script.
 *
 * Goals:
 * - Idempotent (safe to re-run)
 * - Demo-friendly dataset for a standalone deployment
 */

// Export for potential external tooling (kept minimal)
export { prisma, bcrypt };

type SeedInventoryProfile = 'demo_mixed' | 'all_in_stock' | 'legacy_random';
type SeedInventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

const DEFAULT_INVENTORY_PROFILE: SeedInventoryProfile = 'demo_mixed';

const DEMO_PRODUCT_STOCK_STATUS: Record<string, SeedInventoryStatus> = {
  'prod-001': 'in_stock',
  'prod-002': 'low_stock',
  'prod-003': 'in_stock',
  'prod-004': 'out_of_stock',
  'prod-005': 'low_stock',
  'prod-006': 'out_of_stock',
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

function buildWarehouseInventorySeed(
  profile: SeedInventoryProfile,
  status: SeedInventoryStatus,
  warehouseCode: string,
  variantIndex: number
): { quantity: number; reserved: number; available: number; lowStock: number } {
  if (profile === 'legacy_random') {
    if (warehouseCode === 'MAIN') {
      const quantity = 50 + ((variantIndex * 17) % 51);
      const reserved = (variantIndex * 3) % 10;
      return {
        quantity,
        reserved,
        available: Math.max(0, quantity - reserved),
        lowStock: 20,
      };
    }

    if (warehouseCode === 'WEST') {
      const quantity = 20 + ((variantIndex * 11) % 31);
      const reserved = (variantIndex * 2) % 5;
      return {
        quantity,
        reserved,
        available: Math.max(0, quantity - reserved),
        lowStock: 15,
      };
    }

    const quantity = (variantIndex * 7) % 30;
    const reserved = quantity > 5 ? ((variantIndex + 1) % 3) : 0;
    return {
      quantity,
      reserved,
      available: Math.max(0, quantity - reserved),
      lowStock: 10,
    };
  }

  const baseByStatus: Record<
    SeedInventoryStatus,
    Record<string, { quantity: number; reserved: number; lowStock: number }>
  > = {
    in_stock: {
      MAIN: { quantity: 48, reserved: 4, lowStock: 20 },
      WEST: { quantity: 18, reserved: 2, lowStock: 12 },
      EAST: { quantity: 10, reserved: 1, lowStock: 8 },
    },
    low_stock: {
      MAIN: { quantity: 9, reserved: 1, lowStock: 10 },
      WEST: { quantity: 3, reserved: 0, lowStock: 6 },
      EAST: { quantity: 1, reserved: 0, lowStock: 4 },
    },
    out_of_stock: {
      MAIN: { quantity: 0, reserved: 0, lowStock: 5 },
      WEST: { quantity: 0, reserved: 0, lowStock: 5 },
      EAST: { quantity: 0, reserved: 0, lowStock: 5 },
    },
  };

  const fallback = baseByStatus[status].MAIN;
  const seed = baseByStatus[status][warehouseCode] ?? fallback;
  const quantity = status === 'out_of_stock'
    ? 0
    : Math.max(0, seed.quantity + (variantIndex % 3));
  const reserved = Math.min(quantity, seed.reserved);

  return {
    quantity,
    reserved,
    available: Math.max(0, quantity - reserved),
    lowStock: seed.lowStock,
  };
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
    console.log('🌱 Starting database seeding (Standalone Mode)...');
    const inventoryProfile = getSeedInventoryProfile();
    console.log(`📦 Inventory seed profile: ${inventoryProfile}`);

    // 0) Create default store
    console.log('🏪 Creating default store...');
    const defaultStore = await prisma.store.upsert({
      where: { slug: 'default-store' },
      update: { name: 'Jiffoo Default Store', domain: 'jiffoo-shop.chfastpay.com' },
      create: {
        id: 'store-default',
        name: 'Jiffoo Default Store',
        slug: 'default-store',
        domain: 'jiffoo-shop.chfastpay.com',
        status: 'active',
        currency: 'USD',
        defaultLocale: 'en',
      },
    });
    console.log(`✅ Default store created: ${defaultStore.name} (${defaultStore.id})`);

    // 1) Initialize system settings (including theme rollback state)
    console.log('⚙️ Initializing system settings...');
    const themeSettings = {
      'theme.active.shop': { slug: 'default', source: 'builtin', version: '1.0.0', config: {}, activatedAt: new Date().toISOString() },
      'theme.active.admin': { slug: 'default', source: 'builtin', version: '1.0.0', config: {}, activatedAt: new Date().toISOString() },
      'localization.currency': 'USD',
      'localization.locale': 'en',
      'localization.timezone': 'UTC',
    };
    await prisma.systemSettings.upsert({
      where: { id: 'system' },
      update: { isInstalled: true, settings: themeSettings },
      create: {
        id: 'system',
        isInstalled: true,
        siteName: 'Jiffoo Mall',
        siteDescription: 'Modern E-commerce Platform',
        allowRegistration: true,
        requireEmailVerification: false,
        maintenanceMode: false,
        version: '1.0.0',
        settings: themeSettings,
      },
    });
    console.log('✅ System settings initialized');

    // 2) Create users
    console.log('👤 Creating admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Admin user (for Admin UI)
    const admin = await prisma.user.upsert({
      where: { email: 'admin@jiffoo.com' },
      update: { role: 'ADMIN', password: hashedPassword, emailVerified: true, storeId: defaultStore.id },
      create: {
        email: 'admin@jiffoo.com',
        username: 'admin',
        password: hashedPassword,
        role: 'ADMIN',
        emailVerified: true,
        avatar: null,
        storeId: defaultStore.id,
      },
    });
    console.log(`✅ Admin user created: ${admin.email}`);

    console.log('👤 Creating super admin user...');
    const superAdmin = await prisma.user.upsert({
      where: { email: 'superadmin@jiffoo.com' },
      update: { role: 'SUPER_ADMIN', password: hashedPassword, emailVerified: true, storeId: defaultStore.id },
      create: {
        email: 'superadmin@jiffoo.com',
        username: 'superadmin',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        emailVerified: true,
        avatar: null,
        storeId: defaultStore.id,
      },
    });
    console.log(`✅ Super admin user created: ${superAdmin.email}`);

    // Sample shopper user (for Shop UI)
    console.log('👤 Creating sample user...');
    const sampleUser = await prisma.user.upsert({
      where: { email: 'user@jiffoo.com' },
      update: { role: 'USER', password: hashedPassword, emailVerified: true, storeId: defaultStore.id },
      create: {
        email: 'user@jiffoo.com',
        username: 'sample-user',
        password: hashedPassword,
        role: 'USER',
        emailVerified: true,
        avatar: null,
        storeId: defaultStore.id,
      },
    });
    console.log(`✅ Sample user created: ${sampleUser.email}`);

    // 3) Create categories
    console.log('🗂️ Creating sample categories...');
    const categories = [
      { id: 'cat-electronics', name: 'Electronics', slug: 'electronics', description: 'Gadgets and devices', level: 1, sortOrder: 10 },
      { id: 'cat-clothing', name: 'Clothing', slug: 'clothing', description: 'Apparel and accessories', level: 1, sortOrder: 20 },
      { id: 'cat-home', name: 'Home', slug: 'home', description: 'Home and living', level: 1, sortOrder: 30 },
      { id: 'cat-beauty', name: 'Beauty', slug: 'beauty', description: 'Skincare and cosmetics', level: 1, sortOrder: 40 },
      { id: 'cat-sports', name: 'Sports', slug: 'sports', description: 'Fitness and outdoor', level: 1, sortOrder: 50 },
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

    // 4) Create products + variants + translations
    console.log('📦 Creating sample products...');
    const sampleProducts: Array<{
      id: string;
      slug: string;
      name: string;
      description: string;
      zhName: string;
      zhDescription: string;
      categoryId: string;
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
          variants: [
            { key: 'black', nameSuffix: 'Black', skuSuffix: 'BLACK', price: 199.99, stock: 50, sortOrder: 10, attributes: { color: 'black' } },
            { key: 'white', nameSuffix: 'White', skuSuffix: 'WHITE', price: 199.99, stock: 45, sortOrder: 20, attributes: { color: 'white' } },
            { key: 'silver', nameSuffix: 'Silver', skuSuffix: 'SILVER', price: 209.99, stock: 40, sortOrder: 30, attributes: { color: 'silver' } },
            { key: 'rose-gold', nameSuffix: 'Rose Gold', skuSuffix: 'ROSEGOLD', price: 219.99, stock: 35, sortOrder: 40, attributes: { color: 'rose-gold' } },
            { key: 'blue', nameSuffix: 'Blue', skuSuffix: 'BLUE', price: 199.99, stock: 30, sortOrder: 50, attributes: { color: 'blue' } },
          ],
        },
        {
          id: 'prod-002',
          slug: 'smart-watch-pro',
          name: 'Smart Watch Pro',
          description: 'Advanced fitness tracking with heart rate monitor and GPS',
          zhName: '智能手錶專業版',
          zhDescription: '高級運動追蹤手錶，配備心率監測和GPS',
          categoryId: 'cat-electronics',
          variants: [
            { key: 'sport-black', nameSuffix: 'Sport Strap Black', skuSuffix: 'SPORT-BLK', price: 299.99, stock: 25, sortOrder: 10, attributes: { strap: 'sport', color: 'black' } },
            { key: 'sport-blue', nameSuffix: 'Sport Strap Blue', skuSuffix: 'SPORT-BLU', price: 299.99, stock: 20, sortOrder: 20, attributes: { strap: 'sport', color: 'blue' } },
            { key: 'leather-brown', nameSuffix: 'Leather Strap Brown', skuSuffix: 'LEATHER-BRN', price: 319.99, stock: 18, sortOrder: 30, attributes: { strap: 'leather', color: 'brown' } },
            { key: 'leather-black', nameSuffix: 'Leather Strap Black', skuSuffix: 'LEATHER-BLK', price: 319.99, stock: 15, sortOrder: 40, attributes: { strap: 'leather', color: 'black' } },
            { key: 'metal-silver', nameSuffix: 'Metal Strap Silver', skuSuffix: 'METAL-SLV', price: 339.99, stock: 22, sortOrder: 50, attributes: { strap: 'metal', color: 'silver' } },
          ],
        },
        {
          id: 'prod-003',
          slug: 'classic-cotton-t-shirt',
          name: 'Classic Cotton T-Shirt',
          description: 'Comfortable 100% organic cotton t-shirt, available in multiple colors',
          zhName: '經典純棉T恤',
          zhDescription: '100%有機棉，舒適透氣，多色可選',
          categoryId: 'cat-clothing',
          variants: [
            { key: 'white-m', nameSuffix: 'White M', skuSuffix: 'WHT-M', price: 29.99, stock: 80, sortOrder: 10, attributes: { color: 'white', size: 'M' } },
            { key: 'white-l', nameSuffix: 'White L', skuSuffix: 'WHT-L', price: 29.99, stock: 70, sortOrder: 20, attributes: { color: 'white', size: 'L' } },
            { key: 'black-m', nameSuffix: 'Black M', skuSuffix: 'BLK-M', price: 29.99, stock: 75, sortOrder: 30, attributes: { color: 'black', size: 'M' } },
            { key: 'black-l', nameSuffix: 'Black L', skuSuffix: 'BLK-L', price: 29.99, stock: 65, sortOrder: 40, attributes: { color: 'black', size: 'L' } },
            { key: 'gray-m', nameSuffix: 'Gray M', skuSuffix: 'GRY-M', price: 29.99, stock: 60, sortOrder: 50, attributes: { color: 'gray', size: 'M' } },
          ],
        },
        {
          id: 'prod-004',
          slug: 'minimalist-desk-lamp',
          name: 'Minimalist Desk Lamp',
          description: 'LED desk lamp with adjustable brightness and color temperature',
          zhName: '極簡檯燈',
          zhDescription: 'LED檯燈，支持亮度和色溫調節',
          categoryId: 'cat-home',
          variants: [
            { key: 'white', nameSuffix: 'White', skuSuffix: 'WHT', price: 49.99, stock: 50, sortOrder: 10, attributes: { color: 'white' } },
            { key: 'black', nameSuffix: 'Black', skuSuffix: 'BLK', price: 49.99, stock: 45, sortOrder: 20, attributes: { color: 'black' } },
            { key: 'silver', nameSuffix: 'Silver', skuSuffix: 'SLV', price: 54.99, stock: 40, sortOrder: 30, attributes: { color: 'silver' } },
            { key: 'wood', nameSuffix: 'Wood Finish', skuSuffix: 'WOOD', price: 59.99, stock: 35, sortOrder: 40, attributes: { color: 'wood' } },
            { key: 'rose-gold', nameSuffix: 'Rose Gold', skuSuffix: 'ROSEGOLD', price: 54.99, stock: 30, sortOrder: 50, attributes: { color: 'rose-gold' } },
          ],
        },
        {
          id: 'prod-005',
          slug: 'natural-skincare-set',
          name: 'Natural Skincare Set',
          description: 'Complete skincare routine with cleanser, toner, and moisturizer',
          zhName: '天然護膚套裝',
          zhDescription: '潔面+爽膚水+面霜，完整護膚流程',
          categoryId: 'cat-beauty',
          variants: [
            { key: 'normal', nameSuffix: 'Normal Skin', skuSuffix: 'NORMAL', price: 79.99, stock: 40, sortOrder: 10, attributes: { skinType: 'normal' } },
            { key: 'dry', nameSuffix: 'Dry Skin', skuSuffix: 'DRY', price: 79.99, stock: 35, sortOrder: 20, attributes: { skinType: 'dry' } },
            { key: 'oily', nameSuffix: 'Oily Skin', skuSuffix: 'OILY', price: 79.99, stock: 38, sortOrder: 30, attributes: { skinType: 'oily' } },
            { key: 'sensitive', nameSuffix: 'Sensitive Skin', skuSuffix: 'SENSITIVE', price: 89.99, stock: 30, sortOrder: 40, attributes: { skinType: 'sensitive' } },
            { key: 'combination', nameSuffix: 'Combination Skin', skuSuffix: 'COMBO', price: 79.99, stock: 32, sortOrder: 50, attributes: { skinType: 'combination' } },
          ],
        },
        {
          id: 'prod-006',
          slug: 'yoga-mat-premium',
          name: 'Yoga Mat Premium',
          description: 'Extra thick eco-friendly yoga mat with carrying strap',
          zhName: '環保加厚瑜伽墊',
          zhDescription: '加厚防滑墊配背帶，適合居家訓練',
          categoryId: 'cat-sports',
          variants: [
            { key: 'purple-6mm', nameSuffix: 'Purple 6mm', skuSuffix: 'PUR-6MM', price: 45.99, stock: 45, sortOrder: 10, attributes: { color: 'purple', thickness: '6mm' } },
            { key: 'blue-6mm', nameSuffix: 'Blue 6mm', skuSuffix: 'BLU-6MM', price: 45.99, stock: 40, sortOrder: 20, attributes: { color: 'blue', thickness: '6mm' } },
            { key: 'pink-8mm', nameSuffix: 'Pink 8mm', skuSuffix: 'PNK-8MM', price: 49.99, stock: 35, sortOrder: 30, attributes: { color: 'pink', thickness: '8mm' } },
            { key: 'green-8mm', nameSuffix: 'Green 8mm', skuSuffix: 'GRN-8MM', price: 49.99, stock: 38, sortOrder: 40, attributes: { color: 'green', thickness: '8mm' } },
            { key: 'black-10mm', nameSuffix: 'Black 10mm', skuSuffix: 'BLK-10MM', price: 54.99, stock: 30, sortOrder: 50, attributes: { color: 'black', thickness: '10mm' } },
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
          storeId: defaultStore.id,
        },
        create: {
          id: prod.id,
          name: prod.name,
          slug: prod.slug,
          description: prod.description,
          categoryId: actualCategoryId,
          storeId: defaultStore.id,
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
            baseStock: variant.stock,
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
            baseStock: variant.stock,
            skuCode: `SKU-${prod.id.toUpperCase()}-${variant.skuSuffix}`,
            sortOrder: variant.sortOrder ?? 0,
            isActive: true,
            attributes: variant.attributes ?? null,
          },
        });
      }

      // Create product translations (en, zh-Hant)
      await prisma.productTranslation.upsert({
        where: { productId_locale: { productId: prod.id, locale: 'en' } },
        update: { name: prod.name, description: prod.description },
        create: { productId: prod.id, locale: 'en', name: prod.name, description: prod.description },
      });
      await prisma.productTranslation.upsert({
        where: { productId_locale: { productId: prod.id, locale: 'zh-Hant' } },
        update: { name: prod.zhName, description: prod.zhDescription },
        create: { productId: prod.id, locale: 'zh-Hant', name: prod.zhName, description: prod.zhDescription },
      });
    }
    console.log(`✅ Created ${sampleProducts.length} sample products`);

    // 5) Create installed themes (metadata) - REMOVED for Open Source compliance (only builtin default)
    console.log('🎨 Installed themes skipped (using builtin default only)...');

    // 6) Create a sample cart with items
    console.log('🛒 Creating sample cart...');
    const cart = await prisma.cart.upsert({
      where: { userId: sampleUser.id },
      update: { status: 'ACTIVE' },
      create: { userId: sampleUser.id, status: 'ACTIVE' },
    });

    const cartItems = [
      { id: 'cartitem-001', productId: 'prod-001', variantId: 'var-prod-001-black', quantity: 1, price: 199.99 },
      { id: 'cartitem-002', productId: 'prod-003', variantId: 'var-prod-003-white-m', quantity: 2, price: 29.99 },
    ] as const;

    for (const item of cartItems) {
      await prisma.cartItem.upsert({
        where: { id: item.id },
        update: { cartId: cart.id, productId: item.productId, variantId: item.variantId, quantity: item.quantity, price: item.price },
        create: { id: item.id, cartId: cart.id, productId: item.productId, variantId: item.variantId, quantity: item.quantity, price: item.price },
      });
    }
    console.log(`✅ Cart created with ${cartItems.length} items`);

    // 7) Create demo orders (one shipped, one refunded)
    console.log('📦 Creating demo orders...');
    const demoShippingAddress = {
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1-555-0100',
      email: sampleUser.email,
      addressLine1: '123 Demo Street',
      addressLine2: 'Apt 4B',
      city: 'San Francisco',
      state: 'CA',
      country: 'US',
      postalCode: '94105',
    };

    // Order 001 (paid + shipped)
    await prisma.order.upsert({
      where: { id: 'cmlm24wtk0001vx08ishhwclg' },
      update: {
        userId: sampleUser.id,
        storeId: defaultStore.id,
        status: 'SHIPPED',
        paymentStatus: 'PAID',
        subtotalAmount: 189.99,
        discountAmount: 0,
        taxAmount: 10,
        totalAmount: 199.99,
        customerEmail: sampleUser.email,
        lastPaymentMethod: 'mock',
      },
      create: {
        id: 'cmlm24wtk0001vx08ishhwclg',
        userId: sampleUser.id,
        storeId: defaultStore.id,
        status: 'SHIPPED',
        paymentStatus: 'PAID',
        subtotalAmount: 189.99,
        discountAmount: 0,
        taxAmount: 10,
        totalAmount: 199.99,
        customerEmail: sampleUser.email,
        lastPaymentMethod: 'mock',
      },
    });

    await prisma.orderShippingAddress.upsert({
      where: { orderId: 'cmlm24wtk0001vx08ishhwclg' },
      update: demoShippingAddress,
      create: {
        orderId: 'cmlm24wtk0001vx08ishhwclg',
        ...demoShippingAddress,
      },
    });

    await prisma.orderItem.upsert({
      where: { id: 'orderitem-001' },
      update: { orderId: 'cmlm24wtk0001vx08ishhwclg', productId: 'prod-001', variantId: 'var-prod-001-black', quantity: 1, unitPrice: 199.99, fulfillmentStatus: 'shipped' },
      create: { id: 'orderitem-001', orderId: 'cmlm24wtk0001vx08ishhwclg', productId: 'prod-001', variantId: 'var-prod-001-black', quantity: 1, unitPrice: 199.99, fulfillmentStatus: 'shipped' },
    });

    await prisma.payment.upsert({
      where: { id: 'pay-001' },
      update: { orderId: 'cmlm24wtk0001vx08ishhwclg', paymentMethod: 'mock', amount: 199.99, currency: 'USD', status: 'SUCCEEDED', attemptNumber: 1 },
      create: { id: 'pay-001', orderId: 'cmlm24wtk0001vx08ishhwclg', paymentMethod: 'mock', amount: 199.99, currency: 'USD', status: 'SUCCEEDED', attemptNumber: 1 },
    });

    await prisma.inventoryReservation.upsert({
      where: { id: 'invres-001' },
      update: { orderId: 'cmlm24wtk0001vx08ishhwclg', productId: 'prod-001', variantId: 'var-prod-001-black', quantity: 1, status: 'ACTIVE', expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
      create: { id: 'invres-001', orderId: 'cmlm24wtk0001vx08ishhwclg', productId: 'prod-001', variantId: 'var-prod-001-black', quantity: 1, status: 'ACTIVE', expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });

    await prisma.shipment.upsert({
      where: { id: 'ship-001' },
      update: { orderId: 'cmlm24wtk0001vx08ishhwclg', carrier: 'UPS', trackingNumber: '1Z999AA10123456784', status: 'SHIPPED', shippedAt: new Date() },
      create: { id: 'ship-001', orderId: 'cmlm24wtk0001vx08ishhwclg', carrier: 'UPS', trackingNumber: '1Z999AA10123456784', status: 'SHIPPED', shippedAt: new Date() },
    });

    await prisma.shipmentItem.upsert({
      where: { id: 'shipitem-001' },
      update: { shipmentId: 'ship-001', orderItemId: 'orderitem-001', quantity: 1 },
      create: { id: 'shipitem-001', shipmentId: 'ship-001', orderItemId: 'orderitem-001', quantity: 1 },
    });

    // Order 002 (paid + refunded)
    await prisma.order.upsert({
      where: { id: 'cmlm25xyk0002vx08jkppqwmn' },
      update: {
        userId: sampleUser.id,
        storeId: defaultStore.id,
        status: 'REFUNDED',
        paymentStatus: 'REFUNDED',
        subtotalAmount: 59.98,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 59.98,
        customerEmail: sampleUser.email,
        lastPaymentMethod: 'mock',
        cancelReason: 'Demo refund scenario',
        cancelledAt: new Date(),
      },
      create: {
        id: 'cmlm25xyk0002vx08jkppqwmn',
        userId: sampleUser.id,
        storeId: defaultStore.id,
        status: 'REFUNDED',
        paymentStatus: 'REFUNDED',
        subtotalAmount: 59.98,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 59.98,
        customerEmail: sampleUser.email,
        lastPaymentMethod: 'mock',
        cancelReason: 'Demo refund scenario',
        cancelledAt: new Date(),
      },
    });

    await prisma.orderShippingAddress.upsert({
      where: { orderId: 'cmlm25xyk0002vx08jkppqwmn' },
      update: demoShippingAddress,
      create: {
        orderId: 'cmlm25xyk0002vx08jkppqwmn',
        ...demoShippingAddress,
      },
    });

    await prisma.orderItem.upsert({
      where: { id: 'orderitem-002' },
      update: { orderId: 'cmlm25xyk0002vx08jkppqwmn', productId: 'prod-003', variantId: 'var-prod-003-white-m', quantity: 2, unitPrice: 29.99, fulfillmentStatus: 'pending' },
      create: { id: 'orderitem-002', orderId: 'cmlm25xyk0002vx08jkppqwmn', productId: 'prod-003', variantId: 'var-prod-003-white-m', quantity: 2, unitPrice: 29.99, fulfillmentStatus: 'pending' },
    });

    await prisma.payment.upsert({
      where: { id: 'pay-002' },
      update: { orderId: 'cmlm25xyk0002vx08jkppqwmn', paymentMethod: 'mock', amount: 59.98, currency: 'USD', status: 'SUCCEEDED', attemptNumber: 1 },
      create: { id: 'pay-002', orderId: 'cmlm25xyk0002vx08jkppqwmn', paymentMethod: 'mock', amount: 59.98, currency: 'USD', status: 'SUCCEEDED', attemptNumber: 1 },
    });

    await prisma.refund.upsert({
      where: { id: 'refund-001' },
      update: { paymentId: 'pay-002', orderId: 'cmlm25xyk0002vx08jkppqwmn', amount: 59.98, currency: 'USD', status: 'COMPLETED', provider: 'mock', providerRefundId: 're_0000000001', idempotencyKey: 'refund-order-002' },
      create: { id: 'refund-001', paymentId: 'pay-002', orderId: 'cmlm25xyk0002vx08jkppqwmn', amount: 59.98, currency: 'USD', status: 'COMPLETED', provider: 'mock', providerRefundId: 're_0000000001', idempotencyKey: 'refund-order-002' },
    });

    await prisma.inventoryReservation.upsert({
      where: { id: 'invres-002' },
      update: { orderId: 'cmlm25xyk0002vx08jkppqwmn', productId: 'prod-003', variantId: 'var-prod-003-white-m', quantity: 2, status: 'RELEASED', expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
      create: { id: 'invres-002', orderId: 'cmlm25xyk0002vx08jkppqwmn', productId: 'prod-003', variantId: 'var-prod-003-white-m', quantity: 2, status: 'RELEASED', expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });

    console.log('✅ Demo orders created');

    // 8) Create warehouses for multi-warehouse inventory management
    console.log('🏭 Creating warehouses...');
    const warehouses = [
      {
        id: 'warehouse-main',
        name: 'Main Warehouse',
        code: 'MAIN',
        address: '123 Main St, City, Country',
        isActive: true,
        isDefault: true,
      },
      {
        id: 'warehouse-west',
        name: 'West Coast Warehouse',
        code: 'WEST',
        address: '456 West Ave, City, Country',
        isActive: true,
        isDefault: false,
      },
      {
        id: 'warehouse-east',
        name: 'East Coast Warehouse',
        code: 'EAST',
        address: '789 East Blvd, City, Country',
        isActive: true,
        isDefault: false,
      },
    ];

    const warehouseRecords = [];
    for (const warehouse of warehouses) {
      const warehouseRecord = await prisma.warehouse.upsert({
        where: { code: warehouse.code },
        update: { name: warehouse.name, address: warehouse.address, isActive: warehouse.isActive, isDefault: warehouse.isDefault },
        create: warehouse,
      });
      warehouseRecords.push(warehouseRecord);
    }
    console.log(`✅ Created ${warehouseRecords.length} warehouses`);

    // 9) Create multi-warehouse inventory for existing products
    console.log('📊 Creating warehouse inventory...');
    const variants = await prisma.productVariant.findMany({
      select: { id: true, skuCode: true, productId: true },
      orderBy: [{ productId: 'asc' }, { id: 'asc' }],
    });

    let inventoryCount = 0;
    for (const [index, variant] of variants.entries()) {
      const status = getInventoryStatusForProduct(inventoryProfile, variant.productId);

      const mainInventory = buildWarehouseInventorySeed(inventoryProfile, status, 'MAIN', index);
      await prisma.warehouseInventory.upsert({
        where: {
          warehouseId_variantId: {
            warehouseId: warehouseRecords[0].id,
            variantId: variant.id,
          },
        },
        update: mainInventory,
        create: {
          warehouseId: warehouseRecords[0].id,
          variantId: variant.id,
          ...mainInventory,
        },
      });
      inventoryCount++;

      const westInventory = buildWarehouseInventorySeed(inventoryProfile, status, 'WEST', index);
      await prisma.warehouseInventory.upsert({
        where: {
          warehouseId_variantId: {
            warehouseId: warehouseRecords[1].id,
            variantId: variant.id,
          },
        },
        update: westInventory,
        create: {
          warehouseId: warehouseRecords[1].id,
          variantId: variant.id,
          ...westInventory,
        },
      });
      inventoryCount++;

      const eastInventory = buildWarehouseInventorySeed(inventoryProfile, status, 'EAST', index);
      await prisma.warehouseInventory.upsert({
        where: {
          warehouseId_variantId: {
            warehouseId: warehouseRecords[2].id,
            variantId: variant.id,
          },
        },
        update: eastInventory,
        create: {
          warehouseId: warehouseRecords[2].id,
          variantId: variant.id,
          ...eastInventory,
        },
      });
      inventoryCount++;
    }
    console.log(`✅ Created ${inventoryCount} warehouse inventory records`);

    // 10) Create sample inventory adjustments (audit trail)
    console.log('📝 Creating inventory adjustments...');
    const sampleVariants = variants.slice(0, 3);
    let adjustmentCount = 0;

    for (const variant of sampleVariants) {
      // Initial stock adjustment for main warehouse
      await prisma.inventoryAdjustment.create({
        data: {
          warehouseId: warehouseRecords[0].id,
          variantId: variant.id,
          type: 'initial',
          quantity: 100,
          reason: 'Initial stock',
          notes: 'Setting up initial inventory',
          userId: admin.id,
        },
      });
      adjustmentCount++;

      // Damage adjustment for west warehouse
      await prisma.inventoryAdjustment.create({
        data: {
          warehouseId: warehouseRecords[1].id,
          variantId: variant.id,
          type: 'damage',
          quantity: -5,
          reason: 'Damaged during shipping',
          notes: 'Items damaged, removed from inventory',
          userId: admin.id,
        },
      });
      adjustmentCount++;
    }
    console.log(`✅ Created ${adjustmentCount} inventory adjustments`);

    // 11) Create sample inventory transfers
    console.log('🚚 Creating inventory transfers...');
    const transferVariants = variants.slice(0, 2);

    // Completed transfer: Main -> West
    await prisma.inventoryTransfer.create({
      data: {
        fromWarehouseId: warehouseRecords[0].id,
        toWarehouseId: warehouseRecords[1].id,
        variantId: transferVariants[0].id,
        quantity: 20,
        status: 'COMPLETED',
        reason: 'Rebalancing stock levels',
        notes: 'Stock rebalancing between warehouses',
        userId: admin.id,
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    });

    // Pending transfer: West -> East
    await prisma.inventoryTransfer.create({
      data: {
        fromWarehouseId: warehouseRecords[1].id,
        toWarehouseId: warehouseRecords[2].id,
        variantId: transferVariants[1].id,
        quantity: 15,
        status: 'PENDING',
        reason: 'Replenishing east coast inventory',
        notes: 'Awaiting approval',
        userId: admin.id,
      },
    });

    // In-transit transfer: Main -> East
    await prisma.inventoryTransfer.create({
      data: {
        fromWarehouseId: warehouseRecords[0].id,
        toWarehouseId: warehouseRecords[2].id,
        variantId: transferVariants[0].id,
        quantity: 10,
        status: 'IN_TRANSIT',
        reason: 'Emergency restock',
        notes: 'Urgent transfer for low stock items',
        userId: admin.id,
      },
    });
    console.log('✅ Created 3 inventory transfers');

    // 12) Create sample stock alerts
    console.log('⚠️ Creating stock alerts...');
    const lowStockVariants = variants.slice(0, 4);

    // Active LOW_STOCK alert for East warehouse
    await prisma.stockAlert.create({
      data: {
        warehouseId: warehouseRecords[2].id,
        variantId: lowStockVariants[0].id,
        alertType: 'LOW_STOCK',
        threshold: 10,
        quantity: 5,
        status: 'ACTIVE',
      },
    });

    // Active OUT_OF_STOCK alert for East warehouse
    await prisma.stockAlert.create({
      data: {
        warehouseId: warehouseRecords[2].id,
        variantId: lowStockVariants[1].id,
        alertType: 'OUT_OF_STOCK',
        threshold: 10,
        quantity: 0,
        status: 'ACTIVE',
      },
    });

    // Resolved LOW_STOCK alert for West warehouse
    await prisma.stockAlert.create({
      data: {
        warehouseId: warehouseRecords[1].id,
        variantId: lowStockVariants[2].id,
        alertType: 'LOW_STOCK',
        threshold: 15,
        quantity: 12,
        status: 'RESOLVED',
        resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    });

    // Active RESTOCK_NEEDED alert for Main warehouse
    await prisma.stockAlert.create({
      data: {
        warehouseId: warehouseRecords[0].id,
        variantId: lowStockVariants[3].id,
        alertType: 'RESTOCK_NEEDED',
        threshold: 20,
        quantity: 18,
        status: 'ACTIVE',
      },
    });
    console.log('✅ Created 4 stock alerts');

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - System settings initialized');
    console.log('   - Admin: admin@jiffoo.com / admin123');
    console.log('   - Sample user: user@jiffoo.com / admin123');
    console.log(`   - ${sampleProducts.length} sample products created`);
    console.log('   - 5 categories created');
    console.log('   - Variants and product translations created');
    console.log('   - Themes installed (active/previous stored in SystemSettings)');
    console.log('   - Cart + demo orders created');
    console.log(`   - ${warehouseRecords.length} warehouses created`);
    console.log(`   - ${inventoryCount} warehouse inventory records created`);
    console.log(`   - ${adjustmentCount} inventory adjustments created`);
    console.log('   - 3 inventory transfers created');
    console.log('   - 4 stock alerts created');

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
