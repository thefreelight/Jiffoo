import { z } from 'zod';

const address = z.object({ country: z.string().min(2), region: z.string().optional(), city: z.string().optional(), postalCode: z.string().optional(), line1: z.string().optional(), line2: z.string().optional() }).strict();
const minor = z.number().int();

export const taxV1Methods = {
  calculate: {
    input: z.object({ currency: z.string().regex(/^[A-Z]{3}$/), lines: z.array(z.object({ lineId: z.string().min(1), productId: z.string().min(1), variantId: z.string().min(1), quantity: z.number().int().positive(), amountMinor: minor }).strict()), shippingAmountMinor: minor, address }).strict(),
    output: z.object({ pricesIncludeTax: z.boolean(), lines: z.array(z.object({ lineId: z.string().min(1), taxMinor: minor }).strict()), shippingTaxMinor: minor, totalTaxMinor: minor }).strict(),
  },
} as const;

export type TaxV1Method = keyof typeof taxV1Methods;
export type TaxV1Input<M extends TaxV1Method> = z.infer<(typeof taxV1Methods)[M]['input']>;
export type TaxV1Output<M extends TaxV1Method> = z.infer<(typeof taxV1Methods)[M]['output']>;
