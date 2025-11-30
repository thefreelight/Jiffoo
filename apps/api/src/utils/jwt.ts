import jwt from 'jsonwebtoken';
import { env } from '@/config/env';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  tenantId?: number;  // 修改为number类型
  type?: 'access' | 'refresh'; // 支持不同类型的token
}

export class JwtUtils {
  static sign(payload: JwtPayload | object, expiresIn: string | number = env.JWT_EXPIRES_IN || '7d'): string {
    return jwt.sign(payload, env.JWT_SECRET, {
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
