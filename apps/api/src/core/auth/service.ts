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
import { findResolvedAdminAccessForUser } from './admin-membership-compat';

const DEFAULT_DEMO_ADMIN_EMAIL = 'admin@jiffoo.com';
const DEFAULT_DEMO_ADMIN_PASSWORD = 'admin123';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
    role: string;
    admin?: {
      membershipId: string | null;
      role: string;
      status: 'ACTIVE' | 'SUSPENDED';
      permissions: string[];
      isOwner: boolean;
      extraPermissions: string[];
      revokedPermissions: string[];
    };
    adminRole?: string | null;
    permissions?: string[];
    isOwner?: boolean;
    adminStatus?: 'ACTIVE' | 'SUSPENDED';
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

export interface LoginConfigResponse {
  demoModeEnabled: boolean;
  demoCredentials: {
    email: string;
    password: string;
  } | null;
}

export interface AcceptStaffInviteRequest {
  token: string;
  password: string;
}

export class AuthService {
  private static async buildAuthUserPayload(user: {
    id: string;
    email: string;
    username: string;
    role: string;
    emailVerified: boolean;
    avatar: string | null;
  }) {
    const adminAccess = await findResolvedAdminAccessForUser(user.id, user.role);
    const permissions = adminAccess?.permissions ?? [];

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      admin: adminAccess
        ? {
            membershipId: adminAccess.membershipId,
            role: adminAccess.role,
            status: adminAccess.status,
            permissions,
            isOwner: adminAccess.isOwner,
            extraPermissions: adminAccess.extraPermissions,
            revokedPermissions: adminAccess.revokedPermissions,
          }
        : undefined,
      adminRole: adminAccess?.role ?? null,
      permissions,
      isOwner: adminAccess?.isOwner ?? false,
      adminStatus: adminAccess?.status,
      emailVerified: user.emailVerified,
      avatar: user.avatar,
    };
  }

  private static isDemoModeEnabled(): boolean {
    return process.env.JIFFOO_DEMO_MODE === 'true';
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
      const createdUser = await prisma.user.create({
        data: {
          email: credentials.email,
          username: credentials.email.split('@')[0] || 'admin',
          password: hashedPassword,
          role: 'ADMIN',
          isActive: true,
          emailVerified: true,
        },
        select: { id: true },
      });
      await prisma.adminMembership.upsert({
        where: { userId: createdUser.id },
        update: {
          role: 'ADMIN',
          status: 'ACTIVE',
          isOwner: false,
          extraPermissions: null,
          revokedPermissions: null,
        },
        create: {
          userId: createdUser.id,
          role: 'ADMIN',
          status: 'ACTIVE',
          isOwner: false,
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
    await prisma.adminMembership.upsert({
      where: { userId: existingUser.id },
      update: {
        role: 'ADMIN',
        status: 'ACTIVE',
        isOwner: false,
        extraPermissions: null,
        revokedPermissions: null,
      },
      create: {
        userId: existingUser.id,
        role: 'ADMIN',
        status: 'ACTIVE',
        isOwner: false,
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
      user: await this.buildAuthUserPayload(user),
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
      user: await this.buildAuthUserPayload(user),
      // OAuth2 standard fields
      access_token: token,
      token_type: 'Bearer',
      expires_in: 604800, // 7 days
      refresh_token: refreshToken,
      // Compatible with old fields
      token
    };
  }

  static async acceptStaffInvite(data: AcceptStaffInviteRequest): Promise<AuthResponse> {
    if (!data.token) {
      throw new Error('Invitation token is required');
    }

    if (!data.password || data.password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    const invitedUser = await prisma.user.findFirst({
      where: { verificationToken: data.token },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        avatar: true,
        verificationTokenExpiry: true,
        adminMembership: {
          select: {
            id: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!invitedUser) {
      throw new Error('Invalid staff invitation token');
    }

    if (!invitedUser.adminMembership) {
      throw new Error('Staff invitation not found');
    }

    if (!invitedUser.verificationTokenExpiry || invitedUser.verificationTokenExpiry < new Date()) {
      throw new Error('Staff invitation token has expired');
    }

    if (!invitedUser.isActive) {
      throw new Error('Account is inactive');
    }

    const hashedPassword = await PasswordUtils.hash(data.password);
    const user = await prisma.user.update({
      where: { id: invitedUser.id },
      data: {
        password: hashedPassword,
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        emailVerified: true,
        avatar: true,
      },
    });

    await prisma.adminStaffAuditLog.create({
      data: {
        staffUserId: user.id,
        staffEmail: user.email,
        staffUsername: user.username,
        actorUserId: user.id,
        actorEmail: user.email,
        actorUsername: user.username,
        action: 'STAFF_INVITE_ACCEPTED',
        metadata: {
          adminMembershipId: invitedUser.adminMembership.id,
          adminRole: invitedUser.adminMembership.role,
          status: invitedUser.adminMembership.status,
        },
      },
    });

    const token = JwtUtils.sign({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = JwtUtils.signRefresh({
      userId: user.id,
    });

    return {
      user: await this.buildAuthUserPayload(user),
      access_token: token,
      token_type: 'Bearer',
      expires_in: 604800,
      refresh_token: refreshToken,
      token,
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
        emailVerified: true,
        createdAt: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }
    if (!user.isActive) {
      throw new Error('Account is inactive');
    }

    const authPayload = await this.buildAuthUserPayload(user);

    return {
      ...user,
      admin: authPayload.admin,
      adminRole: authPayload.adminRole,
      permissions: authPayload.permissions,
      isOwner: authPayload.isOwner,
      adminStatus: authPayload.adminStatus,
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
        user: await this.buildAuthUserPayload(user),
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
