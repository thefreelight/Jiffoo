import { z } from 'zod';

const failure = { code: z.string().min(1).max(64), error: z.string().min(1).max(512) };
export const notificationReceiptSchema = z.object({
  eventId: z.string().min(1).max(200), providerMessageId: z.string().min(1).max(200),
  notificationId: z.string().min(1).max(200),
  recipient: z.string().email().max(320),
  type: z.enum(['delivered', 'delayed', 'bounced', 'complained', 'failed']),
  occurredAt: z.string().datetime(),
}).strict();
export const notificationV3Methods = {
  send: {
    input: z.object({ channel: z.literal('email'), to: z.string().email(), subject: z.string().min(1), html: z.string(), text: z.string(), locale: z.string().min(1), idempotencyKey: z.string().min(1), createdAt: z.string().datetime() }).strict(),
    output: z.discriminatedUnion('outcome', [
      z.object({ outcome: z.literal('accepted'), providerMessageId: z.string().min(1).optional() }).strict(),
      z.object({ outcome: z.literal('retryable'), ...failure, retryAfterSeconds: z.number().int().min(1).max(86400).optional() }).strict(),
      z.object({ outcome: z.literal('rejected'), ...failure }).strict(),
      z.object({ outcome: z.literal('unknown'), ...failure }).strict(),
    ]),
  },
  verifyReceipt: {
    input: z.object({ rawBody: z.string().max(65536), headers: z.record(z.string().max(8192)) }).strict(),
    output: z.discriminatedUnion('outcome', [
      z.object({ outcome: z.literal('verified'), events: z.array(notificationReceiptSchema).max(100) }).strict(),
      z.object({ outcome: z.literal('invalid'), code: z.string().min(1).max(64) }).strict(),
      z.object({ outcome: z.literal('unavailable'), code: z.string().min(1).max(64) }).strict(),
    ]),
  },
} as const;
export type NotificationReceiptInput = z.infer<typeof notificationReceiptSchema>;
export type NotificationV3Method = keyof typeof notificationV3Methods;
export type NotificationV3Input<M extends NotificationV3Method> = z.infer<(typeof notificationV3Methods)[M]['input']>;
export type NotificationV3Output<M extends NotificationV3Method> = z.infer<(typeof notificationV3Methods)[M]['output']>;
