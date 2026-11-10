import { z } from 'zod';

const failure = { code: z.string().min(1).max(64), error: z.string().min(1).max(512) };
export const notificationV2Methods = {
  send: {
    input: z.object({ channel: z.literal('email'), to: z.string().email(), subject: z.string().min(1), html: z.string(), text: z.string(), locale: z.string().min(1), idempotencyKey: z.string().min(1), createdAt: z.string().datetime() }).strict(),
    output: z.discriminatedUnion('outcome', [
      z.object({ outcome: z.literal('accepted'), providerMessageId: z.string().min(1).optional() }).strict(),
      z.object({ outcome: z.literal('retryable'), ...failure, retryAfterSeconds: z.number().int().min(1).max(86400).optional() }).strict(),
      z.object({ outcome: z.literal('rejected'), ...failure }).strict(),
      z.object({ outcome: z.literal('unknown'), ...failure }).strict(),
    ]),
  },
} as const;

export type NotificationV2Method = keyof typeof notificationV2Methods;
export type NotificationV2Input<M extends NotificationV2Method> = z.infer<(typeof notificationV2Methods)[M]['input']>;
export type NotificationV2Output<M extends NotificationV2Method> = z.infer<(typeof notificationV2Methods)[M]['output']>;
