import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { buildApp } from '@/server';
import { requirePluginAction } from '@/core/auth/plugin-action-authorization';
import { bootstrapPluginPolicyAuthority } from '@/core/auth/plugin-action-policy-bootstrap';
import { createUserWithToken } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';

const prisma = getTestPrisma();
const slug = `action-policy-${randomUUID()}`;
let app: Awaited<ReturnType<typeof buildApp>>;
let admin: Awaited<ReturnType<typeof createUserWithToken>>;
let target: Awaited<ReturnType<typeof createUserWithToken>>;
let installationId: string;
const headers = () => ({ authorization: `Bearer ${admin.token}` });
const url = () => `/api/v1/admin/plugin-action-policy/grants/${installationId}/${target.user.id}/content.publish`;

beforeAll(async () => {
  app = await buildApp();
  admin = await createUserWithToken({ role: 'ADMIN' }); target = await createUserWithToken({ role: 'ADMIN' });
  await prisma.pluginInstall.create({ data: { slug, name: 'Action fixture', version: '1.0.0', manifestJson: { adminActions: ['content.publish'] } } });
  installationId = (await prisma.pluginInstallation.create({ data: { pluginSlug: slug, instanceKey: 'default', grantedPermissions: ['actions:content.publish'] } })).id;
});
afterAll(async () => {
  await prisma.pluginActionGrant.deleteMany({ where: { installationId } });
  await prisma.pluginPolicyAuthority.deleteMany({ where: { principalId: admin.user.id } });
  await prisma.pluginInstall.deleteMany({ where: { slug } });
  await app?.close();
});

it('does not elevate ADMIN without explicit policy authority', async () => {
  expect((await app.inject({ method: 'PUT', url: url(), headers: headers() })).statusCode).toBe(403);
});

it('supports bootstrap preflight without granting policy authority', async () => {
  const result = await bootstrapPluginPolicyAuthority(prisma, { databaseUrl: process.env.DATABASE_URL_TEST!, expectedDatabase: decodeURIComponent(new URL(process.env.DATABASE_URL_TEST!).pathname.slice(1)), principalId: admin.user.id }, (tx, event) => tx.adminAuditEvent.create({ data: event }));
  expect(result.applied).toBe(false);
  expect(await prisma.pluginPolicyAuthority.findUnique({ where: { principalId: admin.user.id } })).toBeNull();
});

it('grants and revokes a real action with no-store minimal policy reads', async () => {
  await prisma.pluginPolicyAuthority.create({ data: { principalId: admin.user.id } });
  const response = await app.inject({ method: 'PUT', url: url(), headers: headers() });
  expect(response.statusCode).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  await expect(prisma.$transaction(tx => requirePluginAction(tx, installationId, { type: 'admin', id: target.user.id }, 'content.publish'))).resolves.toBeUndefined();
  const listing = await app.inject({ method: 'GET', url: `/api/v1/admin/plugin-action-policy/grants?installationId=${installationId}&principalId=${target.user.id}`, headers: headers() });
  expect(listing.statusCode).toBe(200);
  expect(Object.keys(listing.json().data.items[0]).sort()).toEqual(['action', 'installationId', 'principalId']);
  await prisma.user.update({ where: { id: target.user.id }, data: { isActive: false } });
  await expect(prisma.$transaction(tx => requirePluginAction(tx, installationId, { type: 'admin', id: target.user.id }, 'content.publish'))).rejects.toThrow();
  expect((await app.inject({ method: 'DELETE', url: url(), headers: headers() })).statusCode).toBe(200);
  expect(await prisma.pluginActionGrant.count({ where: { installationId } })).toBe(0);
});

it('denies revoked administrator sessions before policy mutation', async () => {
  await prisma.user.update({ where: { id: admin.user.id }, data: { sessionVersion: { increment: 1 } } });
  expect((await app.inject({ method: 'PUT', url: url(), headers: headers() })).statusCode).toBe(401);
});
