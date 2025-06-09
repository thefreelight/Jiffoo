import { prisma } from '@/config/database';
import { PasswordUtils } from '@/utils/password';
import { JwtUtils } from '@/utils/jwt';
import { LoginRequest, RegisterRequest, AuthResponse } from './types';

export class AuthService {
  static async register(data: RegisterRequest): Promise<AuthResponse> {
    // Check if user already exists
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

    // Hash password
    const hashedPassword = await PasswordUtils.hash(data.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        password: hashedPassword,
        avatar: data.avatar,
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        role: true,
      }
    });

    // Generate JWT token
    const token = JwtUtils.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        ...user,
        avatar: user.avatar || undefined,
      },
      token,
    };
  }

  static async login(data: LoginRequest): Promise<AuthResponse> {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await PasswordUtils.verify(data.password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = JwtUtils.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar || undefined,
        role: user.role,
      },
      token,
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
      }
    });
  }
}
