import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '@/config/env';
import { ApiError } from '@/utils/api-errors';

export function fileUrlSecret(): Buffer {
  const raw = process.env.PLUGIN_FILE_URL_SECRET;
  const key = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
  if (!raw || key.length < 32 || key.toString('base64') !== raw || new Set(key).size < 16
    || [env.JWT_SECRET, env.PLUGIN_SECRETS_KEY, process.env.PLUGIN_PAGE_TOKEN_SECRET].filter(Boolean).some(value => value === raw || value === key.toString('utf8'))) {
    throw new Error('PLUGIN_FILE_URL_SECRET requires a dedicated strong base64 key of at least 32 bytes');
  }
  return key;
}
const claimsSchema = z.object({ fileId: z.string().uuid(), installationId: z.string().min(1).max(128),
  ownerType: z.enum(['CUSTOMER', 'ADMIN']), ownerId: z.string().min(1).max(128), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  generation: z.string().regex(/^\d+$/), disposition: z.enum(['inline', 'attachment']),
  exp: z.number().int(), iat: z.number().int(), jti: z.string().uuid(), aud: z.literal('jiffoo-plugin-file'), iss: z.literal('jiffoo-private-files') }).strict();
export type FileGrant = z.infer<typeof claimsSchema>;

export function signFileGrant(input: Omit<FileGrant, 'exp' | 'iat' | 'jti' | 'aud' | 'iss'>, now: Date) {
  const iat = Math.floor(now.getTime() / 1000), exp = iat + 60;
  const token = jwt.sign({ ...input, iat, exp, jti: randomUUID() }, fileUrlSecret(), {
    algorithm: 'HS256', audience: 'jiffoo-plugin-file', issuer: 'jiffoo-private-files', header: { alg: 'HS256', typ: 'plugin-file-v1' },
  });
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

export function verifyFileGrant(token: string): FileGrant {
  try {
    const value = jwt.verify(token, fileUrlSecret(), { algorithms: ['HS256'], audience: 'jiffoo-plugin-file', issuer: 'jiffoo-private-files', complete: true });
    const claims = claimsSchema.parse(value.payload);
    if (value.header.typ !== 'plugin-file-v1' || claims.exp - claims.iat !== 60 || claims.iat > Math.floor(Date.now() / 1000)) throw new Error('Invalid grant lifetime');
    return claims;
  } catch { throw new ApiError('PLUGIN_FILE_NOT_FOUND'); }
}
