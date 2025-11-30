import { prisma } from '@/config/database';
import { UpdateProfileRequest } from './types';

/**
 * 用户个人账户服务 - 精简版
 * 专注于个人资料管理
 */
export class AccountService {
  
  /**
   * 获取用户个人资料
   */
  static async getProfile(userId: string) {
    const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!profile) {
      throw new Error('User not found');
    }

    return profile;
  }

  /**
   * 更新用户个人资料
   */
  static async updateProfile(userId: string, updateData: UpdateProfileRequest) {
    const updatedProfile = await prisma.user.update({
      where: { id: userId },
      data: {
        ...updateData,
        updatedAt: new Date()
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return updatedProfile;
  }




}
