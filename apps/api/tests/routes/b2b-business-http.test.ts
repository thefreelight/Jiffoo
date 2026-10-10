import { afterAll, beforeAll, expect, it } from 'vitest';
import { errorHttpFixture } from '../helpers/error-http-fixture';
import { createTestUser, signJwt } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { randomUUID } from 'node:crypto';

const prisma = getTestPrisma();
let fixture: Awaited<ReturnType<typeof errorHttpFixture>>;
const users: Awaited<ReturnType<typeof createTestUser>>[] = [];
const missing = randomUUID();
const invalidStoredSlug = 'b2b-invalid-stored';

beforeAll(async () => {
  users.push(await createTestUser(), await createTestUser({ role: 'ADMIN' }));
  fixture = await errorHttpFixture();
  for (const user of users) fixture.users.add(user.id);
  await prisma.pluginInstall.create({ data: {
    slug: invalidStoredSlug, name: 'Invalid stored manifest fixture', version: '1.0.0', manifestJson: {},
  } });
  await prisma.pluginInstallation.create({ data: {
    pluginSlug: invalidStoredSlug, instanceKey: 'default', enabled: false, configJson: {}, grantedPermissions: [],
  } });
}, 60000);
afterAll(async () => {
  await fixture?.close();
  await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: invalidStoredSlug } });
  await prisma.pluginInstall.deleteMany({ where: { slug: invalidStoredSlug } });
  await prisma.cart.deleteMany({ where: { userId: { in: users.map(user => user.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
}, 60000);

const cases: Array<{ family: string; route: string; method: string; body?: unknown; admin?: boolean; status: number; code: string }> = [
  { family: 'account', route: '/account', method: 'DELETE', body: { currentPassword: 'IncorrectPassword123!' }, status: 400, code: 'INVALID_PASSWORD' },
  { family: 'cart', route: `/cart/items/${missing}`, method: 'PUT', body: { quantity: 1 }, status: 404, code: 'NOT_FOUND' },
  { family: 'checkout', route: '/checkout/quote', method: 'POST', body: { shippingAddress: { country: 'US' } }, status: 400, code: 'BAD_REQUEST' },
  { family: 'order', route: `/orders/${missing}/cancel`, method: 'POST', body: { cancelReason: 'Fixture cancellation' }, status: 404, code: 'NOT_FOUND' },
  { family: 'product', route: `/products/${missing}`, method: 'GET', status: 404, code: 'NOT_FOUND' },
  { family: 'admin product', route: `/admin/products/${missing}`, method: 'DELETE', admin: true, status: 404, code: 'NOT_FOUND' },
  { family: 'admin user', route: `/admin/users/${missing}`, method: 'DELETE', admin: true, status: 404, code: 'NOT_FOUND' },
  { family: 'admin order', route: `/admin/orders/${missing}/record-manual-payment`, method: 'POST', body: { reference: 'verified-reference' }, admin: true, status: 404, code: 'NOT_FOUND' },
  { family: 'inventory', route: '/admin/inventory/adjustments', method: 'POST', body: { variantId: missing, type: 'manual', quantity: 1 }, admin: true, status: 404, code: 'NOT_FOUND' },
  { family: 'staff', route: `/admin/staff/${missing}/invite-link`, method: 'POST', admin: true, status: 409, code: 'INVITE_NOT_AVAILABLE' },
  { family: 'settings', route: '/admin/settings/batch', method: 'PUT', body: { settings: { 'localization.locale': 'invalid' } }, admin: true, status: 400, code: 'VALIDATION_ERROR' },
  { family: 'api tokens', route: `/admin/api-tokens/${missing}`, method: 'DELETE', admin: true, status: 404, code: 'NOT_FOUND' },
  { family: 'password reset link', route: `/admin/customers/${missing}/password-reset-link`, method: 'POST', admin: true, status: 404, code: 'NOT_FOUND' },
  { family: 'extension installer', route: '/extensions/plugin/b2b-missing-plugin/manifest', method: 'GET', status: 404, code: 'PLUGIN_NOT_FOUND' },
  { family: 'theme', route: '/extensions/themes/b2b-missing-theme/config', method: 'GET', admin: true, status: 404, code: 'THEME_NOT_FOUND' },
  { family: 'auth', route: '/auth/reset-password', method: 'POST', body: { token: missing, newPassword: 'Test123456!' }, status: 400, code: 'INVALID_RESET_TOKEN' },
];

it.each(cases)('B real TCP $family business rejection retains $status $code', async entry => {
  const response = await fixture.request(`/api/v1${entry.route}`, {
    method: entry.method,
    headers: { Authorization: `Bearer ${signJwt(users[entry.admin ? 1 : 0])}`, ...(entry.body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(entry.body === undefined ? {} : { body: JSON.stringify(entry.body) }),
  });
  expect(response.status).toBe(entry.status);
  const result = await response.json();
  expect(result.error.code).toBe(entry.code);
  if (entry.family === 'settings') {
    expect(result.error.details.issues).toEqual(expect.arrayContaining([
      { path: '/settings/localization.locale', message: 'Invalid field', code: 'ENUM' },
    ]));
  }
});

it.each(['/store/context', '/admin/dashboard', '/admin/health/summary'])('B read-only family real TCP %s succeeds without introducing a business rejection', async route => {
  const response = await fixture.request(`/api/v1${route}`, { headers: { Authorization: `Bearer ${signJwt(users[1])}` } });
  expect(response.status).toBe(200);
  expect((await response.json()).success).toBe(true);
});

it.each(['PUT', 'DELETE'])('K real TCP %s missing category preserves HEAD sanitized 500 for the real P2025', async method => {
  const response = await fixture.request(`/api/v1/admin/products/categories/${missing}`, {
    method,
    headers: { Authorization: `Bearer ${signJwt(users[1])}`, ...(method === 'PUT' ? { 'Content-Type': 'application/json' } : {}) },
    ...(method === 'PUT' ? { body: JSON.stringify({ name: 'Missing category' }) } : {}),
  });
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
});

it.each(['manifest', 'instances', 'disable-impact'])('K real TCP plugin %s preserves HEAD sanitized 500 for a real invalid stored manifest', async suffix => {
  const response = await fixture.request(`/api/v1/extensions/plugin/${invalidStoredSlug}/${suffix}`, {
    headers: { Authorization: `Bearer ${signJwt(users[1])}` },
  });
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
});

const failures = [
  { boundary: 'accountRead', route: '/account', method: 'GET', admin: false },
  { boundary: 'accountDelete', route: '/account', method: 'DELETE', body: { currentPassword: 'Test123456!' }, admin: false },
  { boundary: 'customerCreate', route: '/admin/users/', method: 'POST', body: { email: 'b2b-customer@example.test', username: 'B2bCustomer', password: 'Test123456!' }, admin: true },
  { boundary: 'inventoryAdjustment', route: '/admin/inventory/adjustments', method: 'POST', body: { variantId: missing, quantity: 1, type: 'manual' }, admin: true },
  { boundary: 'settingsBatch', route: '/admin/settings/batch', method: 'PUT', body: { settings: { 'localization.locale': 'en' } }, admin: true },
  { boundary: 'orderCancel', route: `/orders/${missing}/cancel`, method: 'POST', body: { cancelReason: 'Fixture cancellation' }, admin: false },
  { boundary: 'dashboard', route: '/admin/dashboard', method: 'GET', admin: true },
  { boundary: 'health', route: '/admin/health/summary', method: 'GET', admin: true },
  { boundary: 'resetLink', route: `/admin/customers/${missing}/password-reset-link`, method: 'POST', admin: true },
  { boundary: 'inviteLink', route: `/admin/staff/${missing}/invite-link`, method: 'POST', admin: true },
  { boundary: 'pluginInstance', route: `/extensions/plugin/b2b-missing-plugin/instances/${missing}`, method: 'PATCH', body: { enabled: false }, admin: true },
  { boundary: 'store', route: '/store/context', method: 'GET', admin: false },
];

it.each(failures)('K real TCP $boundary maps a real unknown failure to sanitized 500 (bcrypt for Prisma-special-cased defaults; transactional foreign key otherwise)', async entry => {
  const armed = await fixture.request(`/api/v1/__fixture/b2b-constraint/${entry.boundary}`, { method: 'POST' });
  expect(armed.status).toBe(200);
  const response = await fixture.request(`/api/v1${entry.route}`, {
    method: entry.method,
    headers: { Authorization: `Bearer ${signJwt(users[entry.admin ? 1 : 0])}`, ...('body' in entry ? { 'Content-Type': 'application/json' } : {}) },
    ...('body' in entry ? { body: JSON.stringify(entry.body) } : {}),
  });
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
  expect(await prisma.authToken.count({ where: { tokenHash: 'b2b-constraint-fault' } })).toBe(0);
});

it.each(failures)('K real TCP $boundary maps a real database relay outage to 503 DATABASE_UNAVAILABLE', async entry => {
  if (entry.boundary === 'store') {
    const armed = await fixture.request('/api/v1/__fixture/b2b-constraint/store', { method: 'POST' });
    expect(armed.status).toBe(200);
  }
  fixture.db.drop();
  try {
    const response = await fixture.request(`/api/v1${entry.route}`, {
      method: entry.method,
      headers: { Authorization: `Bearer ${signJwt(users[entry.admin ? 1 : 0])}`, ...('body' in entry ? { 'Content-Type': 'application/json' } : {}) },
      ...('body' in entry ? { body: JSON.stringify(entry.body) } : {}),
    });
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('DATABASE_UNAVAILABLE');
    expect(response.headers.get('Retry-After')).toBe('5');
  } finally {
    fixture.db.recover();
    await fixture.send({ kind: 'disconnect-db' });
  }
}, 120000);
