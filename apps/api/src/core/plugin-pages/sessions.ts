import { PluginPageDeclarationService } from "@/core/admin/extension-installer/page-declarations-service";
import { recordTaskPrincipalInTransaction } from '@/core/plugins/tasks';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { FastifyRequest } from 'fastify';
import type { PluginPageSession } from '@prisma/client';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { JwtUtils } from '@/utils/jwt';
import { ApiError } from '@/utils/api-errors';
import { pluginPublicOrigins } from './asset-routes';
import type { PluginPageAdmission } from './origin-policy';

export type PageSurface = 'shop' | 'admin';
export type PageTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
const digest = (secret: string) => createHash('sha256').update(secret).digest('hex');

/** Canonical base64 keys prevent accidental reuse of ordinary JWT or file keys. */
export function pageTokenSecret(): Buffer {
  const raw = process.env.PLUGIN_PAGE_TOKEN_SECRET;
  const bytes = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
  if (!raw || bytes.length < 32 || bytes.toString('base64') !== raw || new Set(bytes).size < 16
    || [env.JWT_SECRET, env.PLUGIN_SECRETS_KEY, process.env.PLUGIN_FILE_URL_SECRET].filter(Boolean).some(other => other === raw || other === bytes.toString('utf8'))) {
    throw new Error('PLUGIN_PAGE_TOKEN_SECRET requires a dedicated strong base64 key of at least 32 bytes');
  }
  return bytes;
}

export function shellOrigin(request: FastifyRequest, surface: PageSurface): string {
  const origins = pluginPublicOrigins({ STOREFRONT_URL: process.env.STOREFRONT_URL, ADMIN_URL: process.env.ADMIN_URL });
  const expected = origins?.[surface === 'shop' ? 0 : 1]?.origin;
  if (!expected || request.headers.origin !== expected || request.headers.cookie !== undefined) throw new ApiError('PLUGIN_PAGE_ORIGIN_FORBIDDEN');
  return expected;
}

export async function shellIdentity(request: FastifyRequest, surface: PageSurface) {
  const authorization = request.headers.authorization;
  if (authorization === undefined && surface === 'shop') return null;
  const token = authorization?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!token || token.startsWith('jiffoo_')) throw new ApiError('INVALID_TOKEN');
  let claims;
  try { claims = JwtUtils.verify(token); } catch { throw new ApiError('INVALID_TOKEN'); }
  if (claims.type === 'refresh' || typeof claims.userId !== 'string' || !Number.isSafeInteger(claims.sv)) throw new ApiError('INVALID_TOKEN');
  const user = await prisma.user.findUnique({ where: { id: claims.userId }, select: {
    id: true, email: true, username: true, role: true, emailVerified: true, sessionVersion: true, isActive: true, removedAt: true,
  } });
  if (!user?.isActive || user.removedAt || user.sessionVersion !== claims.sv) throw new ApiError('SESSION_REVOKED');
  if (user.role !== (surface === 'admin' ? 'ADMIN' : 'USER')) throw new ApiError('FORBIDDEN');
  return user;
}

export const currentPage = PluginPageDeclarationService.currentPage;

export async function validateSession(tx: PageTransaction, session: PluginPageSession) {
  const now = (await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0].now;
  if (session.revokedAt || session.expiresAt <= now || !['shop', 'admin'].includes(session.surface)) throw new ApiError('PLUGIN_PAGE_SESSION_REVOKED');
  const current = await PluginPageDeclarationService.currentForInstallation(tx, session.installationId, session.surface as PageSurface, session.pageId);
  const { installation } = current;
  if (current.installation.id !== session.installationId || installation.protectionGeneration !== session.generation || installation.plugin.zipHash !== session.zipHash) throw new ApiError('PLUGIN_PAGE_SESSION_REVOKED');
  const user = session.principalId ? await tx.user.findUnique({ where: { id: session.principalId }, select: {
    id: true, email: true, username: true, role: true, emailVerified: true, sessionVersion: true, isActive: true, removedAt: true,
  } }) : null;
  const expectedType = session.surface === 'admin' ? 'ADMIN' : 'CUSTOMER';
  if (session.principalType === 'GUEST') {
    if (session.surface !== 'shop' || ('requiresLogin' in current.page && current.page.requiresLogin) || session.principalId || session.sessionVersion !== null) throw new ApiError('PLUGIN_PAGE_SESSION_REVOKED');
  } else if (session.principalType !== expectedType || !user?.isActive || user.removedAt || user.role !== (session.surface === 'admin' ? 'ADMIN' : 'USER') || user.sessionVersion !== session.sessionVersion) throw new ApiError('PLUGIN_PAGE_SESSION_REVOKED');
  return { ...current, user, now };
}

export function signPageToken(session: PluginPageSession, slug: string, now: Date) {
  const issued = Math.floor(now.getTime() / 1000);
  const exp = issued + 120;
  if (exp * 1000 > session.expiresAt.getTime()) throw new ApiError('PLUGIN_PAGE_SESSION_REVOKED');
  const scopes = session.principalType === 'GUEST' ? ['gateway:invoke'] : ['gateway:invoke', 'storage:upload', 'storage:read'];
  return { token: jwt.sign({ sid: session.id, installationId: session.installationId, slug,
    zipHash: session.zipHash, generation: session.generation.toString(), surface: session.surface, pageId: session.pageId,
    sub: session.principalId ?? `guest:${session.id}`, role: session.principalType, sv: session.sessionVersion,
    scopes, iat: issued, exp, jti: randomUUID() }, pageTokenSecret(), { algorithm: 'HS256', issuer: 'jiffoo-plugin-pages', audience: 'jiffoo-plugin-gateway', header: { alg: 'HS256', typ: 'plugin-page-v1' } }), expiresAt: new Date(exp * 1000).toISOString() };
}

export async function issuePageSession(request: FastifyRequest, slug: string, surface: PageSurface, pageId: string) {
  const origin = shellOrigin(request, surface);
  const user = await shellIdentity(request, surface);
  const guestSecret = user ? null : randomBytes(32).toString('base64url');
  return prisma.$transaction(async tx => {
    const candidate = await currentPage(tx, slug, surface, pageId);
    await tx.$queryRaw`SELECT id FROM public.plugin_installations WHERE id = ${candidate.installation.id} FOR SHARE`;
    const { installation, page } = await currentPage(tx, slug, surface, pageId);
    if ('requiresLogin' in page && page.requiresLogin && !user) throw new ApiError('UNAUTHORIZED');
    // Lock the live identity so logout/sessionVersion changes serialize with issuance.
    if (user) {
      await tx.$queryRaw`SELECT id FROM public.users WHERE id = ${user.id} FOR SHARE`;
      const live = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (!live.isActive || live.removedAt || live.sessionVersion !== user.sessionVersion || live.role !== user.role) throw new ApiError('SESSION_REVOKED');
      await recordTaskPrincipalInTransaction(tx, installation.id, user, 'PAGE_SESSION');
    }
    const now = (await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0].now;
    const session = await tx.pluginPageSession.create({ data: { installationId: installation.id, generation: installation.protectionGeneration, zipHash: installation.plugin.zipHash!, surface, pageId,
      principalType: user ? surface === 'admin' ? 'ADMIN' : 'CUSTOMER' : 'GUEST', principalId: user?.id, sessionVersion: user?.sessionVersion, guestSecretHash: guestSecret ? digest(guestSecret) : null, expiresAt: new Date(now.getTime() + 30 * 60_000) } });
    const frame = new URL(`/api/v1/plugin-assets/${installation.id}/${session.zipHash}/${page.entry}`, origin);
    frame.searchParams.set('shellOrigin', origin);
    return { session, page, user: user ? { id: user.id, displayName: user.username, email: user.email } : null, guestSecret, frameUrl: frame.href, ...signPageToken(session, slug, now) };
  });
}

export async function authorizeShellSession(request: FastifyRequest, slug: string, id: string, rotate = true) {
  const session = await prisma.pluginPageSession.findUnique({ where: { id } });
  if (!session) throw new ApiError('PLUGIN_PAGE_SESSION_REVOKED');
  shellOrigin(request, session.surface as PageSurface);
  const user = await shellIdentity(request, session.surface as PageSurface);
  if (session.principalType === 'GUEST') {
    const secret = (request.body as { guestSecret?: unknown } | undefined)?.guestSecret;
    if (user || typeof secret !== 'string' || secret.length !== 43 || !session.guestSecretHash || !timingSafeEqual(Buffer.from(digest(secret)), Buffer.from(session.guestSecretHash))) throw new ApiError('PLUGIN_PAGE_SESSION_REVOKED');
  } else if (!user || user.id !== session.principalId || user.sessionVersion !== session.sessionVersion) throw new ApiError('PLUGIN_PAGE_SESSION_REVOKED');
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM public.plugin_installations WHERE id = ${session.installationId} FOR SHARE`;
    if (session.principalId) await tx.$queryRaw`SELECT id FROM public.users WHERE id = ${session.principalId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM public.plugin_page_sessions WHERE id = ${id} FOR SHARE`;
    const liveSession = await tx.pluginPageSession.findUnique({ where: { id } });
    if (!liveSession) throw new ApiError('PLUGIN_PAGE_SESSION_REVOKED');
    const validated = await validateSession(tx, liveSession);
    if (validated.installation.pluginSlug !== slug) throw new ApiError('PLUGIN_PAGE_SESSION_REVOKED');
    return { session: liveSession, ...validated, ...(rotate ? signPageToken(liveSession, slug, validated.now) : {}) };
  });
}

export async function verifyPluginPageToken(token: string, _request: FastifyRequest, slug: string, transaction?: PageTransaction): Promise<PluginPageAdmission | null> {
  let claims: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(token, pageTokenSecret(), { algorithms: ['HS256'], issuer: 'jiffoo-plugin-pages', audience: 'jiffoo-plugin-gateway', clockTolerance: 5, complete: true });
    if (typeof decoded !== 'object' || decoded.header.typ !== 'plugin-page-v1' || typeof decoded.payload !== 'object') return null;
    claims = decoded.payload;
  } catch (error) { if (error instanceof jwt.JsonWebTokenError) return null; throw error; }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  if (claims.aud !== 'jiffoo-plugin-gateway' || typeof claims.sid !== 'string' || !uuid.test(claims.sid) || typeof claims.jti !== 'string' || !uuid.test(claims.jti) || !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) || claims.exp! - claims.iat! !== 120 || claims.iat! > Math.floor(Date.now()/1000)+5 || claims.slug !== slug) return null;
  const verify = async (tx: PageTransaction): Promise<PluginPageAdmission | null> => {
    let session = await tx.pluginPageSession.findUnique({ where: { id: claims.sid } });
    if (!session) return null;
    if (transaction) {
      await tx.$queryRaw`SELECT id FROM public.plugin_installations WHERE id = ${session.installationId} FOR SHARE`;
      if (session.principalId) await tx.$queryRaw`SELECT id FROM public.users WHERE id = ${session.principalId} FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM public.plugin_page_sessions WHERE id = ${session.id} FOR SHARE`;
      session = await tx.pluginPageSession.findUnique({ where: { id: claims.sid } });
      if (!session) return null;
    }
    if (claims.exp! * 1000 > session.expiresAt.getTime()) return null;
    const { user, installation } = await validateSession(tx, session);
    const expectedScopes = session.principalType === 'GUEST' ? ['gateway:invoke'] : ['gateway:invoke', 'storage:upload', 'storage:read'];
    if (installation.pluginSlug !== slug || claims.installationId !== session.installationId || claims.zipHash !== session.zipHash || claims.generation !== session.generation.toString() || claims.surface !== session.surface || claims.pageId !== session.pageId || claims.sub !== (session.principalId ?? `guest:${session.id}`) || claims.role !== session.principalType || claims.sv !== session.sessionVersion || JSON.stringify(claims.scopes) !== JSON.stringify(expectedScopes)) return null;
    return { slug, installationId: session.installationId, zipHash: session.zipHash, generation: session.generation.toString(), surface: session.surface as PageSurface, pageId: session.pageId, user: user ? { id:user.id,userId:user.id,email:user.email,username:user.username || user.email.split('@')[0],role:user.role,emailVerified:user.emailVerified,roles:[user.role] } : null };
  };
  return transaction ? verify(transaction) : prisma.$transaction(verify);
}

