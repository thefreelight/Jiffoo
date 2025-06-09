import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    const admin = await prisma.user.upsert({
      where: { email: 'admin@jiffoo.com' },
      update: { role: 'ADMIN' },
      create: {
        email: 'admin@jiffoo.com',
        username: 'admin',
        password: hashedPassword,
        role: 'ADMIN',
      },
    });

    console.log('Admin user created/updated:', admin);
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
