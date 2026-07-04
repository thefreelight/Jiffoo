import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { authServiceMock } = vi.hoisted(() => ({
  authServiceMock: {
    loginWithGoogle: vi.fn(),
    loginWithApple: vi.fn(),
  },
}));

vi.mock('@/core/auth/service', () => ({
  AuthService: authServiceMock,
}));

vi.mock('@/core/auth/middleware', () => ({
  authMiddleware: vi.fn(async (request: any) => {
    request.user = { id: 'user_1', email: 'user@bokmoo.com', role: 'USER' };
  }),
  requireAdmin: vi.fn(),
}));

vi.mock('@/config/database', () => ({
  prisma: {},
}));

vi.mock('@/services/email-verification.service', () => ({
  EmailVerificationService: {
    verifyToken: vi.fn(),
  },
}));

vi.mock('@/core/auth/bootstrap', () => ({
  completeBootstrapPasswordRotation: vi.fn(),
  getPublicAuthBootstrapStatus: vi.fn(),
}));

import { authRoutes } from '@/core/auth/routes';

async function createAuthApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.ready();
  return app;
}

function authPayload(overrides: Record<string, unknown> = {}) {
  return {
    account: {
      id: 'user_1',
      name: 'BOKMOO User',
      email: 'user@bokmoo.com',
      membership: 'Member',
    },
    accessToken: 'access_token',
    tokenType: 'Bearer',
    refreshToken: 'refresh_token',
    ...overrides,
  };
}

describe('BOKMOO social auth routes', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('exchanges a Google ID token for a BOKMOO session', async () => {
    authServiceMock.loginWithGoogle.mockResolvedValue(authPayload());

    const app = await createAuthApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/google',
        payload: { idToken: 'google_id_token' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({
        account: {
          id: 'user_1',
          email: 'user@bokmoo.com',
        },
        accessToken: 'access_token',
        tokenType: 'Bearer',
      });
      expect(authServiceMock.loginWithGoogle).toHaveBeenCalledWith({ idToken: 'google_id_token' });
    } finally {
      await app.close();
    }
  });

  it('maps Google token verification failures to the app error envelope', async () => {
    authServiceMock.loginWithGoogle.mockRejectedValue(new Error('Google email is not verified'));

    const app = await createAuthApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/google',
        payload: { idToken: 'bad_google_id_token' },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: {
          code: 'GOOGLE_AUTH_FAILED',
          message: 'Google email is not verified',
        },
      });
    } finally {
      await app.close();
    }
  });

  it('exchanges an Apple identity token for a BOKMOO session', async () => {
    authServiceMock.loginWithApple.mockResolvedValue(authPayload({
      account: {
        id: 'user_apple',
        name: 'Apple BOKMOO User',
        email: 'apple.user@bokmoo.com',
        membership: 'Member',
      },
    }));

    const app = await createAuthApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/apple',
        payload: {
          identityToken: 'apple_identity_token',
          name: 'Apple BOKMOO User',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({
        account: {
          id: 'user_apple',
          email: 'apple.user@bokmoo.com',
        },
        accessToken: 'access_token',
        tokenType: 'Bearer',
      });
      expect(authServiceMock.loginWithApple).toHaveBeenCalledWith({
        identityToken: 'apple_identity_token',
        name: 'Apple BOKMOO User',
      });
    } finally {
      await app.close();
    }
  });

  it('supports Apple authorization-code based login at the route contract level', async () => {
    authServiceMock.loginWithApple.mockResolvedValue(authPayload());

    const app = await createAuthApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/apple',
        payload: { authorizationCode: 'apple_auth_code' },
      });

      expect(response.statusCode).toBe(200);
      expect(authServiceMock.loginWithApple).toHaveBeenCalledWith({ authorizationCode: 'apple_auth_code' });
    } finally {
      await app.close();
    }
  });
});
