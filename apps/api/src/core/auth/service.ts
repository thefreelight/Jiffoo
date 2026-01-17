/**
 * Auth Service
 */

import { prisma } from '@/config/database';
import { PasswordUtils } from '@/utils/password';
import { JwtUtils } from '@/utils/jwt';
import { LoginRequest, RegisterRequest } from './types';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
    role: string;
    avatar?: string | null;
  };
  // OAuth2 standard fields
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  // Compatible with old fields
  token: string;
}

export class AuthService {
  static async register(data: RegisterRequest): Promise<AuthResponse> {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { username: data.username }
        ]
      }
    });

    if (existingUser) {
      throw new Error('User with this email or username already exists');
    }

    const hashedPassword = await PasswordUtils.hash(data.password);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        password: hashedPassword,
        role: 'USER'
      }
    });

    const token = JwtUtils.sign({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    const refreshToken = JwtUtils.signRefresh({
      userId: user.id
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        avatar: user.avatar
      },
      // OAuth2 standard fields
      access_token: token,
      token_type: 'Bearer',
      expires_in: 604800, // 7 days
      refresh_token: refreshToken,
      // Compatible with old fields
      token
    };
  }

  static async login(data: LoginRequest): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isValid = await PasswordUtils.verify(data.password, user.password);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    const token = JwtUtils.sign({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    const refreshToken = JwtUtils.signRefresh({
      userId: user.id
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        avatar: user.avatar
      },
      // OAuth2 standard fields
      access_token: token,
      token_type: 'Bearer',
      expires_in: 604800, // 7 days
      refresh_token: refreshToken,
      // Compatible with old fields
      token
    };
  }

  static async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        avatar: true,
        createdAt: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  static async refreshToken(userId: string): Promise<{ token: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const token = JwtUtils.sign({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    return { token };
  }

  static async refreshSession(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = JwtUtils.verify(refreshToken);
      if (!payload || !payload.userId || payload.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      const accessToken = JwtUtils.sign({
        userId: user.id,
        email: user.email,
        role: user.role
      });

      // Optional: Rotate refresh token? (Return new one, same expiry or extended)
      // For now, let's keep the same or issue a new one. OAuth2 usually issues a new one.
      const newRefreshToken = JwtUtils.signRefresh({ userId: user.id });

      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          avatar: user.avatar
        },
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 604800,
        refresh_token: newRefreshToken,
        token: accessToken
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  static verifyToken(token: string) {
    return JwtUtils.verify(token);
  }
}
