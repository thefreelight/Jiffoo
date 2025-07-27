import jwt from 'jsonwebtoken';
import { env } from '@/config/env';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export class JwtUtils {
  static sign(payload: JwtPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: '7d',
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
