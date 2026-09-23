import crypto from 'node:crypto';
import { AuthTokenPurpose } from '@prisma/client';
import { env } from '@/config/env';
import type { NotificationTransaction } from '@/core/notifications/service';

const durations: Record<AuthTokenPurpose, number> = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
  STAFF_INVITE: 72 * 60 * 60 * 1000,
};

export function hashAuthToken(token: string): string {
  return crypto.createHmac('sha256', env.JWT_SECRET).update(token).digest('hex');
}

export function hashVerificationCode(tokenHash: string, code: string): string {
  return crypto.createHmac('sha256', env.JWT_SECRET).update(`${tokenHash}:${code}`).digest('hex');
}

export async function issueAuthToken(tx: NotificationTransaction, userId: string, purpose: AuthTokenPurpose, code?: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashAuthToken(token);
  const now = new Date();
  await tx.authToken.updateMany({
    where: { userId, purpose, consumedAt: null },
    data: { consumedAt: now },
  });
  await tx.authToken.create({
    data: {
      userId, purpose, tokenHash,
      codeHash: code === undefined ? null : hashVerificationCode(tokenHash, code),
      expiresAt: new Date(now.getTime() + durations[purpose]),
    },
  });
  return token;
}

export async function consumeAuthToken(tx: NotificationTransaction, token: string, purpose: AuthTokenPurpose) {
  const row = await tx.authToken.findUnique({ where: { tokenHash: hashAuthToken(token) } });
  if (!row || row.purpose !== purpose || row.consumedAt || row.expiresAt <= new Date() || row.attempts >= 5) {
    throw new Error('Invalid or expired token');
  }
  const result = await tx.authToken.updateMany({
    where: { id: row.id, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: 5 } },
    data: { consumedAt: new Date() },
  });
  if (result.count !== 1) throw new Error('Invalid or expired token');
  return row;
}
