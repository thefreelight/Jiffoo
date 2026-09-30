import { z } from 'zod';

const id = z.string().min(1);
const amount = z.number().finite().nonnegative();
const json: z.ZodType<unknown> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(), z.array(json), z.record(json),
]));
const record = z.record(json);
const item = z.object({
  id, productId: id, variantId: id, quantity: z.number().int().positive(),
  unitPrice: amount, fulfillmentData: record.nullable(),
}).strict();
const payment = z.object({
  paymentId: id, orderId: id, userId: id.optional(), amount,
  currency: id, metadata: json,
}).strict();

export const eventRegistry = {
  'order.created': z.object({ id, userId: id, totalAmount: amount, currency: id, items: z.array(item) }).strict(),
  'order.cancelled': z.object({ id, orderId: id, userId: id, reason: z.string() }).strict(),
  'order.refunded': z.object({
    id, orderId: id, refundId: id, userId: id, paymentId: id.optional(),
    amount, currency: id, fullyRefunded: z.boolean(), reason: z.string().optional(),
    providerRefundId: id.optional(),
    items: z.array(z.object({ orderItemId: id, quantity: z.number().int().positive() }).strict()).optional(),
  }).strict(),
  'order.paid': z.object({
    orderId: id, userId: id,
    order: z.object({
      id, userId: id, customerEmail: z.string().nullable(), totalAmount: amount, currency: id,
      items: z.array(item.extend({
        productName: z.string().optional(), variantName: z.string().optional(),
        skuCode: z.string().nullable().optional(), productTypeData: record,
      }).strict()),
    }).strict(),
    payment: z.object({
      paymentId: id.optional(), paymentMethod: id.optional(),
      paymentIntentId: z.string().nullable().optional(), sessionId: z.string().nullable().optional(),
      providerEventId: z.string().nullable().optional(),
    }).strict(),
    metadata: record,
  }).strict(),
  'payment.succeeded': payment,
  'payment.failed': payment,
} as const;

export type EventKey = keyof typeof eventRegistry;
export type EventPayload<K extends EventKey> = z.infer<(typeof eventRegistry)[K]>;
export type EventSubscription = { type: EventKey; version: 1 };
export type PluginEvent<K extends EventKey = EventKey> = {
  id: string; type: K; version: 1; aggregateId: string;
  occurredAt: string; attempt: number; data: EventPayload<K>;
};
export type PluginEventHandler = (event: PluginEvent) => unknown | Promise<unknown>;

export function isEventKey(type: unknown): type is EventKey {
  return typeof type === 'string' && Object.prototype.hasOwnProperty.call(eventRegistry, type);
}

export function parseEventPayload<K extends EventKey>(type: K, version: number, data: unknown): EventPayload<K> {
  if (!isEventKey(type) || version !== 1) throw new Error(`Unknown event ${String(type)} v${version}`);
  const parsed = eventRegistry[type].parse(data);
  // Strip optional undefined properties before writing the immutable JSON snapshot.
  return JSON.parse(JSON.stringify(parsed)) as EventPayload<K>;
}
