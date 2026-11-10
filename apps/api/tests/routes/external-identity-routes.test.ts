import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
const flow = vi.hoisted(() => ({ state: '', subject: 'subject', email: 'person@example.test' }));
vi.mock('@/core/extensions/registry', () => ({ snapshotIdentityProviders: async () => [{ pluginSlug: 'identity-http-test', installationId: 'http-installation', token: 'revision-1' }], lockIdentityProviderSnapshots: async () => true }));
vi.mock('@/core/extensions/runtime/plugin-runtime', () => ({ callContract: async (_slug: string, _contract: string, _version: number, method: string, input: Record<string, string>) => {
  if (method === 'describe') return { ready: true, label: 'Test identity', issuer: 'https://issuer.example.test', callbackMethod: 'POST', pkce: 'none' };
  if (method === 'authorize') { flow.state = input.state!; return { outcome: 'ready', authorizationUrl: 'https://issuer.example.test/authorize?state=' + input.state }; }
  return { outcome: 'verified', issuer: 'https://issuer.example.test', subject: flow.subject, email: flow.email, emailVerified: true };
} }));
import { identityRoutes } from '@/core/auth/identity-routes';
import { identityProviderAdapter } from '@/core/extensions/identity-provider';
import { prisma } from '@/config/database';
import { JwtUtils } from '@/utils/jwt';
const emails: string[] = [];
beforeEach(() => { flow.subject = randomUUID(); flow.email = `http-${randomUUID()}@example.test`; emails.push(flow.email); });
afterAll(async () => { await prisma.identityTransaction.deleteMany({ where: { providerSlug: 'identity-http-test' } }); await prisma.user.deleteMany({ where: { email: { in: emails } } }); });
async function app() {
  const output: string[] = [];
  const stream = new Writable({ write(chunk, _encoding, done) { output.push(String(chunk)); done(); } });
  const instance = Fastify({ logger: { level: 'trace', stream } });
  await instance.register(identityRoutes, { prefix: '/auth/identity', identityProvider: identityProviderAdapter }); await instance.ready();
  return { instance, output };
}
describe('customer identity HTTP boundary', () => {
  it('accepts Apple-style form POST without cookies and requires the original browser at exchange', async () => {
    const { instance, output } = await app();
    try {
      const binding = 'b'.repeat(43);
      const start = await instance.inject({ method: 'POST', url: '/auth/identity/identity-http-test/start', payload: { intent: 'login', locale: 'en', returnTo: '/en/account', browserBinding: binding } });
      expect(start.statusCode).toBe(200);
      const callback = await instance.inject({ method: 'POST', url: '/auth/identity/identity-http-test/callback', headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: new URLSearchParams({ state: flow.state, code: 'secret-provider-code' }).toString() });
      expect(callback.statusCode).toBe(303);
      const location = new URL(callback.headers.location!);
      const code = new URLSearchParams(location.hash.slice(1)).get('code')!;
      expect(code).toBeTruthy(); expect(location.search).not.toMatch(/code|access_token|refresh_token|id_token/);
      expect(await prisma.user.findUnique({ where: { email: flow.email } })).toBeNull();
      const wrong = await instance.inject({ method: 'POST', url: '/auth/identity/exchange', payload: { code, browserBinding: 'x'.repeat(43) } });
      expect(wrong.statusCode).toBe(400);
      const exchanged = await instance.inject({ method: 'POST', url: '/auth/identity/exchange', payload: { code, browserBinding: binding } });
      expect(exchanged.statusCode).toBe(200); expect(exchanged.json().data.auth.access_token).toBeTruthy();
      expect(output.join('')).not.toContain('secret-provider-code'); expect(output.join('')).not.toContain(flow.state); expect(output.join('')).not.toContain(code);
    } finally { await instance.close(); }
  });
  it('refuses staff linking and local-account email collisions without changing either account', async () => {
    const { instance } = await app();
    try {
      const user = await prisma.user.create({ data: { email: flow.email, username: 'Staff', password: 'not-a-login', role: 'ADMIN', emailVerified: true } });
      const token = JwtUtils.sign({ userId: user.id, email: user.email, role: user.role, sv: user.sessionVersion });
      const response = await instance.inject({ method: 'POST', url: '/auth/identity/identity-http-test/start', headers: { authorization: 'Bearer ' + token }, payload: { intent: 'link', locale: 'en', returnTo: '/en/account', browserBinding: 'b'.repeat(43) } });
      expect(response.statusCode).toBe(400); expect(response.json().error.code).toBe('IDENTITY_ACCOUNT_UNAVAILABLE');
      expect(await prisma.externalIdentity.count({ where: { userId: user.id } })).toBe(0);
    } finally { await instance.close(); }
  });
});
