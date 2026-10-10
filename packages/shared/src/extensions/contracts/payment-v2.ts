import { z } from 'zod';

const currency = z.string().regex(/^[A-Z]{3}$/);
const minor = z.number().int().nonnegative().safe();
const identity = z.string().min(1);
export const paymentAccountSchema = z.object({
  namespace: identity, merchantAccount: identity, environment: z.enum(['live', 'test']),
}).strict();
export const paymentActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('redirect'), url: z.string().url() }).strict(),
  z.object({ type: z.literal('instructions'), text: identity }).strict(),
]);
export const paymentCaptureSchema = z.object({
  account: paymentAccountSchema, requestKey: identity, sessionId: identity, providerPaymentId: identity,
  amountMinor: minor, currency, observedAt: z.string().datetime(),
}).strict();
export const paymentFactSchema = z.object({
  account: paymentAccountSchema, requestKey: identity, sessionId: identity.nullable(),
  amountMinor: minor, currency, observedAt: z.string().datetime(),
  status: z.enum(['pending', 'failed', 'cancelled', 'expired', 'not_found', 'succeeded']),
  action: paymentActionSchema.optional(), captures: z.array(paymentCaptureSchema),
  canStillBeCharged: z.boolean(), requestClosed: z.boolean(), providerEventId: identity.optional(),
}).strict();
export const paymentWebhookInputSchema = z.object({
  rawBody: z.custom<Uint8Array>(value => value instanceof Uint8Array).refine(value => value.byteLength <= 1024 * 1024),
  contentType: identity, headers: z.record(z.array(z.string())),
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
  z.object({ verification: z.literal('verified'), events: z.array(paymentFactSchema), response: webhookResponse.optional() }).strict(),
  z.object({ verification: z.literal('rejected'), reasonCode: z.enum(['MISSING_SIGNATURE', 'INVALID_SIGNATURE', 'SIGNATURE_EXPIRED', 'INVALID_PAYLOAD', 'WEBHOOK_NOT_SUPPORTED']), response: webhookResponse.optional() }).strict(),
]);
export const paymentV2Methods = {
  describe: {
    input: z.object({ storeCurrency: currency }).strict(),
    output: z.object({ displayName: identity, requiresManualConfirmation: z.boolean(), unpaidTimeoutMinutes: z.number().int().min(1),
      supportedCurrencies: z.array(currency).min(1), instructions: identity.optional(), account: paymentAccountSchema }).strict(),
  },
  createSession: {
    input: z.object({ orderId: identity, amountMinor: minor, currency, account: paymentAccountSchema,
      customer: z.object({ id: identity, email: z.string().email() }).strict(),
      returnUrl: z.string().url(), cancelUrl: z.string().url(), idempotencyKey: identity }).strict(),
    output: paymentFactSchema,
  },
  queryByRequestKey: {
    input: z.object({ requestKey: identity, account: paymentAccountSchema,
      request: z.object({ orderId: identity, amountMinor: minor, currency, createdAt: z.string().datetime(),
        expiresAt: z.string().datetime(), knownCaptures: z.array(paymentCaptureSchema) }).strict(),
    }).strict(), output: paymentFactSchema,
  },
  handleWebhook: { input: paymentWebhookInputSchema, output: webhookOutcomeSchema },
} as const;
export type PaymentAccountIdentity = z.infer<typeof paymentAccountSchema>;
export type PaymentFact = z.infer<typeof paymentFactSchema>;
export type PaymentCapture = z.infer<typeof paymentCaptureSchema>;
export type PaymentWebhookInput = z.infer<typeof paymentWebhookInputSchema>;
export type WebhookOutcome = z.infer<typeof webhookOutcomeSchema>;
export type PaymentV2Method = keyof typeof paymentV2Methods;
export type PaymentV2Input<M extends PaymentV2Method> = z.infer<(typeof paymentV2Methods)[M]['input']>;
export type PaymentV2Output<M extends PaymentV2Method> = z.infer<(typeof paymentV2Methods)[M]['output']>;
