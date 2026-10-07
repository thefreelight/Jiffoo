import { z } from 'zod';

const currency = z.string().regex(/^[A-Z]{3}$/);
const minor = z.number().int();

export const paymentWebhookInputSchema = z.object({
  rawBody: z.custom<Uint8Array>(value => value instanceof Uint8Array).refine(value => value.byteLength <= 1024 * 1024),
  contentType: z.string().min(1),
  headers: z.record(z.array(z.string())),
  query: z.record(z.union([z.string(), z.array(z.string())])),
}).strict();

const webhookResponse = z.object({
  contentType: z.enum(['application/json', 'text/plain']),
  body: z.string().refine(value => new TextEncoder().encode(value).byteLength <= 16 * 1024),
}).strict().refine(value => {
  if (value.contentType !== 'application/json') return true;
  try { JSON.parse(value.body); return true; } catch { return false; }
});
export const webhookOutcomeSchema = z.discriminatedUnion('verification', [
  z.object({
    verification: z.literal('verified'),
    events: z.array(z.object({ providerEventId: z.string().min(1), sessionId: z.string().min(1), status: z.enum(['succeeded', 'failed']) }).strict()),
    response: webhookResponse.optional(),
  }).strict(),
  z.object({
    verification: z.literal('rejected'),
    reasonCode: z.enum(['MISSING_SIGNATURE', 'INVALID_SIGNATURE', 'SIGNATURE_EXPIRED', 'INVALID_PAYLOAD', 'WEBHOOK_NOT_SUPPORTED']),
    response: webhookResponse.optional(),
  }).strict(),
]);

export type PaymentWebhookInput = z.infer<typeof paymentWebhookInputSchema>;
export type WebhookOutcome = z.infer<typeof webhookOutcomeSchema>;

export const paymentV1Methods = {
  describe: {
    input: z.object({ storeCurrency: currency }).strict(),
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
    input: paymentWebhookInputSchema,
    output: webhookOutcomeSchema,
  },
  refund: {
    input: z.object({ sessionId: z.string().min(1), amountMinor: minor, currency, idempotencyKey: z.string().min(1) }).strict(),
    output: z.object({ refundId: z.string().min(1), status: z.enum(['pending', 'succeeded', 'failed']) }).strict(),
  },
} as const;

export type PaymentV1Method = keyof typeof paymentV1Methods;
export type PaymentV1Input<M extends PaymentV1Method> = z.infer<(typeof paymentV1Methods)[M]['input']>;
export type PaymentV1Output<M extends PaymentV1Method> = z.infer<(typeof paymentV1Methods)[M]['output']>;
