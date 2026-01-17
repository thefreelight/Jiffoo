import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';

// Load environment variables
config({ path: '../../.env' });

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

async function main() {
  try {
    console.log('🌱 Starting database seeding (Standalone Mode)...');

    // 1) Initialize system settings (including theme rollback state)
    console.log('⚙️ Initializing system settings...');
    const themeSettings = {
      theme: {
        active: { shop: { slug: 'default-shop' }, admin: { slug: 'default-admin' } },
        previous: { shop: { slug: 'classic-shop' }, admin: { slug: 'default-admin' } },
        config: { shop: {}, admin: {} },
      },
    };
    await prisma.systemSettings.upsert({
      where: { id: 'system' },
      update: { isInstalled: true, settings: JSON.stringify(themeSettings) },
      create: {
        id: 'system',
        isInstalled: true,
        siteName: 'Jiffoo Mall',
        siteDescription: '現代電子商務平台',
        allowRegistration: true,
        requireEmailVerification: false,
        maintenanceMode: false,
        version: '1.0.0',
        settings: JSON.stringify(themeSettings),
      },
    });
    console.log('✅ System settings initialized');

    // 2) Create users
    console.log('👤 Creating admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Admin user (for Admin UI)
    const admin = await prisma.user.upsert({
      where: { email: 'admin@jiffoo.com' },
      update: { role: 'ADMIN', password: hashedPassword },
      create: {
        email: 'admin@jiffoo.com',
        username: 'admin',
        password: hashedPassword,
        role: 'ADMIN',
        avatar: 'https://i.pravatar.cc/100?u=admin',
      },
    });
    console.log(`✅ Admin user created: ${admin.email}`);

    // Sample shopper user (for Shop UI)
    console.log('👤 Creating sample user...');
    const sampleUser = await prisma.user.upsert({
      where: { email: 'user@jiffoo.com' },
      update: { role: 'USER', password: hashedPassword },
      create: {
        email: 'user@jiffoo.com',
        username: 'sample-user',
        password: hashedPassword,
        role: 'USER',
        avatar: 'https://i.pravatar.cc/100?u=user',
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

    for (const category of categories) {
      await prisma.category.upsert({
        where: { id: category.id },
        update: { name: category.name, slug: category.slug, description: category.description, level: category.level, sortOrder: category.sortOrder },
        create: category,
      });
    }
    console.log(`✅ Created ${categories.length} categories`);

    // 4) Create products + default variants + translations
    console.log('📦 Creating sample products...');
    const sampleProducts: Array<{
      id: string;
      slug: string;
      name: string;
      description: string;
      zhName: string;
      zhDescription: string;
      categoryId: string;
      variant: { price: number; stock: number };
      extraVariants?: Array<{
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
          zhName: '無線藍牙降噪耳機',
          zhDescription: '高端無線降噪耳機，續航可達 30 小時',
          categoryId: 'cat-electronics',
          variant: { price: 199.99, stock: 50 },
        },
        {
          id: 'prod-002',
          slug: 'smart-watch-pro',
          name: 'Smart Watch Pro',
          description: 'Advanced fitness tracking with heart rate monitor and GPS',
          zhName: '智能手錶 Pro',
          zhDescription: '支持心率監測與 GPS 的高級運動追蹤手錶',
          categoryId: 'cat-electronics',
          variant: { price: 299.99, stock: 30 },
          extraVariants: [
            { key: 'strap-sport', nameSuffix: 'Sport Strap', skuSuffix: 'SPORT', price: 299.99, stock: 12, sortOrder: 10, attributes: { strap: 'sport' } },
            { key: 'strap-leather', nameSuffix: 'Leather Strap', skuSuffix: 'LEATHER', price: 319.99, stock: 8, sortOrder: 20, attributes: { strap: 'leather' } },
            { key: 'strap-metal', nameSuffix: 'Metal Strap', skuSuffix: 'METAL', price: 339.99, stock: 10, sortOrder: 30, attributes: { strap: 'metal' } },
          ],
        },
        {
          id: 'prod-003',
          slug: 'classic-cotton-t-shirt',
          name: 'Classic Cotton T-Shirt',
          description: 'Comfortable 100% organic cotton t-shirt, available in multiple colors',
          zhName: '經典純棉 T 恤',
          zhDescription: '100% 有機棉，舒適透氣，多色可選',
          categoryId: 'cat-clothing',
          variant: { price: 29.99, stock: 200 },
          extraVariants: [
            { key: 'size-s', nameSuffix: 'Size S', skuSuffix: 'S', price: 29.99, stock: 60, sortOrder: 10, attributes: { size: 'S' } },
            { key: 'size-m', nameSuffix: 'Size M', skuSuffix: 'M', price: 29.99, stock: 80, sortOrder: 20, attributes: { size: 'M' } },
            { key: 'size-l', nameSuffix: 'Size L', skuSuffix: 'L', price: 29.99, stock: 60, sortOrder: 30, attributes: { size: 'L' } },
          ],
        },
        {
          id: 'prod-004',
          slug: 'minimalist-desk-lamp',
          name: 'Minimalist Desk Lamp',
          description: 'LED desk lamp with adjustable brightness and color temperature',
          zhName: '極簡桌面檯燈',
          zhDescription: 'LED 檯燈，支持亮度與色溫調節',
          categoryId: 'cat-home',
          variant: { price: 49.99, stock: 100 },
        },
        {
          id: 'prod-005',
          slug: 'natural-skincare-set',
          name: 'Natural Skincare Set',
          description: 'Complete skincare routine with cleanser, toner, and moisturizer',
          zhName: '天然護膚套裝',
          zhDescription: '潔面 + 爽膚水 + 面霜，完整護膚流程',
          categoryId: 'cat-beauty',
          variant: { price: 79.99, stock: 60 },
        },
        {
          id: 'prod-006',
          slug: 'yoga-mat-premium',
          name: 'Yoga Mat Premium',
          description: 'Extra thick eco-friendly yoga mat with carrying strap',
          zhName: '環保加厚瑜伽墊',
          zhDescription: '加厚防滑，附背帶，適合居家訓練',
          categoryId: 'cat-sports',
          variant: { price: 45.99, stock: 90 },
        },
      ];

    for (const prod of sampleProducts) {
      const variant = prod.variant;
      await prisma.product.upsert({
        where: { id: prod.id },
        update: { name: prod.name, slug: prod.slug, description: prod.description, categoryId: prod.categoryId },
        create: { id: prod.id, name: prod.name, slug: prod.slug, description: prod.description, categoryId: prod.categoryId },
      });

      // Create default SKU (single source of truth for price/stock)
      const variantId = `var-${prod.id}`;
      await prisma.productVariant.upsert({
        where: { id: variantId },
        update: { basePrice: variant.price, baseStock: variant.stock, isDefault: true },
        create: {
          id: variantId,
          name: `${prod.name} - Default`,
          productId: prod.id,
          skuCode: `SKU-${prod.id.toUpperCase()}`,
          basePrice: variant.price,
          baseStock: variant.stock,
          isActive: true,
          isDefault: true,
          attributes: JSON.stringify({ default: true }),
        },
      });

      // Create additional SKUs for selected demo products
      for (const extraVariant of prod.extraVariants ?? []) {
        const extraVariantId = `var-${prod.id}-${extraVariant.key}`;
        await prisma.productVariant.upsert({
          where: { id: extraVariantId },
          update: {
            name: `${prod.name} - ${extraVariant.nameSuffix}`,
            basePrice: extraVariant.price,
            baseStock: extraVariant.stock,
            skuCode: `SKU-${prod.id.toUpperCase()}-${extraVariant.skuSuffix}`,
            sortOrder: extraVariant.sortOrder ?? 0,
            isActive: true,
            isDefault: false,
            attributes: extraVariant.attributes ? JSON.stringify(extraVariant.attributes) : null,
          },
          create: {
            id: extraVariantId,
            productId: prod.id,
            name: `${prod.name} - ${extraVariant.nameSuffix}`,
            basePrice: extraVariant.price,
            baseStock: extraVariant.stock,
            skuCode: `SKU-${prod.id.toUpperCase()}-${extraVariant.skuSuffix}`,
            sortOrder: extraVariant.sortOrder ?? 0,
            isActive: true,
            isDefault: false,
            attributes: extraVariant.attributes ? JSON.stringify(extraVariant.attributes) : null,
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

    // 5) Create installed themes (metadata) + rely on SystemSettings for active/previous
    console.log('🎨 Creating installed themes...');
    const themes = [
      { slug: 'default-shop', target: 'shop', name: 'Default Shop Theme', version: '1.0.0', author: 'Jiffoo', description: 'Default storefront theme', source: 'local-zip', installPath: 'extensions/themes/default-shop', isActive: true },
      { slug: 'classic-shop', target: 'shop', name: 'Classic Shop Theme', version: '1.0.0', author: 'Jiffoo', description: 'Classic storefront theme (previous)', source: 'local-zip', installPath: 'extensions/themes/classic-shop', isActive: false },
      { slug: 'default-admin', target: 'admin', name: 'Default Admin Theme', version: '1.0.0', author: 'Jiffoo', description: 'Default admin theme', source: 'local-zip', installPath: 'extensions/themes/default-admin', isActive: true },
    ] as const;

    for (const theme of themes) {
      await prisma.installedTheme.upsert({
        where: { slug: theme.slug },
        update: {
          target: theme.target,
          name: theme.name,
          version: theme.version,
          author: theme.author,
          description: theme.description,
          source: theme.source,
          installPath: theme.installPath,
          isActive: theme.isActive,
        },
        create: {
          slug: theme.slug,
          target: theme.target,
          name: theme.name,
          version: theme.version,
          author: theme.author,
          description: theme.description,
          source: theme.source,
          installPath: theme.installPath,
          isActive: theme.isActive,
        },
      });
    }
    console.log(`✅ Created ${themes.length} installed themes`);

    // 6) Create a sample cart with items
    console.log('🛒 Creating sample cart...');
    const cart = await prisma.cart.upsert({
      where: { userId: sampleUser.id },
      update: { status: 'ACTIVE' },
      create: { userId: sampleUser.id, status: 'ACTIVE' },
    });

    const cartItems = [
      { id: 'cartitem-001', productId: 'prod-001', variantId: 'var-prod-001', quantity: 1, price: 199.99 },
      { id: 'cartitem-002', productId: 'prod-003', variantId: 'var-prod-003', quantity: 2, price: 29.99 },
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
    await prisma.orderAddress.upsert({
      where: { id: 'addr-001' },
      update: {},
      create: {
        id: 'addr-001',
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
      },
    });

    // Order 001 (paid + shipped)
    await prisma.order.upsert({
      where: { id: 'order-001' },
      update: {
        userId: sampleUser.id,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        totalAmount: 199.99,
        customerEmail: sampleUser.email,
        shippingAddressId: 'addr-001',
        lastPaymentMethod: 'stripe',
      },
      create: {
        id: 'order-001',
        userId: sampleUser.id,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        totalAmount: 199.99,
        customerEmail: sampleUser.email,
        shippingAddressId: 'addr-001',
        lastPaymentMethod: 'stripe',
      },
    });

    await prisma.orderItem.upsert({
      where: { id: 'orderitem-001' },
      update: { orderId: 'order-001', productId: 'prod-001', variantId: 'var-prod-001', quantity: 1, unitPrice: 199.99, fulfillmentStatus: 'shipped' },
      create: { id: 'orderitem-001', orderId: 'order-001', productId: 'prod-001', variantId: 'var-prod-001', quantity: 1, unitPrice: 199.99, fulfillmentStatus: 'shipped' },
    });

    await prisma.payment.upsert({
      where: { id: 'pay-001' },
      update: { orderId: 'order-001', paymentMethod: 'stripe', amount: 199.99, currency: 'USD', status: 'SUCCEEDED', attemptNumber: 1 },
      create: { id: 'pay-001', orderId: 'order-001', paymentMethod: 'stripe', amount: 199.99, currency: 'USD', status: 'SUCCEEDED', attemptNumber: 1 },
    });

    await prisma.inventoryReservation.upsert({
      where: { id: 'invres-001' },
      update: { orderId: 'order-001', productId: 'prod-001', variantId: 'var-prod-001', quantity: 1, status: 'CONFIRMED', expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
      create: { id: 'invres-001', orderId: 'order-001', productId: 'prod-001', variantId: 'var-prod-001', quantity: 1, status: 'CONFIRMED', expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });

    await prisma.shipment.upsert({
      where: { id: 'ship-001' },
      update: { orderId: 'order-001', carrier: 'UPS', trackingNumber: '1Z999AA10123456784', status: 'SHIPPED', shippedAt: new Date() },
      create: { id: 'ship-001', orderId: 'order-001', carrier: 'UPS', trackingNumber: '1Z999AA10123456784', status: 'SHIPPED', shippedAt: new Date() },
    });

    await prisma.shipmentItem.upsert({
      where: { id: 'shipitem-001' },
      update: { shipmentId: 'ship-001', orderItemId: 'orderitem-001', quantity: 1 },
      create: { id: 'shipitem-001', shipmentId: 'ship-001', orderItemId: 'orderitem-001', quantity: 1 },
    });

    // Order 002 (paid + refunded)
    await prisma.order.upsert({
      where: { id: 'order-002' },
      update: {
        userId: sampleUser.id,
        status: 'CANCELLED',
        paymentStatus: 'REFUNDED',
        totalAmount: 59.98,
        customerEmail: sampleUser.email,
        shippingAddressId: 'addr-001',
        lastPaymentMethod: 'stripe',
        cancelReason: 'Demo refund scenario',
        cancelledAt: new Date(),
      },
      create: {
        id: 'order-002',
        userId: sampleUser.id,
        status: 'CANCELLED',
        paymentStatus: 'REFUNDED',
        totalAmount: 59.98,
        customerEmail: sampleUser.email,
        shippingAddressId: 'addr-001',
        lastPaymentMethod: 'stripe',
        cancelReason: 'Demo refund scenario',
        cancelledAt: new Date(),
      },
    });

    await prisma.orderItem.upsert({
      where: { id: 'orderitem-002' },
      update: { orderId: 'order-002', productId: 'prod-003', variantId: 'var-prod-003', quantity: 2, unitPrice: 29.99, fulfillmentStatus: 'pending' },
      create: { id: 'orderitem-002', orderId: 'order-002', productId: 'prod-003', variantId: 'var-prod-003', quantity: 2, unitPrice: 29.99, fulfillmentStatus: 'pending' },
    });

    await prisma.payment.upsert({
      where: { id: 'pay-002' },
      update: { orderId: 'order-002', paymentMethod: 'stripe', amount: 59.98, currency: 'USD', status: 'SUCCEEDED', attemptNumber: 1 },
      create: { id: 'pay-002', orderId: 'order-002', paymentMethod: 'stripe', amount: 59.98, currency: 'USD', status: 'SUCCEEDED', attemptNumber: 1 },
    });

    await prisma.refund.upsert({
      where: { id: 'refund-001' },
      update: { paymentId: 'pay-002', orderId: 'order-002', amount: 59.98, currency: 'USD', status: 'SUCCEEDED', provider: 'stripe', providerRefundId: 're_0000000001', idempotencyKey: 'refund-order-002' },
      create: { id: 'refund-001', paymentId: 'pay-002', orderId: 'order-002', amount: 59.98, currency: 'USD', status: 'SUCCEEDED', provider: 'stripe', providerRefundId: 're_0000000001', idempotencyKey: 'refund-order-002' },
    });

    await prisma.inventoryReservation.upsert({
      where: { id: 'invres-002' },
      update: { orderId: 'order-002', productId: 'prod-003', variantId: 'var-prod-003', quantity: 2, status: 'RELEASED', expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
      create: { id: 'invres-002', orderId: 'order-002', productId: 'prod-003', variantId: 'var-prod-003', quantity: 2, status: 'RELEASED', expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });
    console.log('✅ Demo orders created');
    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - System settings initialized');
    console.log('   - Admin: admin@jiffoo.com / admin123');
    console.log('   - Sample user: user@jiffoo.com / admin123');
    console.log(`   - ${sampleProducts.length} sample products created`);
    console.log('   - 5 categories created');
    console.log('   - Default variants and product translations created');
    console.log('   - Themes installed (active/previous stored in SystemSettings)');
    console.log('   - Cart + demo orders created');

  } catch (error) {
    console.error('❌ Seed error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
main();
