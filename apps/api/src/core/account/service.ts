import { prisma } from '@/config/database';
import { UpdateProfileRequest } from './types';

/**
 * User Account Service
 * Focused on personal profile management
 */
export class AccountService {

  /**
   * Get user profile
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
   * Update user profile
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
