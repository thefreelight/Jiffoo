import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const adminEmail = 'admin@jiffoo.com';
  const adminPassword = '123456';

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (existingAdmin) {
    console.log('✅ Admin user already exists');
  } else {
    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        username: 'admin',
        password: hashedPassword,
        role: 'ADMIN',
        avatar: null,
      }
    });

    console.log('✅ Created admin user:', {
      id: adminUser.id,
      email: adminUser.email,
      username: adminUser.username,
      role: adminUser.role
    });
  }

  // Create some sample plugins if they don't exist
  const existingStripePlugin = await prisma.pluginInstance.findFirst({
    where: { pluginId: 'stripe-official' }
  });

  if (!existingStripePlugin) {
    await prisma.pluginInstance.create({
      data: {
        pluginId: 'stripe-official',
        version: '1.0.0',
        status: 'ACTIVE',
        config: JSON.stringify({
          secretKey: process.env.STRIPE_SECRET_KEY || '',
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || ''
        }),
        metadata: JSON.stringify({
          name: 'Stripe Payment (Official)',
          category: 'payment',
          description: 'Official Stripe payment integration',
          author: 'Jiffoo Team'
        })
      }
    });
    console.log('✅ Created Stripe plugin instance');
  }

  const existingAlipayPlugin = await prisma.pluginInstance.findFirst({
    where: { pluginId: 'alipay-official' }
  });

  if (!existingAlipayPlugin) {
    await prisma.pluginInstance.create({
      data: {
        pluginId: 'alipay-official',
        version: '1.0.0',
        status: 'ACTIVE',
        config: JSON.stringify({
          appId: process.env.ALIPAY_APP_ID || '',
          privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
          alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || ''
        }),
        metadata: JSON.stringify({
          name: '支付宝支付 (官方版)',
          category: 'payment',
          description: 'Official Alipay payment integration',
          author: 'Jiffoo Team'
        })
      }
    });
    console.log('✅ Created Alipay plugin instance');
  }

  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
