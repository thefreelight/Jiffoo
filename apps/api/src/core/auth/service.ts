/**
 * Auth Service
 *
 * Handles user authentication, registration, and token management.
 * Supports OAuth2-compliant token responses with JWT-based authentication.
 */

import { prisma } from '@/config/database';
import { PasswordUtils } from '@/utils/password';
import { JwtUtils } from '@/utils/jwt';
import { LoginRequest, RegisterRequest } from './types';
import { EmailVerificationService } from '@/services/email-verification.service';
import { createAuthUser, findAuthUserByEmail, findAuthUserById } from './user-compat';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
    role: string;
    emailVerified?: boolean;
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
  /**
   * Register a new user account
   *
   * Creates a new user with hashed password and generates access and refresh tokens.
   * Validates that email and username are unique before creating the account.
   *
   * @param data User registration data containing email, username, and password
   * @returns Authentication response with user details and OAuth2-compliant tokens
   * @throws Error if a user with the same email or username already exists
   */
  static async register(data: RegisterRequest): Promise<AuthResponse> {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { username: data.username }
        ]
      },
      select: { id: true },
    });

    if (existingUser) {
      throw new Error('User with this email or username already exists');
    }

    const hashedPassword = await PasswordUtils.hash(data.password);
    const user = await createAuthUser({
      email: data.email,
      username: data.username,
      password: hashedPassword,
      role: 'USER',
    });

    if (!user.emailVerified) {
      await EmailVerificationService.sendVerificationEmail(
        user.id,
        user.email,
        user.username
      );
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
        emailVerified: user.emailVerified,
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

  /**
   * Authenticate a user and generate session tokens
   *
   * Validates user credentials and generates new access and refresh tokens upon successful authentication.
   *
   * @param data Login credentials containing email and password
   * @returns Authentication response with user details and OAuth2-compliant tokens
   * @throws Error if the email does not exist or password is incorrect
  */
  static async login(data: LoginRequest): Promise<AuthResponse> {
    const user = await findAuthUserByEmail(data.email);

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isValid = await PasswordUtils.verify(data.password, user.password);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }
    if (!user.isActive) {
      throw new Error('Account is inactive');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new Error('Email not verified. Please check your email for verification link.');
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
        emailVerified: user.emailVerified,
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

  /**
   * Get current user details by user ID
   *
   * Retrieves the authenticated user's profile information including id, email,
   * username, role, avatar, and account creation date.
   *
   * @param userId The unique identifier of the user
   * @returns User profile object with selected fields
   * @throws Error if the user is not found
   */
  static async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        avatar: true,
        createdAt: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }
    if (!user.isActive) {
      throw new Error('Account is inactive');
    }

    return user;
  }

  /**
   * Generate a new access token for an authenticated user
   *
   * Creates a new JWT access token for the user based on their current profile.
   * This method is used when a valid refresh token provides the userId.
   *
   * @param userId The unique identifier of the user
   * @returns Object containing the new access token
   * @throws Error if the user is not found
   */
  static async refreshToken(userId: string): Promise<{ token: string }> {
    const user = await findAuthUserById(userId);

    if (!user) {
      throw new Error('User not found');
    }
    if (!user.isActive) {
      throw new Error('Account is inactive');
    }

    const token = JwtUtils.sign({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    return { token };
  }

  /**
   * Refresh an authenticated session using a refresh token
   *
   * Validates the refresh token and generates new access and refresh tokens.
   * Implements token rotation by issuing a new refresh token with each refresh.
   *
   * @param refreshToken The JWT refresh token to validate and exchange
   * @returns Authentication response with user details and new OAuth2-compliant tokens
   * @throws Error if the refresh token is invalid, expired, or the user is not found
   */
  static async refreshSession(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = JwtUtils.verify(refreshToken);
      if (!payload || !payload.userId || payload.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      const user = await findAuthUserById(payload.userId);

      if (!user) {
        throw new Error('User not found');
      }
      if (!user.isActive) {
        throw new Error('Account is inactive');
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
          emailVerified: user.emailVerified,
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

  /**
   * Verify and decode a JWT token
   *
   * Validates the token signature and expiration, then returns the decoded payload.
   *
   * @param token The JWT token to verify
   * @returns Decoded token payload containing user information
   */
  static verifyToken(token: string) {
    return JwtUtils.verify(token);
  }
}
