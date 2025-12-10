import jwt from 'jsonwebtoken';
import { env } from '@/config/env';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  type?: 'access' | 'refresh';
}

export class JwtUtils {
  static sign(payload: JwtPayload | object, expiresIn: string | number = env.JWT_EXPIRES_IN || '7d'): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: expiresIn as any,
      issuer: 'jiffoo-mall',
    });
  }

  static signRefresh(payload: { userId: string }, expiresIn: string | number = '7d'): string {
    return jwt.sign({ ...payload, type: 'refresh' }, env.JWT_SECRET, {
      expiresIn: expiresIn as any,
      issuer: 'jiffoo-mall',
    });
  }

  static verify(token: string): JwtPayload {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  }

  static decode(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }
}
