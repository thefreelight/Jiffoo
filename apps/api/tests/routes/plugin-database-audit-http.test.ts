import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import * as auditor from '@/core/admin/extension-installer/plugin-database-audit';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteTestUser } from '../helpers/auth';

let app: FastifyInstance, admin: Awaited<ReturnType<typeof createAdminWithToken>>, customer: Awaited<ReturnType<typeof createUserWithToken>>;
let scan: ReturnType<typeof vi.spyOn>;
beforeAll(async () => {
  app = await createTestApp({ enableSwagger: true }); admin = await createAdminWithToken(); customer = await createUserWithToken();
  scan = vi.spyOn(auditor, 'auditPluginDatabase').mockResolvedValue({ reportVersion: 1, scope: 'plugin-database-integrity', startedAt: '2026-10-10T00:00:00.000Z', finishedAt: '2026-10-10T00:00:01.000Z', complete: true, database: { name: 'jiffoo_core_test', schemaState: 'current' }, processQuiescence: { proven: false, authority: 'caller' }, counts: { plugins: 0, blocking: 0, warning: 0 }, findings: [] });
});
afterAll(async () => { vi.restoreAllMocks(); await app.close(); await deleteTestUser(admin.user.id); await deleteTestUser(customer.user.id); });
it('J Admin summary reads never start a blob scan and an explicit scan records its time', async () => {
  const before = await app.inject({ method: 'GET', url: '/api/v1/extensions/plugin/database-audit', headers: admin.authHeader });
  expect(before.statusCode).toBe(200); expect(before.json().data).toEqual({ latest: null }); expect(scan).not.toHaveBeenCalled();
  const run = await app.inject({ method: 'POST', url: '/api/v1/extensions/plugin/database-audit', headers: admin.authHeader });
  expect(run.statusCode).toBe(200); expect(scan).toHaveBeenCalledTimes(1);
  const read = await app.inject({ method: 'GET', url: '/api/v1/extensions/plugin/database-audit', headers: admin.authHeader });
  expect(read.headers['cache-control']).toBe('no-store'); expect(read.json().data).toEqual(run.json().data); expect(scan).toHaveBeenCalledTimes(1);
  expect(read.json().data.latest).toMatchObject({ finishedAt: '2026-10-10T00:00:01.000Z', processQuiescence: { proven: false, authority: 'caller' } });
  expect(read.body).not.toContain('artifactBytes'); expect(read.body).not.toContain('findings');
});
it('J audit reads and scans both require Admin authorization', async () => {
  for (const method of ['GET', 'POST'] as const) {
    expect(app.swagger().paths['/api/v1/extensions/plugin/database-audit'][method.toLowerCase()].security).toEqual([{ bearerAuth: [] }]);
    expect((await app.inject({ method, url: '/api/v1/extensions/plugin/database-audit' })).statusCode).toBe(401);
    expect((await app.inject({ method, url: '/api/v1/extensions/plugin/database-audit', headers: customer.authHeader })).statusCode).toBe(403);
  }
});
