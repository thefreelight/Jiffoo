import { paymentWebhookInputSchema, type PaymentWebhookInput } from '@jiffoo/shared';
import { z } from 'zod';

// Base64 is an internal transport encoding; plugins receive the original bytes.
export const PAYMENT_WEBHOOK_WIRE_LIMIT = 2 * 1024 * 1024;
const wireSchema = paymentWebhookInputSchema.omit({ rawBody: true }).extend({
  rawBodyBase64: z.string().max(4 * Math.ceil(1024 * 1024 / 3)),
}).strict();

export function encodePaymentWebhook(input: unknown) {
  const { rawBody, ...metadata } = paymentWebhookInputSchema.parse(input);
  return { ...metadata, rawBodyBase64: Buffer.from(rawBody).toString('base64') };
}

export function decodePaymentWebhook(input: unknown): PaymentWebhookInput {
  const { rawBodyBase64, ...metadata } = wireSchema.parse(input);
  const rawBody = Buffer.from(rawBodyBase64, 'base64');
  if (rawBody.toString('base64') !== rawBodyBase64) throw new Error('Invalid webhook byte encoding');
  return paymentWebhookInputSchema.parse({ ...metadata, rawBody });
}
