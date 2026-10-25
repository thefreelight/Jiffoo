import { prisma } from '@/config/database';
import { systemSettingsService } from '@/core/settings/service';
import { csvCell, csvTimestamp, csvFilename, csvStream } from '@/utils/csv';
import { getAllMessages } from 'shared/src/i18n';
import type { Locale } from 'shared/src/i18n/config';
import { orderWhere, orderSort, type OrderExportSelection, type OrderSort } from './list-query';
import { PaymentStatus } from '@/core/order/policy';

export async function createOrderExport(selection: OrderExportSelection, sort: OrderSort, locale: Locale) {
  const filter = selection.mode === 'filter' ? orderWhere(selection.filter) : {};
  const where = { AND: [filter, selection.mode === 'ids'
    ? { id: { in: selection.ids } } : { id: { notIn: selection.excludeIds ?? [] } }] };
  const timezone = await systemSettingsService.getTimezone();
  const messages = getAllMessages(locale).merchant!;
  const orders = messages.orders as Record<string, string | Record<string, string>>;
  const labels = orders.list as Record<string, string>;
  const timestamp = (value: Date | null) => csvTimestamp(value, timezone);
  const yesNo = (value: boolean) => labels[value ? 'yes' : 'no'];
  async function* rows() {
    yield '\uFEFF' + labels.csvHeaders.split('|').map(csvCell).join(',') + '\r\n';
    let cursor: string | undefined;
    while (true) {
      const batch = await prisma.order.findMany({ where, orderBy: orderSort(sort), take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { user: { select: { email: true, username: true } }, items: { select: { quantity: true } },
          shippingAddress: true, payments: { where: { status: 'REQUIRES_REVIEW', reviewResolution: null }, select: { id: true }, take: 1 },
          shipments: { orderBy: [{ shippedAt: 'desc' }, { id: 'desc' }], take: 1 },
        },
      });
      for (const order of batch) {
        const address = order.shippingAddress, shipment = order.shipments[0];
        const paymentLabel = order.paymentStatus === PaymentStatus.PAID ? orders.paid : order.paymentStatus === PaymentStatus.REFUNDED ? orders.refunded : labels.unpaid;
        yield [order.orderNumber, timestamp(order.createdAt), timezone, orders[order.status.toLowerCase()], paymentLabel,
          yesNo(order.payments.length > 0), order.user.email, order.user.username,
          order.items.length, order.items.reduce((sum, item) => sum + item.quantity, 0),
          order.subtotalAmount.toFixed(2), order.shippingAmount.toFixed(2), order.taxAmount.toFixed(2), yesNo(order.taxInclusive),
          order.totalAmount.toFixed(2), order.currency, order.paymentMethod,
          address ? [address.firstName, address.lastName].filter(Boolean).join(' ') : '', address?.phone,
          address?.addressLine1, address?.addressLine2, address?.city, address?.state, address?.postalCode, address?.country,
          shipment?.carrier, shipment?.trackingNumber, timestamp(shipment?.shippedAt ?? null),
        ].map(csvCell).join(',') + '\r\n';
      }
      if (batch.length < 500) break;
      cursor = batch[batch.length - 1].id;
    }
  }
  return { stream: csvStream(rows()), filename: csvFilename('orders', timezone) };
}
