import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
const state = vi.hoisted(() => ({ nonce: '', state: '', subject: 'subject-1', email: 'social@example.test', unavailable: '', snapshot: 'revision-1' }));
vi.mock('@/core/extensions/registry', () => ({ snapshotIdentityProviders: async () => ['identity-test', 'identity-other'].map(pluginSlug => ({ pluginSlug, installationId: pluginSlug, token: state.snapshot })), lockIdentityProviderSnapshots: async (_tx: unknown, values: Array<{ token: string }>) => values.every(value => value.token === state.snapshot) }));
vi.mock('@/core/extensions/runtime/plugin-runtime', () => ({ callContract: async (slug: string, _name: string, _version: number, method: string, input: Record<string, string>) => {
  if (method === 'describe') return { ready: state.unavailable !== slug, label: 'Test', issuer: slug === 'identity-test' ? 'https://issuer.example.test' : 'https://other.example.test', callbackMethod: 'POST', pkce: 'none' };
  if (method === 'authorize') { state.state = input.state!; state.nonce = input.nonce!; return { outcome: 'ready', authorizationUrl: 'https://issuer.example.test/authorize?state=' + input.state }; }
  return { outcome: 'verified', issuer: slug === 'identity-test' ? 'https://issuer.example.test' : 'https://other.example.test', subject: state.subject, email: state.email, emailVerified: true, displayName: 'New Customer' };
} }));
import { prisma } from '@/config/database';
import { createExternalIdentityService, identityReturnPath, identityCallbackUri } from '@/core/auth/external-identity';
import { identityProviderAdapter } from '@/core/extensions/identity-provider';
const { beginIdentity, identityCallback, exchangeIdentity, removeIdentity, identityConnections } = createExternalIdentityService(identityProviderAdapter);
import { identitySecret, identityHash, sealIdentityMaterial, openIdentityMaterial } from '@/core/auth/identity-crypto';
import { AuthService } from '@/core/auth/service';
import { PasswordUtils } from '@/utils/password';
import { AuthIdentityService } from '@/core/auth/identity-service';
const emails: string[] = [];
beforeEach(() => { state.subject = randomUUID(); state.email = `social-${randomUUID()}@example.test`; state.unavailable = ''; state.snapshot = 'revision-1'; emails.push(state.email); });
afterAll(async () => { await prisma.identityTransaction.deleteMany({ where: { providerSlug: { in: ['identity-test', 'identity-other'] } } }); await prisma.user.deleteMany({ where: { email: { in: emails } } }); });
async function callback(binding = identitySecret()) {
  await beginIdentity('identity-test', { intent: 'login', returnTo: '/en/account', locale: 'en', browserBinding: binding });
  const url = new URL(await identityCallback('identity-test', { state: state.state, method: 'POST', code: 'local-code' }));
  return { code: new URLSearchParams(url.hash.slice(1)).get('code')!, binding };
}
describe('Core external identity ownership', () => {
  it('defers account creation until a browser-bound one-time exchange', async () => {
    const flow = await callback();
    expect(await prisma.user.findUnique({ where: { email: state.email } })).toBeNull();
    await expect(exchangeIdentity(flow.code, identitySecret())).rejects.toMatchObject({ code: 'IDENTITY_TRANSACTION_INVALID' });
    const result = await exchangeIdentity(flow.code, flow.binding);
    expect(result.intent).toBe('login');
    const user = await prisma.user.findUniqueOrThrow({ where: { email: state.email } });
    expect(user.password).toBeNull(); expect(user.role).toBe('USER');
    await expect(exchangeIdentity(flow.code, flow.binding)).rejects.toMatchObject({ code: 'IDENTITY_TRANSACTION_INVALID' });
  });
  it('never links an existing email automatically', async () => {
    await prisma.user.create({ data: { email: state.email, username: 'Existing', password: 'not-a-password', emailVerified: true } });
    const flow = await callback();
    await expect(exchangeIdentity(flow.code, flow.binding)).rejects.toMatchObject({ code: 'IDENTITY_EMAIL_IN_USE' });
    expect(await prisma.externalIdentity.count({ where: { subject: state.subject } })).toBe(0);
  });
  it('requires the authenticated original customer and prevents deleting the final method', async () => {
    const flow = await callback(); await exchangeIdentity(flow.code, flow.binding);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: state.email } });
    const session = { userId: user.id, sessionVersion: user.sessionVersion };
    const connections = await identityConnections(session);
    expect(connections.hasPassword).toBe(false);
    await expect(removeIdentity(connections.identities[0]!.id, session)).rejects.toMatchObject({ code: 'IDENTITY_LAST_METHOD' });
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    const again = await callback();
    await expect(exchangeIdentity(again.code, again.binding)).rejects.toMatchObject({ code: 'IDENTITY_ACCOUNT_UNAVAILABLE' });
  });
  it('rejects replayed callback state and open redirects', async () => {
    const flow = await callback(); expect(flow.code).toBeTruthy();
    const replay = await identityCallback('identity-test', { state: state.state, method: 'POST', code: 'local-code' });
    expect(new URL(replay).searchParams.get('error')).toBe('IDENTITY_TRANSACTION_INVALID');
    for (const value of ['//evil.test', '/en/\\evil.test', '/en/%0d%0aLocation:evil']) expect(() => identityReturnPath(value, 'en')).toThrow();
  });
  it('authenticates encrypted nonce material and rejects modifications', () => {
    const material = { nonce: identitySecret(), verifier: identitySecret(), callbackMethod: 'POST' as const, installationId: 'identity-test', providerToken: 'revision-1' };
    const sealed = sealIdentityMaterial(material);
    expect(openIdentityMaterial(sealed)).toEqual(material);
    const damaged = Buffer.from(sealed, 'base64url'); damaged[0] = damaged[0]! ^ 1;
    expect(() => openIdentityMaterial(damaged.toString('base64url'))).toThrow();
    expect(sealIdentityMaterial(material)).not.toBe(sealed);
    expect(identityHash(material.nonce, 'state')).not.toBe(identityHash(material.nonce, 'handoff'));
    expect(identityHash(material.nonce, 'binding')).not.toBe(identityHash(material.nonce, 'state'));
  });
  it('does not consume valid state on the wrong callback method', async () => {
    const binding = identitySecret();
    await beginIdentity('identity-test', { intent: 'login', returnTo: '/en/account', locale: 'en', browserBinding: binding });
    const wrong = await identityCallback('identity-test', { state: state.state, method: 'GET', code: 'local-code' });
    expect(new URL(wrong).searchParams.get('error')).toBe('IDENTITY_TRANSACTION_INVALID');
    const correct = await identityCallback('identity-test', { state: state.state, method: 'POST', code: 'local-code' });
    expect(new URLSearchParams(new URL(correct).hash.slice(1)).get('code')).toBeTruthy();
  });
  it('creates unique Core identifiers for providers returning the same display name', async () => {
    const first = await callback(); await exchangeIdentity(first.code, first.binding);
    const firstUser = await prisma.user.findUniqueOrThrow({ where: { email: state.email } });
    state.subject = randomUUID(); state.email = `social-${randomUUID()}@example.test`; emails.push(state.email);
    const second = await callback(); await exchangeIdentity(second.code, second.binding);
    const secondUser = await prisma.user.findUniqueOrThrow({ where: { email: state.email } });
    expect(firstUser.username).not.toBe(secondUser.username);
    expect(firstUser.username).toMatch(/^New-Customer-/);
  });
  it('creates one local account under simultaneous first exchanges', async () => {
    const first = await callback(); const second = await callback();
    const results = await Promise.all([exchangeIdentity(first.code, first.binding), exchangeIdentity(second.code, second.binding)]);
    expect(results.every(result => result.intent === 'login')).toBe(true);
    expect(await prisma.user.count({ where: { email: state.email } })).toBe(1);
    expect(await prisma.externalIdentity.count({ where: { issuer: 'https://issuer.example.test', subject: state.subject } })).toBe(1);
  });
  it('binds only to the authenticated original account and rejects changed sessions', async () => {
    const initial = await callback(); await exchangeIdentity(initial.code, initial.binding);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: state.email } });
    const session = { userId: user.id, sessionVersion: user.sessionVersion };
    const binding = identitySecret(); state.subject = randomUUID();
    await beginIdentity('identity-other', { intent: 'link', returnTo: '/en/account', locale: 'en', browserBinding: binding }, session);
    const url = new URL(await identityCallback('identity-other', { state: state.state, method: 'POST', code: 'local-code' }));
    const code = new URLSearchParams(url.hash.slice(1)).get('code')!;
    await expect(exchangeIdentity(code, binding, { userId: 'someone-else', sessionVersion: 0 })).rejects.toMatchObject({ code: 'IDENTITY_ACCOUNT_UNAVAILABLE' });
    await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
    await expect(exchangeIdentity(code, binding, session)).rejects.toMatchObject({ code: 'IDENTITY_ACCOUNT_UNAVAILABLE' });
    expect(await prisma.externalIdentity.count({ where: { userId: user.id } })).toBe(1);
  });
  it('retains one usable login method under simultaneous unlink', async () => {
    const initial = await callback(); await exchangeIdentity(initial.code, initial.binding);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: state.email } });
    const session = { userId: user.id, sessionVersion: user.sessionVersion };
    const binding = identitySecret(); state.subject = randomUUID();
    await beginIdentity('identity-other', { intent: 'link', returnTo: '/en/account', locale: 'en', browserBinding: binding }, session);
    const url = new URL(await identityCallback('identity-other', { state: state.state, method: 'POST', code: 'local-code' }));
    expect((await exchangeIdentity(new URLSearchParams(url.hash.slice(1)).get('code')!, binding, session)).intent).toBe('link');
    const connections = await identityConnections(session);
    expect(connections.identities.every(identity => identity.available)).toBe(true);
    state.unavailable = 'identity-other';
    const first = connections.identities.find(identity => identity.providerSlug === 'identity-test')!;
    await expect(removeIdentity(first.id, session)).rejects.toMatchObject({ code: 'IDENTITY_LAST_METHOD' });
    state.unavailable = '';
    const results = await Promise.allSettled(connections.identities.map(identity => removeIdentity(identity.id, session)));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.externalIdentity.count({ where: { userId: user.id } })).toBe(1);
  });
  it('invalidates state and handoff after provider installation or configuration changes', async () => {
    const binding = identitySecret();
    await beginIdentity('identity-test', { intent: 'login', returnTo: '/en/account', locale: 'en', browserBinding: binding });
    state.snapshot = 'revision-2';
    expect(new URL(await identityCallback('identity-test', { state: state.state, method: 'POST', code: 'code' })).searchParams.get('error')).toBe('IDENTITY_UNAVAILABLE');
    const next = await callback(binding); state.snapshot = 'revision-3';
    await expect(exchangeIdentity(next.code, binding)).rejects.toMatchObject({ code: 'IDENTITY_UNAVAILABLE' });
    expect(await prisma.user.findUnique({ where: { email: state.email } })).toBeNull();
  });
  it('uses the configured public API prefix instead of request headers or an internal service host', () => {
    expect(identityCallbackUri('identity-test', 'https://api.example.test/custom/api/v1/')).toBe('https://api.example.test/custom/api/v1/auth/identity/identity-test/callback');
    expect(() => identityCallbackUri('identity-test', 'https://name:secret@api.example.test/api/v1')).toThrow();
    expect(() => identityCallbackUri('identity-test', 'https://api.example.test/api/v1?token=value')).toThrow();
  });
  it('never treats the timing-only dummy hash as a passwordless account credential', async () => {
    const initial = await callback(); await exchangeIdentity(initial.code, initial.binding);
    const compare = vi.spyOn(PasswordUtils, 'verify').mockResolvedValueOnce(true);
    try { await expect(AuthService.login({ email: state.email, password: 'any-input' })).rejects.toMatchObject({ code: 'LOGIN_FAILED' }); }
    finally { compare.mockRestore(); }
  });
  it('detects existing local email addresses without depending on letter case', async () => {
    const uppercase = state.email.toUpperCase(); emails.push(uppercase);
    await prisma.user.create({ data: { email: uppercase, username: 'Case User', password: 'not-a-real-login' } });
    const initial = await callback();
    await expect(exchangeIdentity(initial.code, initial.binding)).rejects.toMatchObject({ code: 'IDENTITY_EMAIL_IN_USE' });
  });
  it('serializes ordinary registration and social signup using one normalized email claim', async () => {
    const initial = await callback();
    const results = await Promise.allSettled([
      exchangeIdentity(initial.code, initial.binding),
      AuthService.register({ email: state.email.toUpperCase(), username: 'Local-' + randomUUID(), password: 'Valid-Password123!' }),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.user.count({ where: { email: { equals: state.email, mode: 'insensitive' } } })).toBe(1);
  });
  it('guards a changed contact email inside the owning transaction without rewriting existing addresses', async () => {
    const owner = await prisma.user.create({ data: { email: state.email, username: 'Owner', password: 'local-fixture' } });
    const otherEmail = `OTHER-${randomUUID()}@EXAMPLE.TEST`; emails.push(otherEmail);
    const other = await prisma.user.create({ data: { email: otherEmail, username: 'Other', password: 'local-fixture' } });
    await expect(prisma.$transaction(tx => AuthIdentityService.changeEmail(tx, owner.id, otherEmail.toLowerCase(), { id: true }))).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).email).toBe(otherEmail);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).email).toBe(state.email);
  });
});
