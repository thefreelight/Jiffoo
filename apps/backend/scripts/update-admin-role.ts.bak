import { prisma } from '../src/config/database';

async function updateAdminRole() {
  try {
    const result = await prisma.user.update({
      where: { email: 'admin@jiffoo.com' },
      data: { role: 'SUPER_ADMIN' }
    });
    
    console.log('User role updated successfully:', result);
  } catch (error) {
    console.error('Error updating user role:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdminRole();
