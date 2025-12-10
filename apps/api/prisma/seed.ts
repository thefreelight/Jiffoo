import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';

// Load environment variables
config({ path: '../../.env' });

const prisma = new PrismaClient();

/**
 * 🏪 单商户开源版本 Seed 脚本
 * 
 * 这是完全移除 tenantId 后的简化版本。
 * 所有数据都是全局的，无需租户隔离。
 */

// 初始化插件系统
async function initializePluginSystem() {
  console.log('🔌 Creating core plugins...');

  // Stripe Payment Plugin
  const stripePlugin = await prisma.plugin.upsert({
    where: { slug: 'stripe' },
    update: { name: 'Stripe Payment Plugin', status: 'ACTIVE' },
    create: {
      slug: 'stripe',
      name: 'Stripe Payment Plugin',
      description: 'Integrate Stripe payment functionality',
      category: 'payment',
      version: '1.0.0',
      status: 'ACTIVE',
    }
  });
  console.log(`✅ Stripe plugin created`);

  // Resend Email Plugin
  await prisma.plugin.upsert({
    where: { slug: 'resend' },
    update: { name: 'Resend Email', status: 'ACTIVE' },
    create: {
      slug: 'resend',
      name: 'Resend Email',
      description: 'Modern email API service',
      category: 'email',
      version: '1.0.0',
      status: 'ACTIVE',
    }
  });
  console.log(`✅ Resend Email plugin created`);

  // Google OAuth Plugin
  await prisma.plugin.upsert({
    where: { slug: 'google' },
    update: { name: 'Google OAuth', status: 'ACTIVE' },
    create: {
      slug: 'google',
      name: 'Google OAuth',
      description: 'Enable Google Sign-In for your users',
      category: 'authentication',
      version: '1.0.0',
      status: 'ACTIVE',
    }
  });
  console.log(`✅ Google OAuth plugin created`);

  return stripePlugin;
}

// 初始化订阅计划
async function initializeSubscriptionPlans(stripePlugin: any) {
  console.log('📋 Creating subscription plans...');

  const plans = [
    { planId: 'free', name: 'Free Plan', amount: 0, features: ['basic_payments'] },
    { planId: 'business', name: 'Business Plan', amount: 29, features: ['basic_payments', 'subscriptions', 'refunds'] },
    { planId: 'enterprise', name: 'Enterprise Plan', amount: 99, features: ['all_features'] },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { pluginId_planId: { pluginId: stripePlugin.id, planId: plan.planId } },
      update: { name: plan.name, amount: plan.amount },
      create: {
        pluginId: stripePlugin.id,
        planId: plan.planId,
        name: plan.name,
        description: `${plan.name} for Stripe`,
        amount: plan.amount,
        currency: 'USD',
        billingCycle: 'monthly',
        features: JSON.stringify(plan.features),
        limits: JSON.stringify({ transactions: plan.planId === 'enterprise' ? -1 : 100 }),
        isActive: true,
        isPublic: true,
        sortOrder: plans.indexOf(plan) + 1,
      }
    });
    console.log(`✅ Subscription plan: ${plan.name}`);
  }
}

async function main() {
  try {
    console.log('🌱 Starting database seeding (Single-Tenant Mode)...');

    // 1. 初始化系统设置
    console.log('⚙️ Initializing system settings...');
    await prisma.systemSettings.upsert({
      where: { id: 'system' },
      update: { isInstalled: true },
      create: {
        id: 'system',
        isInstalled: true,
        siteName: 'Jiffoo Mall',
        siteDescription: '开源电商平台',
        allowRegistration: true,
        requireEmailVerification: false,
        maintenanceMode: false,
        version: '1.0.0',
      },
    });
    console.log('✅ System settings initialized');

    // 2. 创建管理员用户
    console.log('👤 Creating admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // 管理员账号 (Admin 和 Super Admin 后台都使用)
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

    // 3. 创建示例普通用户
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

    // 4. 创建示例商品
    console.log('📦 Creating sample products...');
    // 使用 picsum.photos - 全球可访问的图片服务
    const sampleProducts = [
      { id: 'prod-001', name: 'Wireless Bluetooth Headphones', description: 'Premium noise-cancelling wireless headphones with 30-hour battery life', price: 199.99, stock: 50, category: 'electronics', images: JSON.stringify(['https://picsum.photos/seed/headphones/400/400']) },
      { id: 'prod-002', name: 'Smart Watch Pro', description: 'Advanced fitness tracking with heart rate monitor and GPS', price: 299.99, stock: 30, category: 'electronics', images: JSON.stringify(['https://picsum.photos/seed/smartwatch/400/400']) },
      { id: 'prod-003', name: 'Classic Cotton T-Shirt', description: 'Comfortable 100% organic cotton t-shirt, available in multiple colors', price: 29.99, stock: 200, category: 'clothing', images: JSON.stringify(['https://picsum.photos/seed/tshirt/400/400']) },
      { id: 'prod-004', name: 'Denim Jacket', description: 'Vintage-style denim jacket with modern fit', price: 89.99, stock: 75, category: 'clothing', images: JSON.stringify(['https://picsum.photos/seed/jacket/400/400']) },
      { id: 'prod-005', name: 'Minimalist Desk Lamp', description: 'LED desk lamp with adjustable brightness and color temperature', price: 49.99, stock: 100, category: 'home', images: JSON.stringify(['https://picsum.photos/seed/lamp/400/400']) },
      { id: 'prod-006', name: 'Ceramic Plant Pot Set', description: 'Set of 3 modern ceramic pots for indoor plants', price: 39.99, stock: 80, category: 'home', images: JSON.stringify(['https://picsum.photos/seed/plantpot/400/400']) },
      { id: 'prod-007', name: 'Natural Skincare Set', description: 'Complete skincare routine with cleanser, toner, and moisturizer', price: 79.99, stock: 60, category: 'beauty', images: JSON.stringify(['https://picsum.photos/seed/skincare/400/400']) },
      { id: 'prod-008', name: 'Organic Lip Balm Collection', description: 'Set of 5 organic lip balms with natural flavors', price: 24.99, stock: 150, category: 'beauty', images: JSON.stringify(['https://picsum.photos/seed/lipbalm/400/400']) },
      { id: 'prod-009', name: 'Yoga Mat Premium', description: 'Extra thick eco-friendly yoga mat with carrying strap', price: 45.99, stock: 90, category: 'sports', images: JSON.stringify(['https://picsum.photos/seed/yogamat/400/400']) },
      { id: 'prod-010', name: 'Resistance Bands Set', description: 'Complete set of 5 resistance bands for home workouts', price: 34.99, stock: 120, category: 'sports', images: JSON.stringify(['https://picsum.photos/seed/bands/400/400']) },
    ];

    for (const prod of sampleProducts) {
      await prisma.product.upsert({
        where: { id: prod.id },
        update: { price: prod.price, stock: prod.stock },
        create: prod,
      });

      // Create default variant for each product
      const variantId = `var-${prod.id}`;
      await prisma.productVariant.upsert({
        where: { id: variantId },
        update: { basePrice: prod.price, baseStock: prod.stock },
        create: {
          id: variantId,
          name: `${prod.name} - Default`,
          productId: prod.id,
          skuCode: `SKU-${prod.id.toUpperCase()}`,
          basePrice: prod.price,
          baseStock: prod.stock,
          isActive: true,
          attributes: JSON.stringify({ default: true }),
        },
      });
    }
    console.log(`✅ Created ${sampleProducts.length} sample products`);

    // 5. 初始化插件系统
    const stripePlugin = await initializePluginSystem();

    // 6. 初始化订阅计划
    await initializeSubscriptionPlans(stripePlugin);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - System settings initialized');
    console.log('   - Admin: admin@jiffoo.com / admin123 (Admin 和 Super Admin 后台)');
    console.log('   - Sample user: user@jiffoo.com / admin123');
    console.log('   - 10 sample products created');
    console.log('   - Plugin system initialized');

  } catch (error) {
    console.error('❌ Seed error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
