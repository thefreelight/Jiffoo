/**
 * Admin User Service (单商户版本)
 */

import { prisma } from '@/config/database';
import { PasswordUtils } from '@/utils/password';

export class AdminUserService {
  static async getUsers(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          username: true,
          avatar: true,
          role: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  static async createUser(data: {
    email: string;
    password: string;
    username?: string;
    role?: string;
  }) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      throw new Error('Email already exists');
    }

    const hashedPassword = await PasswordUtils.hash(data.password);

    return prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        username: data.username || data.email.split('@')[0],
        role: data.role || 'USER'
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  static async updateUser(userId: string, data: {
    username?: string;
    role?: string;
    avatar?: string;
  }) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  static async deleteUser(userId: string) {
    await prisma.user.delete({
      where: { id: userId }
    });
    return { success: true };
  }

  static async resetPassword(userId: string, newPassword: string) {
    const hashedPassword = await PasswordUtils.hash(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });
    return { success: true };
  }
}
