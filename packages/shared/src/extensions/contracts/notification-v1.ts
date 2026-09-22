import { z } from 'zod';

export const notificationV1Methods = {
  send: { input: z.object({ channel: z.literal('email'), to: z.string().email(), subject: z.string().min(1), html: z.string(), text: z.string(), locale: z.string().min(1), idempotencyKey: z.string().min(1) }).strict(), output: z.object({ accepted: z.boolean(), providerMessageId: z.string().min(1).optional(), error: z.string().min(1).optional() }).strict() },
} as const;

export type NotificationV1Method = keyof typeof notificationV1Methods;
export type NotificationV1Input<M extends NotificationV1Method> = z.infer<(typeof notificationV1Methods)[M]['input']>;
export type NotificationV1Output<M extends NotificationV1Method> = z.infer<(typeof notificationV1Methods)[M]['output']>;
