import jwt from 'jsonwebtoken';
import { env } from '@/config/env';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  sv: number;
  type?: 'access' | 'refresh';
}

export class JwtUtils {
  static sign(payload: JwtPayload | object, expiresIn: string | number = env.JWT_EXPIRES_IN || '7d'): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: expiresIn as any,
      issuer: 'jiffoo-mall',
    });
  }

  static signRefresh(payload: { userId: string; sv: number }, expiresIn: string | number = '7d'): string {
    return jwt.sign({ ...payload, type: 'refresh' }, env.JWT_SECRET, {
      expiresIn: expiresIn as any,
      issuer: 'jiffoo-mall',
    });
  }

  static verify(token: string): JwtPayload {
    const decoded = jwt.verify(token, env.JWT_SECRET, { complete: true });
    if (typeof decoded.payload !== 'object' || decoded.payload === null || decoded.header.typ === 'plugin-page-v1'
      || decoded.payload.typ === 'plugin-page-v1' || decoded.payload.iss === 'jiffoo-plugin-pages'
      || [decoded.payload.aud].flat().includes('jiffoo-plugin-gateway')) {
      throw new jwt.JsonWebTokenError('Plugin page tokens cannot authenticate Core APIs');
    }
    return decoded.payload as JwtPayload;
  }

  static decode(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }
}
