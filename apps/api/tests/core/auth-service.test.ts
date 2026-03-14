/**
 * AuthService Unit Tests
 *
 * Coverage:
 * - register: success path, duplicate user error
 * - login: success path, wrong password, inactive user, unverified email
 * - getCurrentUser: success path, user not found, inactive user
 * - refreshSession: success path, invalid refresh token
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks - declared before the service import so vi.mock hoisting works
// ---------------------------------------------------------------------------

vi.mock('@/config/database', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/utils/password', () => ({
  PasswordUtils: {
    hash: vi.fn(),
    verify: vi.fn(),
  },
}));

vi.mock('@/utils/jwt', () => ({
  JwtUtils: {
    sign: vi.fn(),
    signRefresh: vi.fn(),
    verify: vi.fn(),
  },
}));

vi.mock('@/services/email-verification.service', () => ({
  EmailVerificationService: {
    sendVerificationEmail: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { AuthService } from '@/core/auth/service';
import { prisma } from '@/config/database';
import { PasswordUtils } from '@/utils/password';
import { JwtUtils } from '@/utils/jwt';
import { EmailVerificationService } from '@/services/email-verification.service';
import { resetAuthCompatibilityCache } from '@/core/auth/user-compat';

// ---------------------------------------------------------------------------
// Typed mock helpers
// ---------------------------------------------------------------------------

const mockPrismaUser = prisma.user as {
  findFirst: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};

const mockPasswordUtils = PasswordUtils as {
  hash: ReturnType<typeof vi.fn>;
  verify: ReturnType<typeof vi.fn>;
};

const mockJwtUtils = JwtUtils as {
  sign: ReturnType<typeof vi.fn>;
  signRefresh: ReturnType<typeof vi.fn>;
  verify: ReturnType<typeof vi.fn>;
};

const mockEmailVerification = EmailVerificationService as {
  sendVerificationEmail: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const TEST_USER = {
  id: 'user-id-1',
  email: 'test@example.com',
  username: 'testuser',
  password: 'hashed-password',
  role: 'USER',
  isActive: true,
  emailVerified: true,
  avatar: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
};

const ACCESS_TOKEN = 'mock-access-token';
const REFRESH_TOKEN = 'mock-refresh-token';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthCompatibilityCache();
  });

  // -----------------------------------------------------------------------
  // register
  // -----------------------------------------------------------------------

  describe('register', () => {
    const registerData = {
      email: 'new@example.com',
      username: 'newuser',
      password: 'password123',
    };

    it('should create user, send verification email, and return tokens', async () => {
      const createdUser = {
        id: 'new-user-id',
        email: registerData.email,
        username: registerData.username,
        password: 'hashed-pw',
        role: 'USER',
        avatar: null,
        emailVerified: false,
      };

      mockPrismaUser.findFirst.mockResolvedValue(null);
      mockPasswordUtils.hash.mockResolvedValue('hashed-pw');
      mockPrismaUser.create.mockResolvedValue(createdUser);
      mockEmailVerification.sendVerificationEmail.mockResolvedValue({ success: true });
      mockJwtUtils.sign.mockReturnValue(ACCESS_TOKEN);
      mockJwtUtils.signRefresh.mockReturnValue(REFRESH_TOKEN);

      const result = await AuthService.register(registerData);

      // Verify duplicate check was performed
      expect(mockPrismaUser.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: registerData.email },
            { username: registerData.username },
          ],
        },
        select: { id: true },
      });

      // Verify password was hashed
      expect(mockPasswordUtils.hash).toHaveBeenCalledWith(registerData.password);

      // Verify user was created with correct data
      expect(mockPrismaUser.create).toHaveBeenCalledWith({
        data: {
          email: registerData.email,
          username: registerData.username,
          password: 'hashed-pw',
          role: 'USER',
          emailVerified: false,
        },
        select: {
          id: true,
          email: true,
          username: true,
          password: true,
          role: true,
          isActive: true,
          emailVerified: true,
          avatar: true,
        },
      });

      // Verify verification email was sent
      expect(mockEmailVerification.sendVerificationEmail).toHaveBeenCalledWith(
        createdUser.id,
        createdUser.email,
        createdUser.username
      );

      // Verify JWT tokens were generated
      expect(mockJwtUtils.sign).toHaveBeenCalledWith({
        userId: createdUser.id,
        email: createdUser.email,
        role: createdUser.role,
      });
      expect(mockJwtUtils.signRefresh).toHaveBeenCalledWith({
        userId: createdUser.id,
      });

      // Verify response shape
      expect(result).toEqual({
        user: {
          id: createdUser.id,
          email: createdUser.email,
          username: createdUser.username,
          role: createdUser.role,
          emailVerified: false,
          avatar: null,
        },
        access_token: ACCESS_TOKEN,
        token_type: 'Bearer',
        expires_in: 604800,
        refresh_token: REFRESH_TOKEN,
        token: ACCESS_TOKEN,
      });
    });

    it('should throw when a user with the same email or username already exists', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(TEST_USER);

      await expect(AuthService.register(registerData)).rejects.toThrow(
        'User with this email or username already exists'
      );

      // Should not attempt to create the user
      expect(mockPrismaUser.create).not.toHaveBeenCalled();
      expect(mockPasswordUtils.hash).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // login
  // -----------------------------------------------------------------------

  describe('login', () => {
    const loginData = { email: 'test@example.com', password: 'password123' };

    it('should authenticate successfully and return tokens for a verified active user', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(TEST_USER);
      mockPasswordUtils.verify.mockResolvedValue(true);
      mockJwtUtils.sign.mockReturnValue(ACCESS_TOKEN);
      mockJwtUtils.signRefresh.mockReturnValue(REFRESH_TOKEN);

      const result = await AuthService.login(loginData);

      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { email: loginData.email },
        select: {
          id: true,
          email: true,
          username: true,
          password: true,
          role: true,
          isActive: true,
          emailVerified: true,
          avatar: true,
        },
      });
      expect(mockPasswordUtils.verify).toHaveBeenCalledWith(
        loginData.password,
        TEST_USER.password
      );

      expect(result).toEqual({
        user: {
          id: TEST_USER.id,
          email: TEST_USER.email,
          username: TEST_USER.username,
          role: TEST_USER.role,
          emailVerified: TEST_USER.emailVerified,
          avatar: TEST_USER.avatar,
        },
        access_token: ACCESS_TOKEN,
        token_type: 'Bearer',
        expires_in: 604800,
        refresh_token: REFRESH_TOKEN,
        token: ACCESS_TOKEN,
      });
    });

    it('should throw when the email does not exist', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      await expect(AuthService.login(loginData)).rejects.toThrow(
        'Invalid email or password'
      );

      expect(mockPasswordUtils.verify).not.toHaveBeenCalled();
    });

    it('should throw when the password is incorrect', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(TEST_USER);
      mockPasswordUtils.verify.mockResolvedValue(false);

      await expect(AuthService.login(loginData)).rejects.toThrow(
        'Invalid email or password'
      );

      expect(mockJwtUtils.sign).not.toHaveBeenCalled();
    });

    it('should throw when the user account is inactive', async () => {
      const inactiveUser = { ...TEST_USER, isActive: false };
      mockPrismaUser.findUnique.mockResolvedValue(inactiveUser);
      mockPasswordUtils.verify.mockResolvedValue(true);

      await expect(AuthService.login(loginData)).rejects.toThrow(
        'Account is inactive'
      );
    });

    it('should throw when the email is not verified', async () => {
      const unverifiedUser = { ...TEST_USER, emailVerified: false };
      mockPrismaUser.findUnique.mockResolvedValue(unverifiedUser);
      mockPasswordUtils.verify.mockResolvedValue(true);

      await expect(AuthService.login(loginData)).rejects.toThrow(
        'Email not verified. Please check your email for verification link.'
      );
    });

    it('should fall back to legacy user records when emailVerified column is unavailable', async () => {
      const legacyUser = {
        id: TEST_USER.id,
        email: TEST_USER.email,
        username: TEST_USER.username,
        password: TEST_USER.password,
        role: TEST_USER.role,
        isActive: TEST_USER.isActive,
        avatar: TEST_USER.avatar,
      };

      mockPrismaUser.findUnique
        .mockRejectedValueOnce(new Error('The column `users.emailVerified` does not exist in the current database.'))
        .mockResolvedValueOnce(legacyUser);
      mockPasswordUtils.verify.mockResolvedValue(true);
      mockJwtUtils.sign.mockReturnValue(ACCESS_TOKEN);
      mockJwtUtils.signRefresh.mockReturnValue(REFRESH_TOKEN);

      const result = await AuthService.login(loginData);

      expect(mockPrismaUser.findUnique).toHaveBeenNthCalledWith(1, {
        where: { email: loginData.email },
        select: {
          id: true,
          email: true,
          username: true,
          password: true,
          role: true,
          isActive: true,
          emailVerified: true,
          avatar: true,
        },
      });
      expect(mockPrismaUser.findUnique).toHaveBeenNthCalledWith(2, {
        where: { email: loginData.email },
        select: {
          id: true,
          email: true,
          username: true,
          password: true,
          role: true,
          isActive: true,
          avatar: true,
        },
      });
      expect(result.user.emailVerified).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // getCurrentUser
  // -----------------------------------------------------------------------

  describe('getCurrentUser', () => {
    it('should return the user profile for a valid active user', async () => {
      const userProfile = {
        id: TEST_USER.id,
        email: TEST_USER.email,
        username: TEST_USER.username,
        role: TEST_USER.role,
        isActive: true,
        avatar: TEST_USER.avatar,
        createdAt: TEST_USER.createdAt,
      };
      mockPrismaUser.findUnique.mockResolvedValue(userProfile);

      const result = await AuthService.getCurrentUser(TEST_USER.id);

      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER.id },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
          avatar: true,
          createdAt: true,
        },
      });
      expect(result).toEqual(userProfile);
    });

    it('should throw when the user is not found', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      await expect(AuthService.getCurrentUser('nonexistent-id')).rejects.toThrow(
        'User not found'
      );
    });

    it('should throw when the user account is inactive', async () => {
      const inactiveProfile = {
        id: TEST_USER.id,
        email: TEST_USER.email,
        username: TEST_USER.username,
        role: TEST_USER.role,
        isActive: false,
        avatar: TEST_USER.avatar,
        createdAt: TEST_USER.createdAt,
      };
      mockPrismaUser.findUnique.mockResolvedValue(inactiveProfile);

      await expect(AuthService.getCurrentUser(TEST_USER.id)).rejects.toThrow(
        'Account is inactive'
      );
    });
  });

  // -----------------------------------------------------------------------
  // refreshSession
  // -----------------------------------------------------------------------

  describe('refreshSession', () => {
    it('should return new tokens when given a valid refresh token', async () => {
      const refreshPayload = { userId: TEST_USER.id, type: 'refresh' as const };

      mockJwtUtils.verify.mockReturnValue(refreshPayload);
      mockPrismaUser.findUnique.mockResolvedValue(TEST_USER);
      mockJwtUtils.sign.mockReturnValue('new-access-token');
      mockJwtUtils.signRefresh.mockReturnValue('new-refresh-token');

      const result = await AuthService.refreshSession('valid-refresh-token');

      expect(mockJwtUtils.verify).toHaveBeenCalledWith('valid-refresh-token');
      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER.id },
        select: {
          id: true,
          email: true,
          username: true,
          password: true,
          role: true,
          isActive: true,
          emailVerified: true,
          avatar: true,
        },
      });

      expect(result).toEqual({
        user: {
          id: TEST_USER.id,
          email: TEST_USER.email,
          username: TEST_USER.username,
          role: TEST_USER.role,
          emailVerified: TEST_USER.emailVerified,
          avatar: TEST_USER.avatar,
        },
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 604800,
        refresh_token: 'new-refresh-token',
        token: 'new-access-token',
      });
    });

    it('should refresh sessions against legacy user rows when emailVerified is unavailable', async () => {
      const refreshPayload = { userId: TEST_USER.id, type: 'refresh' as const };
      const legacyUser = {
        id: TEST_USER.id,
        email: TEST_USER.email,
        username: TEST_USER.username,
        password: TEST_USER.password,
        role: TEST_USER.role,
        isActive: TEST_USER.isActive,
        avatar: TEST_USER.avatar,
      };

      mockJwtUtils.verify.mockReturnValue(refreshPayload);
      mockPrismaUser.findUnique
        .mockRejectedValueOnce(new Error('The column `users.emailVerified` does not exist in the current database.'))
        .mockResolvedValueOnce(legacyUser);
      mockJwtUtils.sign.mockReturnValue('new-access-token');
      mockJwtUtils.signRefresh.mockReturnValue('new-refresh-token');

      const result = await AuthService.refreshSession('valid-refresh-token');

      expect(result.user.emailVerified).toBe(true);
    });

    it('should throw when the refresh token is invalid (verify throws)', async () => {
      mockJwtUtils.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(AuthService.refreshSession('expired-token')).rejects.toThrow(
        'Invalid refresh token'
      );

      expect(mockPrismaUser.findUnique).not.toHaveBeenCalled();
    });

    it('should throw when the token payload is missing userId or type', async () => {
      // Payload without the required 'type: refresh' field
      mockJwtUtils.verify.mockReturnValue({ userId: TEST_USER.id, type: 'access' });

      await expect(AuthService.refreshSession('wrong-type-token')).rejects.toThrow(
        'Invalid refresh token'
      );
    });
  });
});
