import { prisma } from '@/config/database';
import { PasswordUtils } from '@/utils/password';
import { JwtUtils } from '@/utils/jwt';
import { LoginRequest, RegisterRequest, StandardAuthResponse } from './types';
// 权限管理器已简化，不再需要复杂的权限管理
import { SUPER_ADMIN_TENANT_ID } from '@/utils/tenant-utils';

// ============================================
// 邀请码辅助函数
// ============================================

/**
 * 生成唯一邀请码
 */
async function generateReferralCode(): Promise<string> {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  let isUnique = false;

  while (!isUnique) {
    code = '';
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    const existing = await prisma.user.findUnique({
      where: { referralCode: code }
    });

    if (!existing) {
      isUnique = true;
    }
  }

  return code;
}

/**
 * 通过邀请码获取用户ID
 */
async function getUserIdByReferralCode(code: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true }
  });

  return user?.id || null;
}

export class AuthService {
  // 🔧 标准化改造：移除cookie相关方法，改用标准Bearer Token

  static async register(data: RegisterRequest, tenantId?: number, referralCode?: string): Promise<StandardAuthResponse> {
    // 根据角色和租户检查用户是否已存在
    let existingUser;

    if (!tenantId || tenantId === 0) {
      // 超级管理员注册（不应该通过此接口）
      throw new Error('Super admin registration not allowed through this endpoint');
    } else {
      // 租户管理员或普通用户注册
      existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: data.email, tenantId: tenantId },
            { username: data.username, tenantId: tenantId }
          ]
        }
      });
    }

    if (existingUser) {
      throw new Error('User with this email or username already exists in this tenant');
    }

    // 🆕 如果提供了邀请码，验证并获取邀请人ID
    let invitedBy: string | undefined;
    if (referralCode) {
      invitedBy = await getUserIdByReferralCode(referralCode) || undefined;
      if (!invitedBy) {
        throw new Error('Invalid referral code');
      }
    }

    // Hash password
    const hashedPassword = await PasswordUtils.hash(data.password);

    // 🆕 生成邀请码
    const newReferralCode = await generateReferralCode();

    // Create user with tenantId and referral info
    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        password: hashedPassword,
        avatar: data.avatar,
        tenantId: tenantId,
        role: 'USER', // 默认为普通用户
        referralCode: newReferralCode, // 🆕 自动生成邀请码
        invitedBy: invitedBy // 🆕 记录邀请人
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        tenantId: true,
      }
    });

    // 🆕 如果有邀请人，更新邀请人的统计
    if (invitedBy) {
      await prisma.user.update({
        where: { id: invitedBy },
        data: {
          totalReferrals: { increment: 1 }
        }
      });
    }

    // 角色已在创建用户时设置，无需额外分配

    // Generate JWT tokens with tenant info
    const token = JwtUtils.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });

    const refreshToken = JwtUtils.sign({
      userId: user.id,
      type: 'refresh'
    }, '7d');

    // 🔧 标准化改造：返回标准OAuth2格式，不再设置cookie
    return {
      access_token: token,
      token_type: 'Bearer' as const,
      expires_in: 7 * 24 * 60 * 60, // 7天，与JWT过期时间一致
      refresh_token: refreshToken
    };
  }

  static async login(data: LoginRequest, tenantId?: number): Promise<StandardAuthResponse> {
    let user;

    if (tenantId === SUPER_ADMIN_TENANT_ID) {
      // 超级管理员登录（明确指定tenantId为0）
      user = await prisma.user.findFirst({
        where: {
          email: data.email,
          role: "SUPER_ADMIN",
          tenantId: SUPER_ADMIN_TENANT_ID
        }
      });
    } else if (tenantId && tenantId > 0) {
      // 租户管理员和普通用户登录（明确指定tenantId）
      user = await prisma.user.findFirst({
        where: {
          email: data.email,
          tenantId: tenantId,
          role: { in: ["TENANT_ADMIN", "USER"] }
        }
      });
    } else {
      // 未提供tenantId：尝试通过email自动查找用户
      // 优先查找超级管理员，然后查找租户管理员/用户
      user = await prisma.user.findFirst({
        where: {
          email: data.email,
          role: "SUPER_ADMIN",
          tenantId: SUPER_ADMIN_TENANT_ID
        }
      });

      if (!user) {
        // 如果不是超级管理员，查找租户管理员或用户
        user = await prisma.user.findFirst({
          where: {
            email: data.email,
            role: { in: ["TENANT_ADMIN", "USER"] }
          }
        });
      }
    }

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await PasswordUtils.verify(data.password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT tokens with tenant info
    const token = JwtUtils.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });

    const refreshToken = JwtUtils.sign({
      userId: user.id,
      type: 'refresh'
    }, '7d');

    // 🔧 标准化改造：返回标准OAuth2格式，不再设置cookie
    return {
      access_token: token,
      token_type: 'Bearer' as const,
      expires_in: 7 * 24 * 60 * 60, // 7天，与JWT过期时间一致
      refresh_token: refreshToken
    };
  }

  /**
   * 刷新访问token
   */
  static async refreshToken(refreshToken: string): Promise<StandardAuthResponse> {
    try {
      const payload = JwtUtils.verify(refreshToken);

      if (payload.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      // 获取用户信息
      const user = await this.getUserById(payload.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // 获取用户的租户信息
      let tenantId: number | undefined = user.tenantId;

      // 生成新的访问token，包含租户信息
      const tokenPayload: any = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      if (tenantId) {
        tokenPayload.tenantId = tenantId;
      }

      const newToken = JwtUtils.sign(tokenPayload);

      // 生成新的刷新token
      const newRefreshToken = JwtUtils.sign({
        userId: user.id,
        type: 'refresh'
      }, '7d');

      // 🔧 标准化改造：返回标准OAuth2格式，不再设置cookie
      return {
        access_token: newToken,
        token_type: 'Bearer' as const,
        expires_in: 15 * 60, // 15分钟
        refresh_token: newRefreshToken
      };
    } catch {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * 登出用户 - 标准化改造：客户端负责清除token，服务端无需操作
   */
  static async logout(): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: 'Logged out successfully'
    };
  }

  /**
   * 获取用户详细信息 - 用于 /api/auth/me 端点
   * 🔧 标准化改造：简化响应结构，只返回基本用户信息
   */
  static async getUserProfile(userId: string, _tenantId?: number) { // eslint-disable-line @typescript-eslint/no-unused-vars
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      tenantId: user.tenantId,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  /**
   * 获取用户基本信息 - 用于内部认证验证
   * 🔒 安全修复：添加可选的租户过滤
   */
  static async getUserById(userId: string, tenantId?: number) {
    // 构建查询条件
    const where: any = { id: userId };

    // 如果指定了租户ID，确保用户属于该租户（用于跨租户验证）
    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }

    return prisma.user.findFirst({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }


}
