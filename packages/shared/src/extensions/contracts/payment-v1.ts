import { z } from 'zod';

const currency = z.string().regex(/^[A-Z]{3}$/);
const minor = z.number().int();

export const paymentV1Methods = {
  describe: {
    input: z.object({}).strict(),
    output: z.object({
      displayName: z.string().min(1),
      requiresManualConfirmation: z.boolean(),
      unpaidTimeoutMinutes: z.number().int().min(1),
      supportedCurrencies: z.array(currency).min(1),
      instructions: z.string().min(1).optional(),
    }).strict(),
  },
  createSession: {
    input: z.object({
      orderId: z.string().min(1), amountMinor: minor, currency,
      customer: z.object({ id: z.string().min(1), email: z.string().email() }).strict(),
      returnUrl: z.string().url(), cancelUrl: z.string().url(), idempotencyKey: z.string().min(1),
    }).strict(),
    output: z.object({
      sessionId: z.string().min(1),
      action: z.discriminatedUnion('type', [z.object({ type: z.literal('redirect'), url: z.string().url() }).strict(), z.object({ type: z.literal('instructions'), text: z.string().min(1) }).strict()]),
    }).strict(),
  },
  getSessionStatus: {
    input: z.object({ sessionId: z.string().min(1) }).strict(),
    output: z.object({ status: z.enum(['pending', 'succeeded', 'failed', 'cancelled']), providerEventId: z.string().min(1).optional() }).strict(),
  },
  handleWebhook: {
    input: z.object({ headers: z.record(z.string()), query: z.record(z.string()), rawBody: z.string() }).strict(),
    output: z.object({ events: z.array(z.object({ providerEventId: z.string().min(1), sessionId: z.string().min(1), status: z.enum(['succeeded', 'failed']) }).strict()) }).strict(),
  },
  refund: {
    input: z.object({ sessionId: z.string().min(1), amountMinor: minor, currency, idempotencyKey: z.string().min(1) }).strict(),
    output: z.object({ refundId: z.string().min(1), status: z.enum(['pending', 'succeeded', 'failed']) }).strict(),
  },
} as const;

export type PaymentV1Method = keyof typeof paymentV1Methods;
export type PaymentV1Input<M extends PaymentV1Method> = z.infer<(typeof paymentV1Methods)[M]['input']>;
export type PaymentV1Output<M extends PaymentV1Method> = z.infer<(typeof paymentV1Methods)[M]['output']>;
