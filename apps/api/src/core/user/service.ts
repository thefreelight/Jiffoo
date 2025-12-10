/**
 * User Service (单商户版本)
 * 
 * 简化版本，移除了多租户相关逻辑。
 */

import { prisma } from '@/config/database';
import { PasswordUtils } from '@/utils/password';
import { UpdateUserRequest, UpdateUserRoleRequest } from './types';

export interface UpdateProfileRequest {
  username?: string;
  avatar?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export class UserService {
  /**
   * 获取所有用户
   */
  static async getAllUsers(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;

    const whereCondition: any = {};

    if (search) {
      whereCondition.OR = [
        { username: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereCondition,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          username: true,
          avatar: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.user.count({ where: whereCondition }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 根据ID获取用户
   */
  static async getUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 根据邮箱获取用户
   */
  static async getUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * 更新用户资料
   */
  static async updateProfile(userId: string, data: UpdateProfileRequest) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        username: data.username,
        avatar: data.avatar,
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 修改密码
   */
  static async changePassword(userId: string, data: ChangePasswordRequest) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await PasswordUtils.verify(data.currentPassword, user.password);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    const hashedPassword = await PasswordUtils.hash(data.newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { success: true };
  }

  /**
   * 更新用户角色 (管理员)
   */
  static async updateUserRole(userId: string, data: UpdateUserRoleRequest) {
    return prisma.user.update({
      where: { id: userId },
      data: { role: data.role },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 删除用户 (管理员)
   */
  static async deleteUser(userId: string) {
    await prisma.user.delete({
      where: { id: userId },
    });
    return { success: true };
  }

  /**
   * 创建用户 (管理员)
   */
  static async createUser(data: {
    email: string;
    password: string;
    username?: string;
    role?: string;
  }) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
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
        role: data.role || 'USER',
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
