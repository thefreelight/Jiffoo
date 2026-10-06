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
import { findAuthUserByEmail, findAuthUserById, findAuthUserByIdentifier } from './identity';
import { negotiateNotificationLocale, normalizeNotificationLocale } from '@/core/notifications/service';
import { emitEvent } from '@/infra/events/emit';
import { customerSnapshot } from '@/infra/events/snapshots';
import { ApiError } from '@/utils/api-errors';
import jwt from 'jsonwebtoken';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
    role: string;
    emailVerified?: boolean;
    avatar?: string | null;
    locale?: string | null;
  };
  // OAuth2 standard fields
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  // Compatible with old fields
  token: string;
}

const authUserSelect = {
  id: true,
  email: true,
  username: true,
  password: true,
  role: true,
  isActive: true,
  emailVerified: true,
  avatar: true,
  sessionVersion: true,
} as const;

const missingUserPasswordHash = '$2a$12$tvMZ0tok6MvqBM6cMgH9jO73IL.rIqFJ3zrhh/6EYlVNMideO/1yK';

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
  static async register(data: RegisterRequest, acceptLanguage?: string): Promise<AuthResponse> {
    const existingEmailUser = await findAuthUserByEmail(data.email);
    if (existingEmailUser) {
      if (!existingEmailUser.emailVerified) {
        throw new ApiError('EMAIL_NOT_VERIFIED');
      }
      throw new ApiError('REGISTRATION_FAILED');
    }

    const existingUsername = await prisma.user.findFirst({
      where: { username: data.username },
      select: { id: true },
    });
    if (existingUsername) throw new ApiError('REGISTRATION_FAILED');

    const hashedPassword = await PasswordUtils.hash(data.password);
    const user = await prisma.$transaction(async (tx) => {
      const system = await tx.systemSettings.findUnique({ where: { id: 'system' }, select: { settings: true } });
      const settings = system?.settings && typeof system.settings === 'object' && !Array.isArray(system.settings)
        ? system.settings as Record<string, unknown> : {};
      const locale = data.locale || negotiateNotificationLocale(acceptLanguage)
        || normalizeNotificationLocale(settings['localization.locale']) || 'en';
      const created = await tx.user.create({
        data: {
          email: data.email, username: data.username, password: hashedPassword,
          role: 'USER', locale, emailVerified: false,
        },
      });
      await EmailVerificationService.createVerification(tx, created.id, created.email, created.username);
      await emitEvent(tx, 'customer.created', 1, created.id, customerSnapshot(created));
      return created;
    });

    const token = JwtUtils.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
      sv: user.sessionVersion,
    });

    const refreshToken = JwtUtils.signRefresh({
      userId: user.id,
      sv: user.sessionVersion,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        emailVerified: user.emailVerified,
        avatar: user.avatar,
        locale: user.locale,
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
   * @param data Login credentials containing an email or username and password
   * @returns Authentication response with user details and OAuth2-compliant tokens
   * @throws Error if the identifier does not exist, is ambiguous, or the password is incorrect
   */
  static async login(data: LoginRequest): Promise<AuthResponse> {
    const identifier = data.identifier ?? data.email;
    const user = await findAuthUserByIdentifier(identifier);

    const isValid = await PasswordUtils.verify(data.password, user?.password ?? missingUserPasswordHash);
    if (!user || !isValid) {
      throw new ApiError('LOGIN_FAILED');
    }
    if (!user.isActive) {
      throw new ApiError('ACCOUNT_INACTIVE');
    }

    const token = JwtUtils.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
      sv: user.sessionVersion,
    });

    const refreshToken = JwtUtils.signRefresh({
      userId: user.id,
      sv: user.sessionVersion,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        emailVerified: user.emailVerified,
        avatar: user.avatar,
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
      throw new ApiError('USER_NOT_FOUND');
    }
    if (!user.isActive) {
      throw new ApiError('ACCOUNT_INACTIVE');
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: authUserSelect,
    });

    if (!user) {
      throw new ApiError('USER_NOT_FOUND');
    }
    if (!user.isActive) {
      throw new ApiError('ACCOUNT_INACTIVE');
    }

    const token = JwtUtils.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
      sv: user.sessionVersion,
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
    let payload;
    try {
      payload = JwtUtils.verify(refreshToken);
    } catch (error) {
      if (!(error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError || error instanceof jwt.NotBeforeError)) throw error;
      throw new ApiError('REFRESH_FAILED');
    }
    if (!payload.userId || payload.type !== 'refresh') {
      throw new ApiError('REFRESH_FAILED');
    }

    const user = await findAuthUserById(payload.userId);
    if (!user) throw new ApiError('REFRESH_FAILED');
    if (payload.sv !== user.sessionVersion) {
      throw new ApiError('SESSION_REVOKED');
    }
    if (!user.isActive) throw new ApiError('ACCOUNT_INACTIVE');

    const accessToken = JwtUtils.sign({
      userId: user.id, email: user.email, role: user.role, sv: user.sessionVersion,
    });
    const newRefreshToken = JwtUtils.signRefresh({ userId: user.id, sv: user.sessionVersion });

    return {
      user: {
        id: user.id, email: user.email, username: user.username, role: user.role,
        emailVerified: user.emailVerified, avatar: user.avatar,
      },
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 604800,
      refresh_token: newRefreshToken,
      token: accessToken,
    };
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
