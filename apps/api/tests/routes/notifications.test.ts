import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { ADMIN_PERMISSIONS, DEFAULT_ADMIN_ROLE_PERMISSIONS } from 'shared';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@/config/database';
import { envSchema, env } from '@/config/env';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { deliverPendingNotifications } from '@/core/notifications/delivery';
import { createNotification, renderNotification, type NotificationType } from '@/core/notifications/service';
import { verificationLink } from '@/core/notifications/service';
import { EmailVerificationService } from '@/services/email-verification.service';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';
import { installFixturePlugin, removeFixturePlugin } from '../helpers/fixture-plugin';

describe('Persisted notifications', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let adminUserId: string;
  let customerToken: string;
  let customerId: string;
  const slug = `notification-fixture-${randomUUID().slice(0, 8)}`;
  const logFile = path.join(os.tmpdir(), `${slug}.jsonl`);
  const failFile = path.join(os.tmpdir(), `${slug}.fail`);

  async function calls(): Promise<Array<{ idempotencyKey: string; text: string; html: string; locale: string }>> {
    try {
      return (await fs.readFile(logFile, 'utf8')).trim().split('\n').filter(Boolean).map((row) => JSON.parse(row));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  beforeAll(async () => {
    await syncBuiltinPlugins(path.resolve(process.cwd(), 'builtin-plugins'));
    app = await createTestApp();
    const admin = await createAdminWithToken();
    const customer = await createUserWithToken();
    adminToken = admin.token;
    adminUserId = admin.user.id;
    customerToken = customer.token;
    customerId = customer.user.id;
    const source = `const fs = require('fs'); module.exports = { register(ctx) {
      ctx.contracts.implement('notification', 1, { send(input) {
        fs.appendFileSync(${JSON.stringify(logFile)}, JSON.stringify(input) + '\\n');
        if (fs.existsSync(${JSON.stringify(failFile)})) return { accepted: false, error: 'transport unavailable' };
        return { accepted: true, providerMessageId: 'fixture_' + input.idempotencyKey };
      } });
    } };`;
    await installFixturePlugin({ app, adminToken, adminUserId }, slug, 'notification', [{ name: 'notification', version: 1 }], source);
    const consoleEmail = await prisma.pluginInstallation.findUniqueOrThrow({
      where: { pluginSlug_instanceKey: { pluginSlug: 'console-email', instanceKey: 'default' } },
    });
    const response = await app.inject({
      method: 'PATCH', url: `/api/v1/extensions/plugin/console-email/instances/${consoleEmail.id}`,
      headers: { authorization: `Bearer ${adminToken}` }, payload: { enabled: false },
    });
    expect(response.statusCode).toBe(200);
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany();
    await fs.writeFile(logFile, '', 'utf8');
    await fs.rm(failFile, { force: true });
  });

  afterAll(async () => {
    const consoleEmail = await prisma.pluginInstallation.findUnique({
      where: { pluginSlug_instanceKey: { pluginSlug: 'console-email', instanceKey: 'default' } },
    });
    if (consoleEmail) {
      await app.inject({
        method: 'PATCH', url: `/api/v1/extensions/plugin/console-email/instances/${consoleEmail.id}`,
        headers: { authorization: `Bearer ${adminToken}` }, payload: { enabled: true },
      });
    }
    await removeFixturePlugin({ app, adminToken, adminUserId }, slug);
    await prisma.notification.deleteMany();
    await deleteAllTestUsers();
    await app.close();
    await fs.rm(logFile, { force: true });
    await fs.rm(failFile, { force: true });
  });

  async function pending(type: NotificationType = 'payment_received', secret?: { link: string }) {
    return prisma.$transaction((tx) => createNotification(
      tx, type, customerId, 'notification-test@example.com',
      { orderId: 'order-notification-test', name: 'Test user' },
      { secret },
    ));
  }

  it('registers a session and persists a localized verification without calling a provider', async () => {
    const email = `notification-test-${randomUUID()}@test.com`;
    const response = await app.inject({
      method: 'POST', url: '/api/v1/auth/register',
      payload: { email, username: `buyer${randomUUID().slice(0, 8)}`, password: 'Password123!', locale: 'zh-Hant' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().data.access_token).toBeTruthy();
    const records = await prisma.notification.findMany({ where: { toAddress: email } });
    expect(records).toHaveLength(1);
    expect(records[0].locale).toBe('zh-Hant');
    expect(await calls()).toHaveLength(0);
  });

  it('changes email and queues verification to the normalized new address', async () => {
    const email = `notification-test-${randomUUID()}@test.com`;
    const response = await app.inject({
      method: 'PUT', url: '/api/v1/account/email',
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { currentPassword: 'Test123456!', newEmail: email.toUpperCase() },
    });
    expect(response.statusCode).toBe(200);
    expect((await prisma.notification.findMany({ where: { toAddress: email } })).length).toBe(1);
    expect(await calls()).toHaveLength(0);
  });

  it('uses body, Accept-Language, then store default and returns changed account locale', async () => {
    const system = await prisma.systemSettings.findUnique({ where: { id: 'system' } });
    const original = system?.settings;
    const settings = original && typeof original === 'object' && !Array.isArray(original)
      ? { ...original } : {};
    await prisma.systemSettings.upsert({
      where: { id: 'system' },
      create: { id: 'system', settings: { ...settings, 'localization.locale': 'zh-Hans' } },
      update: { settings: { ...settings, 'localization.locale': 'zh-Hans' } },
    });
    try {
      const register = async (locale?: string, language?: string) => {
        const email = `notification-test-${randomUUID()}@test.com`;
        const response = await app.inject({
          method: 'POST', url: '/api/v1/auth/register',
          headers: language ? { 'accept-language': language } : {},
          payload: { email, username: `buyer${randomUUID().slice(0, 8)}`, password: 'Password123!', ...(locale ? { locale } : {}) },
        });
        expect(response.statusCode).toBe(201);
        const item = await prisma.notification.findFirstOrThrow({ where: { toAddress: email } });
        return { locale: item.locale, token: response.json().data.access_token as string };
      };
      expect((await register('zh-Hant', 'en-US')).locale).toBe('zh-Hant');
      const preferredHeader = await register(undefined, 'fr;q=0.9,en-US;q=0.8');
      expect(preferredHeader.locale).toBe('en');
      const storeDefault = await register();
      expect(storeDefault.locale).toBe('zh-Hans');
      const updated = await app.inject({
        method: 'PUT', url: '/api/v1/account/profile',
        headers: { authorization: `Bearer ${storeDefault.token}` },
        payload: { locale: 'en' },
      });
      expect(updated.statusCode).toBe(200);
      expect(updated.json().data.locale).toBe('en');
      await prisma.user.update({ where: { id: customerId }, data: { locale: null } });
      expect((await pending()).locale).toBe('zh-Hans');
      await prisma.systemSettings.update({ where: { id: 'system' }, data: { settings: { ...settings } } });
      expect((await pending()).locale).toBe('en');
    } finally {
      await prisma.systemSettings.update({ where: { id: 'system' }, data: { settings: original || {} } });
    }
  });

  it('delivers once through the fixture contract with the notification idempotency key and clears secrets', async () => {
    const item = await pending('email_verification', { link: 'https://example.test/verify?token=real-token' });
    expect(item.html).not.toContain('real-token');
    await Promise.all([deliverPendingNotifications(), deliverPendingNotifications()]);
    const recorded = await calls();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].idempotencyKey).toBe(item.id);
    expect(recorded[0].html).toContain('real-token');
    const delivered = await prisma.notification.findUniqueOrThrow({ where: { id: item.id } });
    expect(delivered).toMatchObject({ status: 'SENT', providerSlug: slug, providerMessageId: `fixture_${item.id}`, secretJson: null });
    await deliverPendingNotifications();
    expect(await calls()).toHaveLength(1);
  });

  it('retries failure and records an error, then fails after five attempts and clears secrets', async () => {
    await fs.writeFile(failFile, 'fail', 'utf8');
    const item = await pending('email_verification', { link: 'https://example.test/verify?token=retry-token' });
    for (let attempts = 1; attempts <= 5; attempts += 1) {
      await prisma.notification.update({ where: { id: item.id }, data: { nextAttemptAt: new Date(0) } });
      await deliverPendingNotifications();
      const current = await prisma.notification.findUniqueOrThrow({ where: { id: item.id } });
      expect(current.attempts).toBe(attempts);
      expect(current.lastError).toContain('transport unavailable');
      expect(current.status).toBe(attempts === 5 ? 'FAILED' : 'PENDING');
      if (attempts < 5) expect(current.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
      else expect(current.secretJson).toBeNull();
    }
    expect(await calls()).toHaveLength(5);
  });

  it('recovers a stale sending notification', async () => {
    const item = await pending();
    await prisma.notification.update({
      where: { id: item.id },
      data: { status: 'SENDING', updatedAt: new Date(Date.now() - 6 * 60_000) },
    });
    await deliverPendingNotifications();
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: item.id } })).status).toBe('SENT');
  });

  it('delivers via the builtin console-email provider when it is the enabled provider', async () => {
    const fixture = await prisma.pluginInstallation.findUniqueOrThrow({
      where: { pluginSlug_instanceKey: { pluginSlug: slug, instanceKey: 'default' } },
    });
    const consoleEmail = await prisma.pluginInstallation.findUniqueOrThrow({
      where: { pluginSlug_instanceKey: { pluginSlug: 'console-email', instanceKey: 'default' } },
    });
    const headers = { authorization: `Bearer ${adminToken}` };
    const setEnabled = async (pluginSlug: string, id: string, enabled: boolean) => {
      const response = await app.inject({
        method: 'PATCH', url: `/api/v1/extensions/plugin/${pluginSlug}/instances/${id}`,
        headers, payload: { enabled },
      });
      expect(response.statusCode).toBe(200);
    };
    await setEnabled('console-email', consoleEmail.id, true);
    await setEnabled(slug, fixture.id, false);
    try {
      const item = await pending();
      await deliverPendingNotifications();
      const delivered = await prisma.notification.findUniqueOrThrow({ where: { id: item.id } });
      expect(delivered.status).toBe('SENT');
      expect(delivered.providerSlug).toBe('console-email');
      expect(delivered.providerMessageId).toBe(`console_${item.id}`);
    } finally {
      await setEnabled(slug, fixture.id, true);
      await setEnabled('console-email', consoleEmail.id, false);
    }
  });

  it('renders every type in all languages with the store name and only absolute logos', () => {
    const types: NotificationType[] = ['email_verification', 'staff_invite', 'password_reset', 'order_confirmation', 'payment_received', 'shipped', 'cancelled'];
    for (const type of types) for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
      const valid = renderNotification(type, locale, 'Test Store', 'https://example.test/logo.png', { name: 'Buyer', orderId: 'order-1' }, true, true);
      expect(valid.subject).toContain('Test Store');
      expect(valid.html).toContain('https://example.test/logo.png');
      expect(valid.text).not.toMatch(/\{(?:name|orderId|instructions|reason|code)\}/);
      expect(renderNotification(type, locale, 'Test Store', '/logo.png', {}, false).html).not.toContain('<img');
    }
  });

  it('redacts password reset links and forbids Admin resend', async () => {
    const request = await app.inject({
      method: 'POST', url: '/api/v1/auth/forgot-password',
      payload: { email: (await prisma.user.findUniqueOrThrow({ where: { id: customerId } })).email },
    });
    expect(request.statusCode).toBe(200);
    const item = await prisma.notification.findFirstOrThrow({
      where: { recipientUserId: customerId, type: 'password_reset' },
    });
    const link = (item.secretJson as { link: string }).link;
    expect(item.text).not.toContain(link);
    expect(item.html).not.toContain(link);
    const response = await app.inject({
      method: 'POST', url: `/api/v1/admin/notifications/${item.id}/resend`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('NOT_RESENDABLE');
  });

  it('requires STOREFRONT_URL in production and builds verification links from it', () => {
    expect(envSchema.safeParse({
      ...process.env, NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/jiffoo_core_test',
      JWT_SECRET: 'notification-test-secret', STOREFRONT_URL: undefined,
    }).success).toBe(false);
    expect(envSchema.safeParse({
      ...process.env, NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/jiffoo_core_test',
      JWT_SECRET: 'notification-test-secret', STOREFRONT_URL: 'https://store.example', ADMIN_URL: 'https://admin.example',
    }).success).toBe(true);
    const original = env.STOREFRONT_URL;
    try {
      env.STOREFRONT_URL = 'https://store.example';
      expect(verificationLink('live token')).toBe('https://store.example/verify-email?token=live%20token');
    } finally {
      env.STOREFRONT_URL = original;
    }
  });

  it('lists redacted detail and resends under Admin permissions', async () => {
    const item = await pending();
    const headers = { authorization: `Bearer ${adminToken}` };
    const forbidden = await app.inject({ method: 'GET', url: '/api/v1/admin/notifications', headers: { authorization: `Bearer ${customerToken}` } });
    expect(forbidden.statusCode).toBe(403);
    const list = await app.inject({ method: 'GET', url: '/api/v1/admin/notifications?status=PENDING', headers });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.items.some((row: { id: string }) => row.id === item.id)).toBe(true);
    const detail = await app.inject({ method: 'GET', url: `/api/v1/admin/notifications/${item.id}`, headers });
    expect(detail.json().data).not.toHaveProperty('secretJson');
    const resend = await app.inject({ method: 'POST', url: `/api/v1/admin/notifications/${item.id}/resend`, headers });
    expect(resend.statusCode).toBe(201);
    expect(resend.json().data.resentFromId).toBe(item.id);
  });

  it('allows orders.write to resend an order notification but not a staff invitation', async () => {
    const actor = await createAdminWithToken();
    await prisma.adminMembership.create({
      data: {
        userId: actor.user.id,
        role: 'ANALYST',
        revokedPermissions: [...DEFAULT_ADMIN_ROLE_PERMISSIONS.ANALYST],
        extraPermissions: [ADMIN_PERMISSIONS.ORDERS_WRITE],
      },
    });
    const recipient = await createUserWithToken({ emailVerified: false });
    expect(await EmailVerificationService.sendStaffInvitationEmail(recipient.user.id, recipient.user.email, recipient.user.username)).toEqual({ success: true });
    const invitation = await prisma.notification.findFirstOrThrow({
      where: { recipientUserId: recipient.user.id, type: 'staff_invite' },
    });
    const order = await pending();
    const headers = { authorization: `Bearer ${actor.token}` };
    const forbidden = await app.inject({
      method: 'POST', url: `/api/v1/admin/notifications/${invitation.id}/resend`, headers,
    });
    expect(forbidden.statusCode).toBe(403);
    expect(await prisma.notification.count({ where: { resentFromId: invitation.id } })).toBe(0);
    const allowed = await app.inject({
      method: 'POST', url: `/api/v1/admin/notifications/${order.id}/resend`, headers,
    });
    expect(allowed.statusCode).toBe(201);
    expect(allowed.json().data.resentFromId).toBe(order.id);
  });

  it('Admin verification resend replaces the token and the fixture receives the working link', async () => {
    const recipient = await createUserWithToken({ emailVerified: false });
    expect(await EmailVerificationService.sendVerificationEmail(recipient.user.id, recipient.user.email, recipient.user.username)).toEqual({ success: true });
    const original = await prisma.notification.findFirstOrThrow({ where: { recipientUserId: recipient.user.id } });
    expect(original.html).not.toContain('token=');
    expect(original.text).not.toContain('token=');
    const originalSecret = original.secretJson as { link: string; code: string };
    const oldToken = new URL(originalSecret.link).searchParams.get('token');
    const headers = { authorization: `Bearer ${adminToken}` };
    const resend = await app.inject({ method: 'POST', url: `/api/v1/admin/notifications/${original.id}/resend`, headers });
    expect(resend.statusCode).toBe(201);
    const latest = await prisma.notification.findUniqueOrThrow({ where: { id: resend.json().data.id } });
    expect(latest.resentFromId).toBe(original.id);
    const latestSecret = latest.secretJson as { link: string; code: string };
    expect(latestSecret.link).not.toBe(originalSecret.link);
    const invalid = await app.inject({ method: 'GET', url: `/api/v1/auth/verify-email?token=${oldToken}` });
    expect(invalid.statusCode).toBe(400);
    await deliverPendingNotifications();
    expect((await calls()).some((call) => call.text.includes(latestSecret.link))).toBe(true);
    const valid = await app.inject({ method: 'GET', url: `/api/v1/auth/verify-email?token=${new URL(latestSecret.link).searchParams.get('token')}` });
    expect(valid.statusCode).toBe(200);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: latest.id } })).secretJson).toBeNull();
  });

  it('staff invitation and Admin resend keep tokens out of stored content', async () => {
    const recipient = await createUserWithToken({ emailVerified: false });
    expect(await EmailVerificationService.sendStaffInvitationEmail(recipient.user.id, recipient.user.email, recipient.user.username)).toEqual({ success: true });
    const original = await prisma.notification.findFirstOrThrow({ where: { recipientUserId: recipient.user.id, type: 'staff_invite' } });
    const oldLink = (original.secretJson as { link: string }).link;
    expect(original.subject + original.html + original.text).not.toContain(oldLink);
    const response = await app.inject({
      method: 'POST', url: `/api/v1/admin/notifications/${original.id}/resend`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(201);
    const latest = await prisma.notification.findUniqueOrThrow({ where: { id: response.json().data.id } });
    const link = (latest.secretJson as { link: string }).link;
    expect(link).not.toBe(oldLink);
    expect(latest.resentFromId).toBe(original.id);
    expect(latest.subject + latest.html + latest.text).not.toContain(link);
    await deliverPendingNotifications();
    expect((await calls()).some((call) => call.text.includes(link))).toBe(true);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: latest.id } })).secretJson).toBeNull();
    expect((await app.inject({ method: 'GET', url: `/api/v1/auth/verify-email?token=${new URL(oldLink).searchParams.get('token')}` })).statusCode).toBe(400);
  });
});
