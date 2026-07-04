import jwt from 'jsonwebtoken';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/create-test-app';
import { deleteAllTestUsers, signJwt } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';

function signServiceJwt(): string {
  return jwt.sign(
    {
      sub: 'plugin:google-auth',
      iss: process.env.SERVICE_JWT_ISSUER || 'jiffoo-platform',
    },
    process.env.JWT_SECRET || 'test-secret-key-for-testing',
    {
      expiresIn: '30s',
    },
  );
}

describe('Service social auth route', () => {
  let app: FastifyInstance;
  const prisma = getTestPrisma();

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await deleteAllTestUsers();
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  it('rejects requests without a service JWT', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/social',
      payload: {
        provider: 'google',
        providerUserId: 'google_subject_1',
        email: 'test-social-google@test.com',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: {
        code: 'UNAUTHORIZED',
      },
    });
  });

  it('rejects normal user JWTs', async () => {
    const normalUserToken = signJwt(
      'user_1',
      'test-normal-user@test.com',
      'USER',
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/social',
      headers: {
        authorization: `Bearer ${normalUserToken}`,
      },
      payload: {
        provider: 'google',
        providerUserId: 'google_subject_2',
        email: 'test-social-normal@test.com',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: {
        code: 'UNAUTHORIZED',
      },
    });
  });

  it('exchanges a plugin-verified Google identity for a standard auth response', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/social',
      headers: {
        authorization: `Bearer ${signServiceJwt()}`,
      },
      payload: {
        provider: 'google',
        providerUserId: 'google_subject_3',
        email: 'test-social-google@test.com',
        displayName: 'Google Social User',
        avatarUrl: 'https://example.com/avatar.png',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toMatchObject({
      account: {
        email: 'test-social-google@test.com',
        name: 'Google Social User',
      },
      user: {
        email: 'test-social-google@test.com',
        emailVerified: true,
        avatar: 'https://example.com/avatar.png',
      },
      token_type: 'Bearer',
      tokenType: 'Bearer',
    });
    expect(body.data.access_token).toEqual(expect.any(String));
    expect(body.data.accessToken).toBe(body.data.access_token);

    const user = await prisma.user.findUnique({
      where: { email: 'test-social-google@test.com' },
    });
    expect(user).toMatchObject({
      username: 'Google Social User',
      emailVerified: true,
      avatar: 'https://example.com/avatar.png',
    });
  });
});
