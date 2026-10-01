import { describe, expect, it } from 'vitest';
import { tryNativePublicAuthConfig } from './public-auth-config';

describe('native public auth configuration', () => {
  it('reports demo mode without exposing invalid credentials', async () => {
    const response = tryNativePublicAuthConfig(
      new Request('https://api.example/api/v1/auth/login-config'),
      { DEMO_MODE: 'true' },
    );

    expect(response?.status).toBe(200);
    expect(response?.headers.get('x-jiffoo-runtime')).toBe('cloudflare-native-auth-config');
    await expect(response?.json()).resolves.toEqual({
      success: true,
      data: { demoModeEnabled: true, demoCredentials: null },
    });
  });

  it('returns a stable normal bootstrap state after credentials are rotated', async () => {
    const response = tryNativePublicAuthConfig(
      new Request('https://api.example/api/v1/auth/bootstrap-status'),
      { DEMO_MODE: 'true' },
    );

    await expect(response?.json()).resolves.toEqual({
      success: true,
      data: {
        mode: 'normal',
        showDemoCredentials: false,
        requiresPasswordRotation: false,
        credentials: null,
      },
    });
  });

  it('does not intercept unrelated routes or writes', () => {
    expect(tryNativePublicAuthConfig(
      new Request('https://api.example/api/v1/auth/login-config', { method: 'POST' }),
      { DEMO_MODE: 'true' },
    )).toBeNull();
    expect(tryNativePublicAuthConfig(
      new Request('https://api.example/api/v1/auth/me'),
      { DEMO_MODE: 'true' },
    )).toBeNull();
  });
});
