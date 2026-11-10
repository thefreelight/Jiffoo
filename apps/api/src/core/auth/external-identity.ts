import { prisma } from '@/config/database';
import { env } from '@/config/env';
import type { IdentityProviderPort, IdentityProviderSnapshot } from '@/types/identity-provider';
import { Prisma, type User } from '@prisma/client';
import type { IdentityV1Input, IdentityV1Method, IdentityV1Output } from '@jiffoo/shared';
import { identityV1Methods } from '@jiffoo/shared';
import { JwtUtils } from '@/utils/jwt';
import { identitySecret, identityHash, identityChallenge, sealIdentityMaterial, openIdentityMaterial } from './identity-crypto';
import { emitEvent } from '@/infra/events/emit';
import { customerSnapshot } from '@/infra/events/snapshots';
import { z } from 'zod';
import { AuthIdentityService } from './identity-service';

type Session = Readonly<{ userId: string; sessionVersion: number }>;
type Identity = Extract<IdentityV1Output<'complete'>, { outcome: 'verified' }>;
export class IdentityError extends Error {
  constructor(readonly code: string, readonly status = 400) { super(code); }
}
function fail(code: string): never { throw new IdentityError(code); }
const customer = (user: Pick<User, 'role' | 'isActive' | 'removedAt'> | null): void => {
  if (!user || user.role !== 'USER' || !user.isActive || user.removedAt) fail('IDENTITY_ACCOUNT_UNAVAILABLE');
};
export function identityReturnPath(value: string, locale: string): string {
  if (!['en', 'zh-Hans', 'zh-Hant'].includes(locale)) fail('IDENTITY_TRANSACTION_INVALID');
  let decoded = value;
  try { for (let i = 0; i < 3; i++) decoded = decodeURIComponent(decoded); } catch { fail('IDENTITY_TRANSACTION_INVALID'); }
  if (!value.startsWith('/') || decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded) || !decoded.startsWith('/' + locale + '/') && decoded !== '/' + locale) fail('IDENTITY_TRANSACTION_INVALID');
  return value;
}
export function identityCallbackUri(slug: string, base = env.NEXT_PUBLIC_API_URL): string {
  const url = new URL(base);
  if (url.username || url.password || url.search || url.hash || !['https:', 'http:'].includes(url.protocol)) fail('IDENTITY_UNAVAILABLE');
  url.pathname = url.pathname.replace(/\/+$/, '') + '/auth/identity/' + encodeURIComponent(slug) + '/callback';
  return url.href;
}
export function createExternalIdentityService(port: IdentityProviderPort) {
async function invoke<M extends IdentityV1Method>(slug: string, method: M, input: IdentityV1Input<M>): Promise<IdentityV1Output<M>> {
  try { return await port.invoke(slug, method, input); }
  catch { throw new IdentityError('IDENTITY_UNAVAILABLE', 503); }
}
function finish(locale: string, values: Record<string, string>): string {
  const url = new URL('/' + locale + '/auth/identity/finish', env.STOREFRONT_URL);
  for (const [key, value] of Object.entries(values)) {
    if (key === 'code') url.hash = new URLSearchParams({ code: value }).toString();
    else url.searchParams.set(key, value);
  }
  return url.href;
}
async function readyIdentities() {
  const before = await port.snapshot();
  const data = await Promise.all(before.map(async snapshot => {
    try { const info = await invoke(snapshot.pluginSlug, 'describe', {}); return { ...snapshot, ...info }; }
    catch { return { ...snapshot, label: snapshot.pluginSlug, ready: false, issuer: '', callbackMethod: 'GET' as const, pkce: 'none' as const }; }
  }));
  const after = await port.snapshot();
  return data.filter(value => after.some(row => row.installationId === value.installationId && row.token === value.token));
}
async function identityProviders() {
  return { providers: (await readyIdentities()).map(info => ({ slug: info.pluginSlug, label: info.label, ready: info.ready })) };
}
async function beginIdentity(slug: string, input: { intent: 'login' | 'link'; returnTo: string; locale: string; browserBinding: string }, session?: Session) {
  await pruneIdentityTransactions();
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(input.browserBinding)) fail('IDENTITY_TRANSACTION_INVALID');
  const returnTo = identityReturnPath(input.returnTo, input.locale);
  if (input.intent === 'link' && !session) fail('IDENTITY_ACCOUNT_UNAVAILABLE');
  if (session && input.intent === 'link') {
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    customer(user);
    if (user!.sessionVersion !== session.sessionVersion) fail('IDENTITY_ACCOUNT_UNAVAILABLE');
  }
  const info = (await readyIdentities()).find(value => value.pluginSlug === slug && value.ready);
  if (!info) fail('IDENTITY_UNAVAILABLE');
  const state = identitySecret(), nonce = identitySecret(), verifier = identitySecret();
  const transaction = await prisma.identityTransaction.create({ data: {
    providerSlug: slug, issuer: info.issuer, stateHash: identityHash(state, 'state'), bindingHash: identityHash(input.browserBinding, 'binding'),
    encryptedPayload: sealIdentityMaterial({ nonce, verifier, callbackMethod: info.callbackMethod, providerToken: info.token, installationId: info.installationId }), intent: input.intent, returnTo, locale: input.locale,
    userId: input.intent === 'link' ? session!.userId : null, sessionVersion: input.intent === 'link' ? session!.sessionVersion : null,
    expiresAt: new Date(Date.now() + 10 * 60_000),
  } });
  try {
    const result = await invoke(slug, 'authorize', { redirectUri: identityCallbackUri(slug), state, nonce, codeChallenge: identityChallenge(verifier) });
    if (result.outcome !== 'ready') fail('IDENTITY_UNAVAILABLE');
    const url = new URL(result.authorizationUrl);
    if (!(await port.snapshot()).some(value => value.installationId === info.installationId && value.token === info.token)) fail('IDENTITY_UNAVAILABLE');
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) fail('IDENTITY_UNAVAILABLE');
    return { authorizationUrl: url.href };
  } catch {
    await prisma.identityTransaction.update({ where: { id: transaction.id }, data: { consumedAt: new Date(), encryptedPayload: null } });
    throw new IdentityError('IDENTITY_UNAVAILABLE', 503);
  }
}
async function pruneIdentityTransactions(): Promise<number> {
  const result = await prisma.identityTransaction.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  return result.count;
}
async function identityCallback(slug: string, input: { state: string; method: string; code?: string; error?: string; user?: { firstName?: string; lastName?: string } }) {
  const row = await prisma.identityTransaction.findUnique({ where: { stateHash: identityHash(input.state, 'state') } });
  if (!row || row.providerSlug !== slug || row.expiresAt.getTime() <= Date.now() || row.claimedAt || row.consumedAt || !row.encryptedPayload) return finish('en', { error: 'IDENTITY_TRANSACTION_INVALID' });
  let material: ReturnType<typeof openIdentityMaterial>;
  try { material = openIdentityMaterial(row.encryptedPayload); } catch { return finish('en', { error: 'IDENTITY_TRANSACTION_INVALID' }); }
  if (material.callbackMethod !== input.method) return finish('en', { error: 'IDENTITY_TRANSACTION_INVALID' });
  if (!(await port.snapshot()).some(value => value.installationId === material.installationId && value.token === material.providerToken && value.pluginSlug === slug)) return finish(row.locale, { error: 'IDENTITY_UNAVAILABLE' });
  const claimed = await prisma.identityTransaction.updateMany({ where: { id: row.id, claimedAt: null, consumedAt: null, expiresAt: { gt: new Date() } }, data: { claimedAt: new Date(), encryptedPayload: null } });
  if (claimed.count !== 1) return finish('en', { error: 'IDENTITY_TRANSACTION_INVALID' });
  let identity: Identity;
  try {
    if (input.error) fail(input.error === 'access_denied' ? 'IDENTITY_CANCELLED' : 'IDENTITY_REJECTED');
    if (!input.code) fail('IDENTITY_REJECTED');
    const result = await invoke(slug, 'complete', { code: input.code!, redirectUri: identityCallbackUri(slug), nonce: material.nonce, codeVerifier: material.verifier, ...(input.user ? { user: input.user } : {}) });
    if (result.outcome !== 'verified' || !result.emailVerified || result.issuer !== row.issuer) fail('IDENTITY_REJECTED');
    identity = result;
  } catch (error) {
    await prisma.identityTransaction.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
    return finish(row.locale, { error: error instanceof IdentityError ? error.code : 'IDENTITY_REJECTED' });
  }
  const handoff = identitySecret();
  await prisma.identityTransaction.update({ where: { id: row.id }, data: { verifiedIdentity: { claims: identity, provider: { pluginSlug: slug, installationId: material.installationId, token: material.providerToken } }, handoffHash: identityHash(handoff, 'handoff'), handoffExpiresAt: new Date(Date.now() + 60_000) } });
  return finish(row.locale, { code: handoff });
}
type IdentityTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
async function lockUser(tx: IdentityTx, id: string) {
  await tx.$queryRaw`SELECT id FROM public.users WHERE id = ${id} FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id } });
  customer(user);
  return user!;
}
function sessionResponse(user: User) {
  const access = JwtUtils.sign({ userId: user.id, email: user.email, role: user.role, sv: user.sessionVersion });
  return { user: { id: user.id, email: user.email, username: user.username, role: user.role, emailVerified: user.emailVerified, avatar: user.avatar, locale: user.locale, hasPassword: Boolean(user.password) }, access_token: access, refresh_token: JwtUtils.signRefresh({ userId: user.id, sv: user.sessionVersion }), token_type: 'Bearer', expires_in: 604800, token: access };
}
async function exchangeIdentity(code: string, binding: string, session?: Session) {
  const row = await prisma.identityTransaction.findUnique({ where: { handoffHash: identityHash(code, 'handoff') } });
  if (!row || !row.verifiedIdentity || row.bindingHash !== identityHash(binding, 'binding') || !row.handoffExpiresAt || row.handoffExpiresAt.getTime() <= Date.now() || row.expiresAt.getTime() <= Date.now() || row.consumedAt) fail('IDENTITY_TRANSACTION_INVALID');
  const saved = z.object({ claims: identityV1Methods.complete.output, provider: z.object({ pluginSlug: z.string(), installationId: z.string(), token: z.string() }).strict() }).strict().parse(row.verifiedIdentity);
  const { pluginSlug, installationId, token } = saved.provider;
  if (typeof pluginSlug !== 'string' || typeof installationId !== 'string' || typeof token !== 'string' || pluginSlug !== row.providerSlug) fail('IDENTITY_TRANSACTION_INVALID');
  const provider: IdentityProviderSnapshot = { pluginSlug, installationId, token };
  const identity = saved.claims;
  if (identity.outcome !== 'verified' || !identity.emailVerified || identity.issuer !== row.issuer) fail('IDENTITY_TRANSACTION_INVALID');
  const email = identity.email.trim().toLowerCase();
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identity.issuer + ':' + identity.subject}, 0))`;
    const consumed = await tx.identityTransaction.updateMany({ where: { id: row.id, consumedAt: null, handoffExpiresAt: { gt: new Date() }, bindingHash: identityHash(binding, 'binding') }, data: { consumedAt: new Date(), verifiedIdentity: Prisma.DbNull, handoffHash: null } });
    if (consumed.count !== 1) fail('IDENTITY_TRANSACTION_INVALID');
    let existing = await tx.externalIdentity.findUnique({ where: { issuer_subject: { issuer: identity.issuer, subject: identity.subject } } });
    if (existing && existing.providerSlug !== row.providerSlug) fail('IDENTITY_ALREADY_LINKED');
    if (row.intent === 'link') {
      if (!session || session.userId !== row.userId || session.sessionVersion !== row.sessionVersion) fail('IDENTITY_ACCOUNT_UNAVAILABLE');
      const user = await lockUser(tx, session!.userId);
      if (user.sessionVersion !== session!.sessionVersion) fail('IDENTITY_ACCOUNT_UNAVAILABLE');
      if (!await port.lock(tx, [provider])) fail('IDENTITY_UNAVAILABLE');
      existing = await tx.externalIdentity.findUnique({ where: { issuer_subject: { issuer: identity.issuer, subject: identity.subject } } });
      if (existing) fail('IDENTITY_ALREADY_LINKED');
      await tx.externalIdentity.create({ data: { userId: user.id, issuer: identity.issuer, subject: identity.subject, providerSlug: row.providerSlug } });
      return { intent: 'link' as const, linked: true, returnTo: row.returnTo };
    }
    let user: User;
    if (existing) {
      user = await lockUser(tx, existing.userId);
      if (!await port.lock(tx, [provider])) fail('IDENTITY_UNAVAILABLE');
      existing = await tx.externalIdentity.findUnique({ where: { issuer_subject: { issuer: identity.issuer, subject: identity.subject } } });
      if (!existing || existing.userId !== user.id) fail('IDENTITY_TRANSACTION_INVALID');
    } else {
      const claimedEmail = await AuthIdentityService.claimEmail(tx, email);
      if (claimedEmail.existing) fail('IDENTITY_EMAIL_IN_USE');
      const display = identity.displayName?.trim().replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 30) || 'Customer';
      const username = display + '-' + identitySecret().slice(0, 16);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'jiffoo:auth:username:' + username}, 0))`;
      if (await tx.user.findFirst({ where: { username }, select: { id: true } })) fail('IDENTITY_UNAVAILABLE');
      if (!await port.lock(tx, [provider])) fail('IDENTITY_UNAVAILABLE');
      user = await tx.user.create({ data: { email, username, password: null, role: 'USER', isActive: true, emailVerified: true, locale: row.locale } });
      await emitEvent(tx, 'customer.created', 1, user.id, customerSnapshot(user));
      await tx.externalIdentity.create({ data: { userId: user.id, issuer: identity.issuer, subject: identity.subject, providerSlug: row.providerSlug } });
    }
    customer(user);
    return { intent: 'login' as const, returnTo: row.returnTo, auth: sessionResponse(user) };
  });
}
async function identityConnections(session: Session) {
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  customer(user);
  if (user!.sessionVersion !== session.sessionVersion) fail('IDENTITY_ACCOUNT_UNAVAILABLE');
  const identities = await prisma.externalIdentity.findMany({ where: { userId: session.userId }, orderBy: { createdAt: 'asc' }, take: 20, select: { id: true, providerSlug: true, issuer: true, subject: true, createdAt: true } });
  const providers = await readyIdentities();
  return { hasPassword: Boolean(user!.password), identities: identities.map(identity => ({ ...identity, label: providers.find(p => p.pluginSlug === identity.providerSlug)?.label ?? identity.providerSlug, available: providers.some(p => p.pluginSlug === identity.providerSlug && p.issuer === identity.issuer && p.ready) })) };
}
async function removeIdentity(id: string, session: Session) {
  const found = await prisma.externalIdentity.findUnique({ where: { id } });
  if (!found || found.userId !== session.userId) fail('IDENTITY_TRANSACTION_INVALID');
  const providers = (await readyIdentities()).filter(provider => provider.ready);
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${found!.issuer + ':' + found!.subject}, 0))`;
    const user = await lockUser(tx, session.userId);
    if (user.sessionVersion !== session.sessionVersion) fail('IDENTITY_ACCOUNT_UNAVAILABLE');
    const identity = await tx.externalIdentity.findUnique({ where: { id } });
    if (!identity || identity.userId !== user.id) fail('IDENTITY_TRANSACTION_INVALID');
    if (!user.password) {
      const remaining = await tx.externalIdentity.findMany({ where: { userId: user.id, id: { not: id } } });
      const available = remaining.flatMap(identity => providers.filter(provider => provider.pluginSlug === identity.providerSlug && provider.issuer === identity.issuer));
      if (!available.length || !await port.lock(tx, available)) fail('IDENTITY_LAST_METHOD');
    }
    await tx.externalIdentity.delete({ where: { id } });
    return { removed: true };
  });
}

return { identityProviders, beginIdentity, pruneIdentityTransactions, identityCallback, exchangeIdentity, identityConnections, removeIdentity };
}
