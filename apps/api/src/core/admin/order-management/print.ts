import { prisma } from '@/config/database';
import { OrderService } from '@/core/order/service';
import { orderWhere, orderSort, type OrderExportSelection, type OrderSort } from './list-query';

/**
 * The largest number of orders a single print job may carry.
 *
 * A print job renders in the operator's browser, so an unbounded selection
 * would be a denial of service on that browser rather than on the API. The
 * cap keeps the payload bounded; the caller learns that the result was
 * truncated through the `truncated` flag and the `matched` total.
 */
export const PRINT_ORDER_LIMIT = 200;

/** The number of orders read per database round trip. */
const PRINT_BATCH_SIZE = 100;

export interface OrderPrintCustomer {
  email: string | null;
  username: string | null;
  displayName: string | null;
}

export interface OrderPrintAddress {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
}

export interface OrderPrintItem {
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderPrintAmounts {
  subtotalAmount: number;
  shippingAmount: number;
  taxAmount: number;
  taxInclusive: boolean;
  totalAmount: number;
}

export interface OrderPrintShipment {
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
}

export interface OrderPrintOrder {
  orderNumber: string;
  status: string;
  paymentStatus: string | null;
  paymentMethod: string | null;
  createdAt: string;
  currency: string;
  customer: OrderPrintCustomer;
  shippingAddress: OrderPrintAddress | null;
  items: OrderPrintItem[];
  amounts: OrderPrintAmounts;
  shipment: OrderPrintShipment | null;
  paymentRequiresReview: boolean;
}

export interface OrderPrintPayload {
  matched: number;
  truncated: boolean;
  orders: OrderPrintOrder[];
}

/**
 * Resolve an order selection into the printable payload of the orders.
 *
 * The selection is resolved exactly like the CSV export resolves it, so the
 * print job covers the same orders the operator saw selected. The orders are
 * read in batches and the result is capped at PRINT_ORDER_LIMIT orders; the
 * payload reports how many orders matched the selection and whether the list
 * was truncated.
 */
export async function createOrderPrintPayload(selection: OrderExportSelection, sort: OrderSort = {}): Promise<OrderPrintPayload> {
  const filter = selection.mode === 'filter' ? orderWhere(selection.filter) : {};
  const where = { AND: [filter, selection.mode === 'ids'
    ? { id: { in: selection.ids } } : { id: { notIn: selection.excludeIds ?? [] } }] };

  const matched = await prisma.order.count({ where });

  const orders: OrderPrintOrder[] = [];
  let cursor: string | undefined;
  while (orders.length < PRINT_ORDER_LIMIT) {
    const take = Math.min(PRINT_BATCH_SIZE, PRINT_ORDER_LIMIT - orders.length);
    const batch = await prisma.order.findMany({
      where,
      orderBy: orderSort(sort),
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        createdAt: true,
        currency: true,
        customerEmail: true,
        subtotalAmount: true,
        shippingAmount: true,
        taxAmount: true,
        taxInclusive: true,
        totalAmount: true,
        user: { select: { email: true, username: true, locale: true } },
        shippingAddress: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            state: true,
            postalCode: true,
            country: true,
          },
        },
        items: { select: { quantity: true, unitPrice: true, lineTotal: true, catalogSnapshot: true } },
        shipments: {
          orderBy: [{ shippedAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { carrier: true, trackingNumber: true, shippedAt: true },
        },
        payments: {
          where: { status: 'REQUIRES_REVIEW', reviewResolution: null },
          select: { id: true },
          take: 1,
        },
      },
    });
    for (const order of batch) {
      const address = order.shippingAddress;
      const shipment = order.shipments[0];
      const username = order.user?.username ?? null;
      const email = order.user?.email ?? order.customerEmail ?? null;
      orders.push({
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt.toISOString(),
        currency: order.currency,
        customer: {
          email,
          username,
          displayName: username ?? email,
        },
        shippingAddress: address ? {
          firstName: address.firstName,
          lastName: address.lastName,
          phone: address.phone,
          email: address.email,
          addressLine1: address.addressLine1,
          addressLine2: address.addressLine2,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
        } : null,
        items: order.items.map(item => {
          // The product and variant names are read from the snapshot captured
          // with the item, the same way the admin order detail reads them, so
          // a printed order shows the names the order was placed with.
          const snapshot = OrderService.catalogSnapshotView(item.catalogSnapshot, order.user?.locale);
          return {
            productName: snapshot.productName,
            variantName: snapshot.variantName,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            lineTotal: Number(item.lineTotal),
          };
        }),
        amounts: {
          subtotalAmount: Number(order.subtotalAmount),
          shippingAmount: Number(order.shippingAmount),
          taxAmount: Number(order.taxAmount),
          taxInclusive: order.taxInclusive,
          totalAmount: Number(order.totalAmount),
        },
        shipment: shipment ? {
          carrier: shipment.carrier,
          trackingNumber: shipment.trackingNumber,
          shippedAt: shipment.shippedAt ? shipment.shippedAt.toISOString() : null,
        } : null,
        paymentRequiresReview: order.payments.length > 0,
      });
    }
    if (batch.length < take) break;
    cursor = batch[batch.length - 1].id;
  }

  return { matched, truncated: matched > PRINT_ORDER_LIMIT, orders };
}
