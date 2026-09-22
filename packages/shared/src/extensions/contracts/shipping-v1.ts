import { z } from 'zod';

const address = z.object({ country: z.string().min(2), region: z.string().optional(), city: z.string().optional(), postalCode: z.string().optional(), line1: z.string().optional(), line2: z.string().optional() }).strict();
const minor = z.number().int();

export const shippingV1Methods = {
  quote: {
    input: z.object({ currency: z.string().regex(/^[A-Z]{3}$/), items: z.array(z.object({ productId: z.string().min(1), variantId: z.string().min(1), quantity: z.number().int().positive(), unitPriceMinor: minor }).strict()), subtotalMinor: minor, address }).strict(),
    output: z.object({ options: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), amountMinor: minor, estimatedDays: z.object({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() }).strict().optional() }).strict()) }).strict(),
  },
} as const;

export type ShippingV1Method = keyof typeof shippingV1Methods;
export type ShippingV1Input<M extends ShippingV1Method> = z.infer<(typeof shippingV1Methods)[M]['input']>;
export type ShippingV1Output<M extends ShippingV1Method> = z.infer<(typeof shippingV1Methods)[M]['output']>;
