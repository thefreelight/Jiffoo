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
import { shouldRequirePasswordRotation } from './bootstrap';
import { findAuthUserByEmail, findAuthUserById, findAuthUserByIdentifier } from './user-compat';
import { negotiateNotificationLocale, normalizeNotificationLocale } from '@/core/notifications/service';

const DEFAULT_DEMO_ADMIN_EMAIL = 'admin@jiffoo.com';
const DEFAULT_DEMO_ADMIN_PASSWORD = 'admin123';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
    role: string;
    emailVerified?: boolean;
    avatar?: string | null;
    locale?: string | null;
    requiresPasswordRotation?: boolean;
  };
  // OAuth2 standard fields
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  // Compatible with old fields
  token: string;
}

export interface LoginConfigResponse {
  demoModeEnabled: boolean;
  demoCredentials: {
    email: string;
    password: string;
  } | null;
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

export class AuthService {
  private static isDemoModeEnabled(): boolean {
    return process.env.JIFFOO_DEMO_MODE === 'true';
  }

  private static shouldRequireEmailVerification(): boolean {
    return process.env.AUTH_REQUIRE_EMAIL_VERIFICATION?.trim().toLowerCase() !== 'false';
  }

  private static resolveDemoCredentials() {
    return {
      email: process.env.JIFFOO_DEMO_ADMIN_EMAIL?.trim() || DEFAULT_DEMO_ADMIN_EMAIL,
      password: process.env.JIFFOO_DEMO_ADMIN_PASSWORD || DEFAULT_DEMO_ADMIN_PASSWORD,
    };
  }

  private static async ensureDemoModeAdminCredentials(credentials: { email: string; password: string }): Promise<void> {
    const existingUser = await prisma.user.findUnique({
      where: { email: credentials.email },
      select: {
        id: true,
        password: true,
        role: true,
        isActive: true,
        emailVerified: true,
      },
    });

    const hashedPassword = await PasswordUtils.hash(credentials.password);

    if (!existingUser) {
      await prisma.user.create({
        data: {
          email: credentials.email,
          username: credentials.email.split('@')[0] || 'admin',
          password: hashedPassword,
          role: 'ADMIN',
          isActive: true,
          emailVerified: true,
        },
      });
      return;
    }

    const passwordMatches = await PasswordUtils.verify(credentials.password, existingUser.password);
    if (
      passwordMatches &&
      existingUser.role === 'ADMIN' &&
      existingUser.isActive &&
      existingUser.emailVerified
    ) {
      return;
    }

    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        emailVerified: true,
      },
    });
  }

  static async getLoginConfig(): Promise<LoginConfigResponse> {
    if (!this.isDemoModeEnabled()) {
      return {
        demoModeEnabled: false,
        demoCredentials: null,
      };
    }

    const credentials = this.resolveDemoCredentials();
    await this.ensureDemoModeAdminCredentials(credentials);

    return {
      demoModeEnabled: true,
      demoCredentials: credentials,
    };
  }

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
        const error = new Error('This email is already registered but has not been verified yet. Enter the verification code we sent, or request a new one.');
        Object.assign(error, { code: 'EMAIL_NOT_VERIFIED' });
        throw error;
      }
      throw new Error('User with this email or username already exists');
    }

    const existingUsername = await prisma.user.findFirst({
      where: { username: data.username },
      select: { id: true },
    });
    if (existingUsername) throw new Error('User with this email or username already exists');

    const hashedPassword = await PasswordUtils.hash(data.password);
    const requireEmailVerification = this.shouldRequireEmailVerification();
    const user = await prisma.$transaction(async (tx) => {
      const system = await tx.systemSettings.findUnique({ where: { id: 'system' }, select: { settings: true } });
      const settings = system?.settings && typeof system.settings === 'object' && !Array.isArray(system.settings)
        ? system.settings as Record<string, unknown> : {};
      const locale = data.locale || negotiateNotificationLocale(acceptLanguage)
        || normalizeNotificationLocale(settings['localization.locale']) || 'en';
      const created = await tx.user.create({
        data: {
          email: data.email, username: data.username, password: hashedPassword,
          role: 'USER', locale, emailVerified: !requireEmailVerification,
        },
      });
      if (requireEmailVerification) {
        await EmailVerificationService.createVerification(tx, created.id, created.email, created.username);
      }
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
        requiresPasswordRotation: false,
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

    const requiresPasswordRotation = await shouldRequirePasswordRotation(user.email);

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
        requiresPasswordRotation,
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

    return {
      ...user,
      requiresPasswordRotation: await shouldRequirePasswordRotation(user.email),
    };
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
      throw new Error('User not found');
    }
    if (!user.isActive) {
      throw new Error('Account is inactive');
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
    } catch {
      throw new Error('Invalid refresh token');
    }
    if (!payload.userId || payload.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }

    const user = await findAuthUserById(payload.userId);
    if (!user) throw new Error('User not found');
    if (payload.sv !== user.sessionVersion) {
      throw Object.assign(new Error('Session revoked'), { code: 'SESSION_REVOKED' });
    }
    if (!user.isActive) throw new Error('Account is inactive');

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
