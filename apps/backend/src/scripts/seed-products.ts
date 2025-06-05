import { prisma } from '../config/database';

const products = [
  {
    id: '1',
    name: 'Wireless Headphones',
    description: 'High-quality wireless headphones with noise cancellation',
    price: 99.99,
    stock: 15,
    images: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
  },
  {
    id: '2',
    name: 'Smart Watch',
    description: 'Advanced smartwatch with health monitoring features',
    price: 299.99,
    stock: 8,
    images: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
  },
  {
    id: '3',
    name: 'Laptop Stand',
    description: 'Ergonomic aluminum laptop stand for better posture',
    price: 49.99,
    stock: 25,
    images: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=400&fit=crop',
  },
  {
    id: '4',
    name: 'Bluetooth Speaker',
    description: 'Portable Bluetooth speaker with excellent sound quality',
    price: 79.99,
    stock: 12,
    images: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=400&fit=crop',
  },
  {
    id: '5',
    name: 'Wireless Mouse',
    description: 'Ergonomic wireless mouse with precision tracking',
    price: 29.99,
    stock: 30,
    images: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=400&fit=crop',
  },
  {
    id: '6',
    name: 'USB-C Hub',
    description: 'Multi-port USB-C hub with HDMI and USB 3.0 ports',
    price: 39.99,
    stock: 20,
    images: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop',
  },
];

async function seedProducts() {
  console.log('🌱 Seeding products...');

  try {
    // Clear existing products
    await prisma.product.deleteMany();
    console.log('🗑️  Cleared existing products');

    // Create new products
    for (const product of products) {
      await prisma.product.create({
        data: product,
      });
      console.log(`✅ Created product: ${product.name}`);
    }

    console.log('🎉 Product seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding products:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function if this file is executed directly
if (require.main === module) {
  seedProducts()
    .then(() => {
      console.log('✨ Seeding finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}

export { seedProducts };
