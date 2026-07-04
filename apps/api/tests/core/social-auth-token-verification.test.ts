import { generateKeyPairSync } from 'crypto';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { OAuth2ClientMock, verifyIdTokenMock } = vi.hoisted(() => {
  const verifyIdTokenMock = vi.fn();
  const OAuth2ClientMock = vi.fn(function OAuth2Client(this: any) {
    this.verifyIdToken = verifyIdTokenMock;
  });
  return { OAuth2ClientMock, verifyIdTokenMock };
});

vi.mock('google-auth-library', () => ({
  OAuth2Client: OAuth2ClientMock,
}));

import { AuthService } from '@/core/auth/service';

const GOOGLE_ENV_KEYS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_WEB_CLIENT_ID',
  'GOOGLE_ANDROID_CLIENT_ID',
  'GOOGLE_IOS_CLIENT_ID',
  'BOKMOO_GOOGLE_CLIENT_ID',
];

const APPLE_ENV_KEYS = [
  'APPLE_CLIENT_ID',
  'APPLE_BUNDLE_ID',
  'APPLE_SERVICE_ID',
  'BOKMOO_APPLE_CLIENT_ID',
  'BOKMOO_APPLE_BUNDLE_ID',
  'APPLE_CLIENT_SECRET',
  'BOKMOO_APPLE_CLIENT_SECRET',
];

const ORIGINAL_ENV = { ...process.env };

function clearEnv(keys: string[]) {
  for (const key of keys) {
    delete process.env[key];
  }
}

function mockJsonResponse(payload: Record<string, unknown>, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => payload,
  };
}

function buildAppleFixture(audience = 'com.bokmoo.app') {
  const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = keyPair.publicKey.export({ format: 'jwk' }) as JsonWebKey;
  Object.assign(jwk, {
    kid: 'apple_test_key',
    alg: 'RS256',
    use: 'sig',
  });

  const privateKeyPem = keyPair.privateKey.export({
    type: 'pkcs1',
    format: 'pem',
  });

  const identityToken = jwt.sign({
    iss: 'https://appleid.apple.com',
    aud: audience,
    sub: 'apple_subject_123',
    email: 'apple.user@bokmoo.com',
    email_verified: 'true',
  }, privateKeyPem, {
    algorithm: 'RS256',
    keyid: 'apple_test_key',
    expiresIn: '10m',
  });

  return { identityToken, jwk };
}

const appleFixture = buildAppleFixture();

describe('social auth token verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'test' };
    clearEnv(GOOGLE_ENV_KEYS);
    clearEnv(APPLE_ENV_KEYS);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('does not accept Google ID tokens without configured audiences', async () => {
    await expect(AuthService.verifyGoogleIdToken('google_id_token')).rejects.toThrow(
      'Google auth is not configured',
    );
    expect(verifyIdTokenMock).not.toHaveBeenCalled();
  });

  it('verifies Google ID tokens against configured app audiences', async () => {
    process.env.GOOGLE_ANDROID_CLIENT_ID = 'android-client.apps.googleusercontent.com';
    process.env.BOKMOO_GOOGLE_CLIENT_ID = 'bokmoo-client.apps.googleusercontent.com';
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({
        sub: 'google_subject_123',
        email: 'google.user@bokmoo.com',
        email_verified: true,
        name: 'Google BOKMOO User',
        picture: 'https://example.com/avatar.png',
      }),
    });

    const identity = await AuthService.verifyGoogleIdToken('google_id_token');

    expect(verifyIdTokenMock).toHaveBeenCalledWith({
      idToken: 'google_id_token',
      audience: [
        'android-client.apps.googleusercontent.com',
        'bokmoo-client.apps.googleusercontent.com',
      ],
    });
    expect(identity).toEqual({
      provider: 'google',
      subject: 'google_subject_123',
      email: 'google.user@bokmoo.com',
      emailVerified: true,
      name: 'Google BOKMOO User',
      avatar: 'https://example.com/avatar.png',
    });
  });

  it('rejects Google ID tokens with unverified email claims', async () => {
    process.env.BOKMOO_GOOGLE_CLIENT_ID = 'bokmoo-client.apps.googleusercontent.com';
    verifyIdTokenMock.mockResolvedValue({
      getPayload: () => ({
        sub: 'google_subject_123',
        email: 'google.user@bokmoo.com',
        email_verified: false,
      }),
    });

    await expect(AuthService.verifyGoogleIdToken('google_id_token')).rejects.toThrow(
      'Google email is not verified',
    );
  });

  it('verifies Apple identity tokens using Apple JWKS and configured audiences', async () => {
    process.env.BOKMOO_APPLE_BUNDLE_ID = 'com.bokmoo.app';
    const fetchMock = vi.fn(async () => mockJsonResponse({ keys: [appleFixture.jwk] }));
    vi.stubGlobal('fetch', fetchMock);

    const identity = await AuthService.verifyAppleIdentity({
      identityToken: appleFixture.identityToken,
      name: 'Apple BOKMOO User',
    });

    expect(fetchMock).toHaveBeenCalledWith('https://appleid.apple.com/auth/keys');
    expect(identity).toEqual({
      provider: 'apple',
      subject: 'apple_subject_123',
      email: 'apple.user@bokmoo.com',
      emailVerified: true,
      name: 'Apple BOKMOO User',
      avatar: null,
    });
  });

  it('supports Apple authorization code exchange before identity verification', async () => {
    process.env.BOKMOO_APPLE_BUNDLE_ID = 'com.bokmoo.app';
    process.env.BOKMOO_APPLE_CLIENT_SECRET = 'test-client-secret';
    const fetchMock = vi.fn(async (url: string | URL) => {
      const href = String(url);
      if (href === 'https://appleid.apple.com/auth/token') {
        return mockJsonResponse({ id_token: appleFixture.identityToken });
      }
      if (href === 'https://appleid.apple.com/auth/keys') {
        return mockJsonResponse({ keys: [appleFixture.jwk] });
      }
      return mockJsonResponse({ error: 'unexpected_url' }, false);
    });
    vi.stubGlobal('fetch', fetchMock);

    const identity = await AuthService.verifyAppleIdentity({
      authorizationCode: 'apple_auth_code',
    });

    const tokenExchangeCall = fetchMock.mock.calls.find(([url]) =>
      String(url) === 'https://appleid.apple.com/auth/token',
    );
    expect(tokenExchangeCall?.[1]).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(String((tokenExchangeCall?.[1] as any).body)).toContain('code=apple_auth_code');
    expect(identity).toMatchObject({
      provider: 'apple',
      subject: 'apple_subject_123',
      email: 'apple.user@bokmoo.com',
    });
  });
});
