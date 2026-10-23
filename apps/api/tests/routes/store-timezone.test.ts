import { afterAll, beforeAll, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken } from '../helpers/auth';
import { systemSettingsService } from '@/core/settings/service';
import { renderNotification } from '@/core/notifications/service';
let app: FastifyInstance, admin: Awaited<ReturnType<typeof createAdminWithToken>>;
beforeAll(async () => { app = await createTestApp(); admin = await createAdminWithToken(); });
afterAll(async () => {
  await systemSettingsService.batchUpdate({ 'localization.timezone': 'UTC' }, admin.user.id);
  await prisma.adminAuditEvent.deleteMany({ where: { actorId: admin.user.id } });
  await prisma.user.delete({ where: { id: admin.user.id } }); await app.close();
});
it('validates IANA names and atomically audits a changed store timezone', async () => {
  for (const timezone of ['', 'Mars/Phobos', 'PST', 42]) {
    const response = await app.inject({ method: 'PUT', url: '/api/v1/admin/settings/batch', headers: { authorization: `Bearer ${admin.token}` }, payload: { settings: { 'localization.timezone': timezone } } });
    expect(response.statusCode).toBe(400); expect(response.json().error.code).toBe('VALIDATION_ERROR');
  }
  const response = await app.inject({ method: 'PUT', url: '/api/v1/admin/settings/batch', headers: { authorization: `Bearer ${admin.token}` }, payload: { settings: { 'localization.timezone': 'Asia/Shanghai' } } });
  expect(response.statusCode).toBe(200);
  const row = await prisma.adminAuditEvent.findFirstOrThrow({ where: { actorId: admin.user.id, action: 'STORE_TIMEZONE_CHANGED' } });
  expect(row.summary).toMatchObject({ to: 'Asia/Shanghai' });
  expect((await app.inject({ method: 'GET', url: '/api/v1/store/context' })).json().data.timezone).toBe('Asia/Shanghai');
});
it('renders email timestamps in the store zone in all three supported languages', () => {
  for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
    const mail = renderNotification('order_confirmation', locale, 'Store', null, { orderId: 'one' }, false, false, 'Asia/Shanghai', new Date('2026-10-12T00:15:00Z'));
    expect(mail.text).toContain('08:15'); expect(mail.text).toContain('(Asia/Shanghai +08:00)'); expect(mail.html).toContain('(Asia/Shanghai +08:00)');
  }
});
