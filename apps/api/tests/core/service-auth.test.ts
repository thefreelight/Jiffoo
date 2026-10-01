import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { verifyServiceToken } from '@/core/auth/service-auth';

describe('service authentication', () => {
  it('accepts only HS256 tokens signed with the service secret and issuer', () => {
    const token = jwt.sign({ sub: 'plugin:subscription' }, process.env.SERVICE_JWT_SECRET!, {
      algorithm: 'HS256',
      issuer: process.env.SERVICE_JWT_ISSUER || 'jiffoo-platform',
      expiresIn: '5m',
    });
    expect(verifyServiceToken(token).sub).toBe('plugin:subscription');

    const userToken = jwt.sign({ sub: 'plugin:subscription' }, process.env.JWT_SECRET!, {
      algorithm: 'HS256',
      issuer: 'jiffoo-mall',
      expiresIn: '5m',
    });
    expect(() => verifyServiceToken(userToken)).toThrow();
  });
});
