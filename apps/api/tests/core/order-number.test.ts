import { afterAll, beforeAll, expect, it } from 'vitest';
import { prisma } from '@/config/database';
import { allocateOrderNumber, formatOrderNumber, orderNumberDay } from '@/core/order/number';
import { createUserWithToken } from '../helpers/auth';
import { systemSettingsService } from '@/core/settings/service';
import { createOrderNotification } from '@/core/notifications/service';

let userId: string;
let original: Record<string, any>;
const ids: string[] = [];
beforeAll(async () => {
  userId = (await createUserWithToken()).user.id;
  original = await systemSettingsService.getAllSettings();
});
afterAll(async () => {
  await prisma.notification.deleteMany({ where: { relatedType: 'order', relatedId: { in: ids } } });
  await prisma.order.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.delete({ where: { id: userId } });
  await systemSettingsService.setSetting('orders.number_prefix', original['orders.number_prefix']);
  await systemSettingsService.setSetting('localization.timezone', original['localization.timezone']);
  await prisma.orderNumberCounter.deleteMany({ where: { day: { startsWith: '204001' } } });
});
const create = (createdAt: Date) => prisma.$transaction(async tx => {
  const row = await tx.order.create({ data: { ...await allocateOrderNumber(tx, createdAt), userId, subtotalAmount: 1, totalAmount: 1 } });
  ids.push(row.id);
  return row;
}, { maxWait: 30_000, timeout: 30_000 });

it('formats a minimum of four digits without adding extra zeroes after 9999', () => {
  expect(formatOrderNumber('JF', '20261016', 1)).toBe('JF-20261016-0001');
  expect(formatOrderNumber('JF', '20261016', 42)).toBe('JF-20261016-0042');
  expect(formatOrderNumber('JF', '20261016', 10000)).toBe('JF-20261016-10000');
  expect(orderNumberDay(new Date('2026-10-16T03:30:00Z'), 'America/New_York')).toBe('20261015');
});
it('creates concurrent orders with unique gap-free daily numbers in the store timezone', async () => {
  await systemSettingsService.setSetting('orders.number_prefix', 'JF');
  await systemSettingsService.setSetting('localization.timezone', 'America/New_York');
  const orders = await Promise.all(Array.from({ length: 24 }, () => create(new Date('2040-01-02T04:30:00Z'))));
  expect(orders.map(row => row.orderNumber).sort()).toEqual(Array.from({ length: 24 }, (_, i) => formatOrderNumber('JF', '20400101', i + 1)));
  await prisma.$transaction(tx => createOrderNotification(tx, 'shipped', orders[0].id));
  const mail = await prisma.notification.findFirstOrThrow({ where: { relatedType: 'order', relatedId: orders[0].id } });
  expect(mail.text).toContain(orders[0].orderNumber);
  expect(mail.text).not.toContain(orders[0].id);
  await systemSettingsService.setSetting('orders.number_prefix', 'SHOP');
  expect((await create(new Date('2040-01-02T04:30:00Z'))).orderNumber).toBe('SHOP-20400101-0025');
  expect((await prisma.order.findUniqueOrThrow({ where: { id: orders[0].id } })).orderNumber).toBe(orders[0].orderNumber);
  expect((await create(new Date('2040-01-02T05:00:00Z'))).orderNumber).toBe('SHOP-20400102-0001');
});
