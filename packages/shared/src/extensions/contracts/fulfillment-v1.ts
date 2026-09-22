import { z } from 'zod';

const address = z.object({ country: z.string().min(2), region: z.string().optional(), city: z.string().optional(), postalCode: z.string().optional(), line1: z.string().optional(), line2: z.string().optional() }).strict();
const status = z.object({ fulfillmentId: z.string().min(1), status: z.enum(['pending', 'shipped']), carrier: z.string().min(1).optional(), trackingNumber: z.string().min(1).optional(), trackingUrl: z.string().url().optional() }).strict();

export const fulfillmentV1Methods = {
  createFulfillment: { input: z.object({ orderId: z.string().min(1), items: z.array(z.object({ orderItemId: z.string().min(1), variantId: z.string().min(1), quantity: z.number().int().positive() }).strict()), address, idempotencyKey: z.string().min(1) }).strict(), output: status },
  getStatus: { input: z.object({ fulfillmentId: z.string().min(1) }).strict(), output: status },
} as const;

export type FulfillmentV1Method = keyof typeof fulfillmentV1Methods;
export type FulfillmentV1Input<M extends FulfillmentV1Method> = z.infer<(typeof fulfillmentV1Methods)[M]['input']>;
export type FulfillmentV1Output<M extends FulfillmentV1Method> = z.infer<(typeof fulfillmentV1Methods)[M]['output']>;
