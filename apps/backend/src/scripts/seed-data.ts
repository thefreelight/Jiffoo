import { prisma } from '../config/database';
import bcrypt from 'bcryptjs';

// 管理员账号数据
const adminUser = {
  email: 'admin@jiffoo.com',
  username: 'admin',
  password: 'admin123',
  role: 'ADMIN',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
};

// 模拟商品数据
const mockProducts = [
  {
    id: 'prod_1',
    name: 'Wireless Bluetooth Headphones',
    description: 'Premium wireless headphones with active noise cancellation, 30-hour battery life, and crystal-clear audio quality. Perfect for music lovers and professionals.',
    price: 199.99,
    stock: 25,
    images: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop',
  },
  {
    id: 'prod_2',
    name: 'Smart Fitness Watch',
    description: 'Advanced smartwatch with health monitoring, GPS tracking, water resistance, and 7-day battery life. Track your fitness goals effortlessly.',
    price: 299.99,
    stock: 15,
    images: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&h=500&fit=crop',
  },
  {
    id: 'prod_3',
    name: 'Premium Coffee Maker',
    description: 'Professional-grade coffee maker with programmable brewing, thermal carafe, and multiple brew strength settings. Start your day right.',
    price: 149.99,
    stock: 12,
    images: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500&h=500&fit=crop',
  },
  {
    id: 'prod_4',
    name: 'Ergonomic Office Chair',
    description: 'High-back ergonomic office chair with lumbar support, adjustable height, and breathable mesh design. Comfort for long work hours.',
    price: 249.99,
    stock: 8,
    images: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500&h=500&fit=crop',
  },
  {
    id: 'prod_5',
    name: 'Portable Bluetooth Speaker',
    description: 'Waterproof portable speaker with 360-degree sound, 20-hour battery life, and wireless charging. Take your music anywhere.',
    price: 89.99,
    stock: 35,
    images: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&h=500&fit=crop',
  },
  {
    id: 'prod_6',
    name: 'Running Shoes - Pro Edition',
    description: 'High-performance running shoes with advanced cushioning, breathable mesh upper, and durable outsole. Engineered for athletes.',
    price: 129.99,
    stock: 42,
    images: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&h=500&fit=crop',
  },
  {
    id: 'prod_7',
    name: 'Wireless Charging Pad',
    description: 'Fast wireless charging pad compatible with all Qi-enabled devices. Sleek design with LED indicators and overheat protection.',
    price: 39.99,
    stock: 28,
    images: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=500&fit=crop',
  },
  {
    id: 'prod_8',
    name: 'Skincare Essential Set',
    description: 'Complete 5-piece skincare set with cleanser, toner, serum, moisturizer, and sunscreen. Suitable for all skin types.',
    price: 79.99,
    stock: 18,
    images: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=500&h=500&fit=crop',
  },
  {
    id: 'prod_9',
    name: 'Gaming Mechanical Keyboard',
    description: 'RGB backlit mechanical keyboard with tactile switches, programmable keys, and anti-ghosting. Perfect for gaming and typing.',
    price: 119.99,
    stock: 22,
    images: 'https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=500&h=500&fit=crop',
  },
  {
    id: 'prod_10',
    name: 'Yoga Mat Premium',
    description: 'Non-slip yoga mat with extra cushioning, eco-friendly materials, and carrying strap. Perfect for yoga, pilates, and workouts.',
    price: 49.99,
    stock: 33,
    images: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500&h=500&fit=crop',
  },
  {
    id: 'prod_11',
    name: 'Smart Home Security Camera',
    description: 'HD security camera with night vision, motion detection, two-way audio, and cloud storage. Keep your home safe.',
    price: 159.99,
    stock: 14,
    images: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=500&h=500&fit=crop',
  },
  {
    id: 'prod_12',
    name: 'Stainless Steel Water Bottle',
    description: 'Double-walled insulated water bottle that keeps drinks cold for 24 hours or hot for 12 hours. BPA-free and leak-proof.',
    price: 24.99,
    stock: 67,
    images: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&h=500&fit=crop',
  },
];

async function seedDatabase() {
  console.log('🌱 开始初始化数据库...');

  try {
    // 清理现有数据
    console.log('🗑️  清理现有数据...');
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();

    // 创建管理员账号
    console.log('👤 创建管理员账号...');
    const hashedPassword = await bcrypt.hash(adminUser.password, 10);
    
    const admin = await prisma.user.create({
      data: {
        email: adminUser.email,
        username: adminUser.username,
        password: hashedPassword,
        role: adminUser.role,
        avatar: adminUser.avatar,
      },
    });
    console.log(`✅ 创建管理员账号成功: ${admin.username} (${admin.email})`);

    // 创建商品数据
    console.log('📦 创建商品数据...');
    for (const product of mockProducts) {
      await prisma.product.create({
        data: product,
      });
      console.log(`✅ 创建商品: ${product.name} - $${product.price}`);
    }

    // 创建一些测试订单数据
    console.log('📋 创建测试订单...');
    const testOrders = [
      {
        userId: admin.id,
        status: 'COMPLETED',
        totalAmount: 329.98,
        items: [
          { productId: 'prod_1', quantity: 1, unitPrice: 199.99 },
          { productId: 'prod_5', quantity: 1, unitPrice: 89.99 },
          { productId: 'prod_7', quantity: 1, unitPrice: 39.99 },
        ]
      },
      {
        userId: admin.id,
        status: 'PENDING',
        totalAmount: 179.98,
        items: [
          { productId: 'prod_6', quantity: 1, unitPrice: 129.99 },
          { productId: 'prod_10', quantity: 1, unitPrice: 49.99 },
        ]
      }
    ];

    for (const orderData of testOrders) {
      const order = await prisma.order.create({
        data: {
          userId: orderData.userId,
          status: orderData.status,
          totalAmount: orderData.totalAmount,
        },
      });

      for (const item of orderData.items) {
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          },
        });
      }
      console.log(`✅ 创建订单: ${order.id} - $${order.totalAmount}`);
    }

    console.log('🎉 数据库初始化完成!');
    console.log('\n📊 数据统计:');
    console.log(`👤 管理员账号: 1个`);
    console.log(`📦 商品数量: ${mockProducts.length}个`);
    console.log(`📋 测试订单: ${testOrders.length}个`);
    console.log('\n🔐 管理员登录信息:');
    console.log(`📧 邮箱: ${adminUser.email}`);
    console.log(`👤 用户名: ${adminUser.username}`);
    console.log(`🔑 密码: ${adminUser.password}`);

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此文件则执行种子数据
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('✨ 种子数据执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 种子数据执行失败:', error);
      process.exit(1);
    });
}

export { seedDatabase }; 