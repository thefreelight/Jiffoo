import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { getTestPrisma } from '../helpers/db';

describe('BOKMOO auth compatibility routes', () => {
  let app: FastifyInstance;
  const prisma = getTestPrisma();
  const phonesToClean: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    if (phonesToClean.length > 0) {
      await prisma.user.deleteMany({
        where: {
          OR: [
            { phone: { in: phonesToClean } },
            { email: { endsWith: '@phone.bokmoo.local' } },
          ],
        },
      });
    }
    await app.close();
  });

  it('supports phone registration, phone login, and account retrieval', async () => {
    const phone = `+1555${Date.now().toString().slice(-8)}`;
    phonesToClean.push(phone);
    const password = 'Test123456!';

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        phone,
        name: 'BOKMOO Phone User',
        password,
      },
    });

    expect(registerResponse.statusCode).toBe(201);
    const registerBody = registerResponse.json();
    expect(registerBody.data.account.phone).toBe(phone);
    expect(registerBody.data.accessToken).toEqual(expect.any(String));
    expect(registerBody.data.tokenType).toBe('Bearer');

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: phone,
        password,
      },
    });

    expect(loginResponse.statusCode).toBe(200);
    const loginBody = loginResponse.json();
    expect(loginBody.data.account.phone).toBe(phone);
    expect(loginBody.data.accessToken).toEqual(expect.any(String));
    expect(loginBody.data.refreshToken).toEqual(expect.any(String));

    const refreshResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: {
        refreshToken: loginBody.data.refreshToken,
      },
    });

    expect(refreshResponse.statusCode).toBe(200);
    const refreshBody = refreshResponse.json();
    expect(refreshBody.data.account.phone).toBe(phone);
    expect(refreshBody.data.accessToken).toEqual(expect.any(String));

    const accountResponse = await app.inject({
      method: 'GET',
      url: '/api/account',
      headers: {
        authorization: `Bearer ${refreshBody.data.accessToken}`,
      },
    });

    expect(accountResponse.statusCode).toBe(200);
    const accountBody = accountResponse.json();
    expect(accountBody.data.account.phone).toBe(phone);
    expect(accountBody.data.profile.phone).toBe(phone);

    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });

    expect(logoutResponse.statusCode).toBe(200);
    expect(logoutResponse.json().data.loggedOut).toBe(true);
  });
});
