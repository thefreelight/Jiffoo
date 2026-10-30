import { ApiError, type ErrorCode } from '@/utils/api-errors';
import { prisma } from '@/config/database';
import {
  Prisma,
  OrderStatus as PrismaOrderStatus,
  OrderPaymentStatus as PrismaOrderPaymentStatus,
} from '@prisma/client';
import { PLUGIN_CONTRACT_VERSIONS } from '@jiffoo/shared';
import { CartService } from '@/core/cart/service';
import { CheckoutService } from '@/core/checkout/service';
import { CacheService } from '@/core/cache/service';
import { ProductService, type CatalogProductProjection } from '@/core/product/service';
import { InventoryService } from '@/core/inventory/service';
import { systemSettingsService } from '@/core/settings/service';
import { AuthIdentityService } from '@/core/auth/identity-service';
import { emitEvent } from '@/infra/events/emit';
import { resolveSingleProvider } from '@/core/extensions/registry';
import { callContract } from '@/core/extensions/runtime/plugin-runtime';
import { ContractCallError } from '@/core/extensions/runtime/contract-errors';
import { recordPluginFailure } from '@/core/extensions/runtime/failure';
import { bindPurchaseOrigin } from '@/core/plugin-pages/service';
import { decimalToMinor, minorToDecimal, MoneyError } from '@/core/shared/money';
import { currentLinePrice } from '@/core/shared/pricing';
import { fulfillmentPlanFor, fulfillmentPolicyFor, orderRequiresShippingAddress, type FulfillmentPolicy } from '@/core/shared/fulfillment-policy';
import { allocateOrderNumber } from '@/core/order/number';
import { recordOrderStatusHistory } from '@/core/order/status-history';
import { createCatalogSnapshot } from '@/core/order/catalog-snapshot';
import { normalizeOrderIdempotencyKey, orderRequestFingerprint } from '@/core/order/idempotency';
import { OrderStatus, PaymentStatus } from '@/core/order/policy';
import { countryRequiresStatePostal, normalizeCountryCode, type CreateOrderRequest } from '@/core/order/types';

/**
 * The order placement pipeline.
 *
 * Placing an order is an ordered list of named stages. Every stage reads the
 * shared context of the placement and writes its own part into it. A stage
 * that stops the pipeline ends the placement, which is how the idempotent
 * replay returns the original order before any pricing or provider work runs.
 *
 * The module holds no state: the stage list and the context are built inside
 * a function body, so the pipeline adds nothing to the module state audit.
 */

/** The milliseconds the order placement transaction may hold its connection. */
const ORDER_PLACEMENT_TRANSACTION_TIMEOUT_MS = 30_000;
/** The milliseconds the order placement transaction waits for a free connection of the pool. */
const ORDER_PLACEMENT_TRANSACTION_MAX_WAIT_MS = 10_000;

/** A line of the order, as it is placed. */
type OrderItemDraft = {
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  /**
   * The exact price of the line in the minor units of the currency.
   *
   * The amount of a line is money, and money is not a binary float: the
   * minor amount is the exact one, so every amount the placement derives
   * from it stays exact.
   */
  unitPriceMinor: number;
};

/** A line whose stock is decremented when the order is placed. */
type StockItem = {
  variantId: string;
  quantity: number;
};

/** A shipping option of the quote of the order. */
type ShippingOption = {
  id: string;
  providerSlug: string;
  label: string;
  amountMinor: number;
};

/** The description of the payment provider of the order. */
type PaymentMethodDescription = {
  unpaidTimeoutMinutes: number;
  supportedCurrencies: string[];
};

/** The tax of the order. */
type TaxResult = {
  pricesIncludeTax: boolean;
  lines: Array<{ lineId: string; taxMinor: number }>;
  totalTaxMinor: number;
};

/**
 * The fulfilment plan of an order: the combination of the shipping flag of
 * the items and the fulfilment policy of their product types.
 */
export type OrderPlacementFulfillmentPlan = {
  /**
   * The address rule of the order: the order needs a shipping address.
   *
   * The rule is explicit and it is the only authority of the address
   * requirement of an order: it is the shared rule of the shared layer, the
   * combination of the fulfilment policies of the product types of the order
   * and the address rules of its lines. The default policy asks for an
   * address, so an order of a store that enables no fulfilment policy needs
   * an address, exactly as before.
   */
  requiresShippingAddress: boolean;
  /** The order needs a shipping quote and a shipping option. */
  requiresShippingQuote: boolean;
  /** The stock of the order is tracked and decremented when it is sold. */
  tracksInventory: boolean;
};

/** The fulfilment of an order item: the product type and the policy of that type. */
type OrderItemFulfillment = {
  productType: string;
  policy: FulfillmentPolicy;
  /** The product of the item asks for shipping. */
  requiresShipping: boolean;
};

/** The shared context of one order placement. */
export type OrderPlacementContext = {
  userId: string;
  data: CreateOrderRequest;
  normalizedShippingAddress?: NonNullable<CreateOrderRequest['shippingAddress']>;
  identity: { email: string; locale: string | null } | null;
  currency: string;
  idempotencyKey: string;
  requestFingerprint: string;
  productIds: string[];
  catalog: Map<string, CatalogProductProjection>;
  orderItems: OrderItemDraft[];
  itemFulfillments: OrderItemFulfillment[];
  stockItems: StockItem[];
  fulfillmentPlan: OrderPlacementFulfillmentPlan;
  selectedShipping: ShippingOption | null;
  paymentMethodDescription: PaymentMethodDescription;
  shippingMinor: number;
  tax: TaxResult;
  /**
   * The exact subtotal of the order in the minor units of the currency.
   *
   * The subtotal is the sum of the exact minor amounts of the lines, so it
   * never carries the rounding error of a binary float.
   */
  totalMinor: number;
  totalAmount: number;
  subtotalAmount: number;
  shippingAmount: number;
  taxAmount: number;
  unpaidExpiresAt: Date;
  result: { order: any; replayed: boolean } | null;
  transactionFailed: boolean;
  transactionError: unknown;
  stopped: boolean;
};

/** One named stage of the order placement. */
export type OrderPlacementStage = {
  name: string;
  run: (context: OrderPlacementContext) => Promise<void>;
};

/** The outcome of an order placement, before the order service formats it. */
export type OrderPlacementOutcome = {
  order: any;
  replayed: boolean;
  currency: string;
  locale: string | null;
};

/**
 * The JSON record reader of the order module.
 *
 * The pipeline builds the `order.created` payload with it, so it lives next to
 * the payload; the order service re-exports it for the module's public
 * surface.
 */
export function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string') return null;

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

/** The include of the order rows the placement reads. */
function orderResponseInclude() {
  return { shippingAddress: true, items: true } as const;
}

/** The shipping address of the request, normalised. */
function normalizeShippingAddress(
  address: NonNullable<CreateOrderRequest['shippingAddress']> & {
    fullName?: string;
    phone?: string;
  }
): NonNullable<CreateOrderRequest['shippingAddress']> {
  const firstName = (address as any).firstName?.trim();
  const lastName = (address as any).lastName?.trim();
  const fullName = (address as any).fullName?.trim();
  const nameParts = fullName ? fullName.split(/\s+/).filter(Boolean) : [];
  const normalizedFirstName = firstName || nameParts[0] || '';
  const normalizedLastName = lastName || nameParts.slice(1).join(' ') || normalizedFirstName;

  return {
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
    phone: (address as any).phone?.trim() || 'N/A',
    addressLine1: (address as any).addressLine1?.trim() || '',
    addressLine2: (address as any).addressLine2?.trim() || undefined,
    city: (address as any).city?.trim() || '',
    state: (address as any).state?.trim() || undefined,
    postalCode: (address as any).postalCode?.trim() || undefined,
    country: (address as any).country?.trim() || '',
    email: (address as any).email?.trim() || undefined,
  };
}

/** The required fields of a shipping address, including the country rules. */
async function validateShippingAddress(address: NonNullable<CreateOrderRequest['shippingAddress']>) {
  const requiredFields: Array<keyof NonNullable<CreateOrderRequest['shippingAddress']>> = [
    'firstName',
    'lastName',
    'phone',
    'addressLine1',
    'city',
    'country',
  ];

  for (const field of requiredFields) {
    const value = (address[field] as unknown as string | undefined)?.trim();
    if (!value) {
      throw new ApiError('BAD_REQUEST');
    }
  }

  const countriesRequireStatePostal = await systemSettingsService.getCheckoutCountriesRequireStatePostal();
  const normalizedCountries = countriesRequireStatePostal.map((code) => normalizeCountryCode(code));

  if (countryRequiresStatePostal(address.country, normalizedCountries)) {
    if (!address.state || address.state.trim().length === 0) {
      throw new ApiError('BAD_REQUEST');
    }
    if (!address.postalCode || address.postalCode.trim().length === 0) {
      throw new ApiError('BAD_REQUEST');
    }
  }
}

/**
 * Resolve an order that already owns the supplied idempotency key.
 * Returns null when the key is unused and rejects a key that is reused with a different request.
 *
 * The key is scoped to the customer: two customers may use the same key, so the
 * lookup matches the key inside the customer scope.
 */
async function findOrderByIdempotencyKey(
  idempotencyKey: string,
  userId: string,
  requestFingerprint: string,
): Promise<{ order: any; replayed: true } | null> {
  const existing = await prisma.order.findFirst({ where: { userId, idempotencyKey }, include: orderResponseInclude() });
  if (!existing) return null;
  assertIdempotentReplay(existing, userId, requestFingerprint);
  return { order: existing, replayed: true };
}

/** Reject an idempotency key that is reused with a different request. */
function assertIdempotentReplay(
  existing: { userId: string; idempotencyFingerprint: string | null },
  userId: string,
  requestFingerprint: string,
): void {
  if (existing.userId !== userId || existing.idempotencyFingerprint !== requestFingerprint) {
    throw new ApiError('ORDER_IDEMPOTENCY_CONFLICT');
  }
}

/**
 * Number of requested order variants that the catalog projection knows.
 * Mirrors the foreign key guard of the order items without a second query.
 */
function countCatalogVariants(
  catalog: Map<string, CatalogProductProjection>,
  orderItems: Array<{ productId: string; variantId: string }>,
): number {
  const known = new Set<string>();
  for (const product of catalog.values()) {
    for (const variant of product.variants) known.add(`${product.id}:${variant.id}`);
  }
  const requested = [...new Set(orderItems.map(item => `${item.productId}:${item.variantId}`))];
  return requested.filter(pair => known.has(pair)).length;
}

/**
 * A plugin amount that is not a real amount is rejected, never clamped.
 *
 * The shipping and the tax amounts come from the plugin contracts, and a
 * negative amount would be written into the order as a negative amount: the
 * check constraint of the schema would turn a successful placement into a
 * database error. The rejection keeps the plugin bug visible instead of
 * hiding it behind a clamped amount.
 */
function assertNonNegativePluginAmount(amountMinor: number, source: string): void {
  if (!Number.isFinite(amountMinor) || amountMinor < 0) {
    throw Object.assign(new ApiError('VALIDATION_ERROR'), { message: `The ${source} provider returned an invalid amount` });
  }
}

/**
 * The reason of a failed provider.
 *
 * The reason is the code of the contract error, so the monitoring reads one
 * vocabulary. A failure that is not a contract error is a failure of the
 * provider as well, and its internal message never reaches the client.
 */
function providerFailureReason(error: unknown): string {
  return error instanceof ContractCallError ? error.code : 'CONTRACT_CALL_FAILED';
}

/**
 * The exclusion of a provider the placement could not use.
 *
 * The failure of the provider is recorded for the operator and the exclusion
 * is logged with the same event and the same context fields as every other
 * module of the Core, so one monitoring rule covers every failed provider.
 * The helper stays inside the module: the modules do not expose their
 * internals to each other.
 */
async function excludeFailedProvider(slug: string, contract: 'tax', error: unknown): Promise<void> {
  const reason = providerFailureReason(error);
  if (reason !== 'PLUGIN_DISABLED') await recordPluginFailure(slug, error, 'order');
  console.error(JSON.stringify({ event: 'provider_excluded', slug, reason, contract }));
}

/**
 * The error code of a failed tax provider.
 *
 * A timeout keeps its own code, so the caller can tell a hanging provider
 * from a failing one. Every other failure, including a failure that is not a
 * contract error at all, is a provider failure.
 */
function taxProviderFailureCode(error: unknown): ErrorCode {
  return error instanceof ContractCallError && error.code === 'PLUGIN_TIMEOUT' ? 'PLUGIN_TIMEOUT' : 'CONTRACT_CALL_FAILED';
}

/**
 * The stages of the order placement, in the order they run.
 *
 * The list is built inside the function, so the module holds no state.
 */
function createOrderPlacementStages(): OrderPlacementStage[] {
  return [
    {
      name: 'normalize-shipping-address',
      run: async context => {
        context.normalizedShippingAddress = context.data.shippingAddress
          ? normalizeShippingAddress(context.data.shippingAddress as any)
          : undefined;
      },
    },
    {
      name: 'read-account-identity',
      run: async context => {
        const identity = await AuthIdentityService.readProfile(prisma, context.userId);
        if (!identity) {
          throw new ApiError('BAD_REQUEST');
        }
        context.identity = identity;
      },
    },
    {
      name: 'read-shop-currency',
      run: async context => {
        context.currency = await systemSettingsService.getShopCurrency();
        // The currency of the request is an assertion, not a choice: the store
        // decides the currency of the amounts, and a request that names
        // another one is refused instead of being answered with an order in a
        // currency the customer did not ask for.
        if (context.data.currency && context.data.currency !== context.currency) {
          throw new ApiError('VALIDATION_ERROR');
        }
      },
    },
    {
      name: 'normalize-idempotency',
      run: async context => {
        const idempotencyKey = normalizeOrderIdempotencyKey(context.data.idempotencyKey);
        if (!idempotencyKey) throw new ApiError('BAD_REQUEST');
        context.idempotencyKey = idempotencyKey;
        context.requestFingerprint = orderRequestFingerprint(context.data);
      },
    },
    {
      name: 'resolve-idempotent-replay',
      run: async context => {
        // A replay must return the original order before any pricing or provider work runs.
        const replay = await findOrderByIdempotencyKey(
          context.idempotencyKey,
          context.userId,
          context.requestFingerprint,
        );
        if (!replay) return;
        context.result = { order: replay.order, replayed: true };
        context.stopped = true;
      },
    },
    {
      name: 'validate-items-prices-and-stock',
      run: async context => {
        const data = context.data;
        let totalMinor = 0;
        const orderItems: OrderItemDraft[] = [];
        const itemFulfillments: OrderItemFulfillment[] = [];
        const stockItems: StockItem[] = [];

        if (!data.items || data.items.length === 0) {
          throw Object.assign(new ApiError('BAD_REQUEST'), { message: 'Order must contain at least one item' });
        }

        // Batch fetch all products to avoid N+1 query problem
        const productIds = data.items.map(item => item.productId);
        context.productIds = productIds;
        const catalog = await ProductService.getSellableCatalog(prisma, productIds);
        context.catalog = catalog;

        // Create a map for O(1) lookup
        const productMap = catalog;
        const requestedQuantityByVariant = new Map<string, number>();
        for (const item of data.items) {
          if (!item.variantId) continue;
          requestedQuantityByVariant.set(
            item.variantId,
            (requestedQuantityByVariant.get(item.variantId) || 0) + item.quantity
          );
        }

        for (const item of data.items) {
          const product = productMap.get(item.productId);

          if (!product) {
            throw new ApiError('BAD_REQUEST');
          }

          if (!product.isActive) {
            throw new ApiError('BAD_REQUEST');
          }

          const variantId = item.variantId;

          if (!variantId) {
            throw new ApiError('BAD_REQUEST');
          }

          const variant = product.variants.find(v => v.id === variantId);
          if (!variant) {
            throw new ApiError('BAD_REQUEST');
          }

          if (!variant.isActive) {
            throw new ApiError('BAD_REQUEST');
          }

          const policy = fulfillmentPolicyFor(product.productType);

          const { unitPrice, unitPriceMinor } = currentLinePrice(variant, context.currency);
          // A price that is not a price is refused here, never clamped: a
          // negative price makes the total of the order disagree with the
          // total of the quote, so the request would be answered with a
          // quote that changed, or the order event would carry a price that
          // its own schema refuses, and neither answer names the price. The
          // refusal is a validation failure of the request, and no order is
          // written.
          if (unitPriceMinor < 0) {
            throw Object.assign(new ApiError('VALIDATION_ERROR'), { message: `The price of variant ${variant.name} of product ${product.name} is negative` });
          }
          const requestedQuantity = requestedQuantityByVariant.get(variantId) ?? item.quantity;
          const stock = variant.stock;

          // The stock requirement is part of the fulfilment policy: a line of
          // a product type whose policy does not track the inventory is not
          // rejected for stock, because its stock is not tracked.
          if (policy.tracksInventory && stock < requestedQuantity) {
            throw Object.assign(new ApiError('BAD_REQUEST'), { message: `Insufficient stock for variant ${variant.name} of product: ${product.name}` });
          }

          // The subtotal is summed in the minor units of the currency, so the
          // sum of the lines is the exact sum of their prices: a float sum
          // would carry a rounding error the money module cannot convert.
          totalMinor += unitPriceMinor * item.quantity;
          orderItems.push({
            productId: item.productId,
            variantId,
            quantity: item.quantity,
            unitPrice,
            unitPriceMinor,
          });
          itemFulfillments.push({ productType: product.productType, policy, requiresShipping: product.requiresShipping });
          if (policy.tracksInventory) {
            stockItems.push({ variantId, quantity: item.quantity });
          }
        }

        context.orderItems = orderItems;
        context.itemFulfillments = itemFulfillments;
        context.stockItems = stockItems;
        context.totalMinor = totalMinor;
        context.totalAmount = Number(minorToDecimal(totalMinor, context.currency));
      },
    },
    {
      name: 'resolve-shipping-requirement',
      run: async context => {
        // The plan of the order combines the fulfilment policies of the
        // product types of its items, and the address rule of the order is
        // the shared rule of the shared layer: an order needs an address when
        // a policy of the order asks for one or when a line of the order
        // needs one. The default policy asks for an address, so an order of
        // a store that enables no fulfilment policy needs an address, exactly
        // as before.
        const policies = fulfillmentPlanFor(
          context.itemFulfillments.map((item) => item.productType),
        );
        const plan: OrderPlacementFulfillmentPlan = {
          ...policies,
          requiresShippingAddress: orderRequiresShippingAddress(policies, context.itemFulfillments),
        };
        context.fulfillmentPlan = plan;

        if (plan.requiresShippingAddress && !context.data.shippingAddress) {
          throw new ApiError('BAD_REQUEST');
        }

        if (context.normalizedShippingAddress) {
          await validateShippingAddress(context.normalizedShippingAddress);
        }
      },
    },
    {
      name: 'quote-order',
      run: async context => {
        const data = context.data;
        const plan = context.fulfillmentPlan;
        const address = context.normalizedShippingAddress;

        const quote = await CheckoutService.quoteItems(context.currency, context.orderItems.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPriceMinor: item.unitPriceMinor,
        })), {
          shippingAddress: {
            country: address?.country ?? '',
            state: address?.state,
            city: address?.city ?? '',
            postalCode: address?.postalCode,
            addressLine1: address?.addressLine1 ?? '',
            addressLine2: address?.addressLine2,
          },
          shippingOptionId: data.shippingOptionId,
        }, true, { requiresShippingQuote: plan.requiresShippingQuote });
        const selectedShipping = quote.shippingOptions.find((option) => option.id === data.shippingOptionId);
        if (plan.requiresShippingQuote && !selectedShipping) {
          throw new ApiError('SHIPPING_METHOD_UNAVAILABLE');
        }
        // The shipping amount is the answer of the shipping provider, so a
        // negative amount is a provider defect and never a price of the order.
        if (selectedShipping) assertNonNegativePluginAmount(selectedShipping.amountMinor, 'shipping');
        context.selectedShipping = selectedShipping ?? null;
        const payment = quote.paymentMethods.find((method) => method.providerSlug === data.paymentMethod);
        if (!payment) {
          throw new ApiError('PAYMENT_METHOD_UNAVAILABLE');
        }
      },
    },
    {
      name: 'describe-payment-method',
      run: async context => {
        let description: PaymentMethodDescription;
        try {
          description = await callContract(context.data.paymentMethod, 'payment', PLUGIN_CONTRACT_VERSIONS.payment, 'describe', { storeCurrency: context.currency }) as PaymentMethodDescription;
        } catch (error) {
          if (error instanceof ContractCallError) {
            throw new ApiError('PAYMENT_METHOD_UNAVAILABLE');
          }
          throw error;
        }
        if (!description.supportedCurrencies.includes(context.currency)) throw new ApiError('BAD_REQUEST');
        context.paymentMethodDescription = description;
      },
    },
    {
      name: 'calculate-tax',
      run: async context => {
        const address = context.normalizedShippingAddress;
        const taxProvider = await resolveSingleProvider('tax');
        const taxLines = context.orderItems.map((item, index) => ({ lineId: String(index), productId: item.productId, variantId: item.variantId, quantity: item.quantity, amountMinor: item.unitPriceMinor * item.quantity }));
        const shippingMinor = context.selectedShipping?.amountMinor ?? 0;
        context.shippingMinor = shippingMinor;
        let tax: TaxResult;
        if (taxProvider) {
          try {
            tax = await callContract(taxProvider.pluginSlug, 'tax', PLUGIN_CONTRACT_VERSIONS.tax, 'calculate', { currency: context.currency, lines: taxLines, shippingAmountMinor: shippingMinor, address: { country: address?.country ?? '', region: address?.state, city: address?.city ?? '', postalCode: address?.postalCode, line1: address?.addressLine1 ?? '', line2: address?.addressLine2 } }) as TaxResult;
          } catch (error) {
            // A tax provider that failed is not a store without a tax
            // provider: the tax of the order is unknown. The placement is
            // refused instead of charging an unknown tax, and the failure of
            // the provider is recorded for the operator.
            await excludeFailedProvider(taxProvider.pluginSlug, 'tax', error);
            throw new ApiError(taxProviderFailureCode(error));
          }
        } else {
          tax = { pricesIncludeTax: false, lines: taxLines.map((line) => ({ lineId: line.lineId, taxMinor: 0 })), totalTaxMinor: 0 };
        }
        // The tax amounts are the answer of the tax provider, so a negative
        // amount is a provider defect and never a tax of the order.
        assertNonNegativePluginAmount(tax.totalTaxMinor, 'tax');
        for (const line of tax.lines) assertNonNegativePluginAmount(line.taxMinor, 'tax');
        context.tax = tax;
      },
    },
    {
      name: 'compute-totals',
      run: async context => {
        // Every amount of the order is computed in the minor units of the
        // currency, so the total of the order is the exact total and the
        // expected total of the request is compared with it exactly.
        const subtotalMinor = context.totalMinor;
        const taxMinor = context.tax.pricesIncludeTax ? 0 : context.tax.totalTaxMinor;
        const totalMinor = subtotalMinor + context.shippingMinor + taxMinor;
        if (decimalToMinor(context.data.expectedTotal, context.currency) !== totalMinor) {
          throw new ApiError('QUOTE_CHANGED');
        }
        context.subtotalAmount = Number(minorToDecimal(subtotalMinor, context.currency));
        context.shippingAmount = Number(minorToDecimal(context.shippingMinor, context.currency));
        context.taxAmount = Number(minorToDecimal(context.tax.totalTaxMinor, context.currency));
        context.totalAmount = Number(minorToDecimal(totalMinor, context.currency));
      },
    },
    {
      name: 'compute-unpaid-expiry',
      run: async context => {
        context.unpaidExpiresAt = new Date(Date.now() + context.paymentMethodDescription.unpaidTimeoutMinutes * 60_000);
      },
    },
    {
      name: 'write-order',
      run: async context => {
        const { userId, data, currency } = context;
        let placement: { order: any; replayed: boolean };
        try {
          // Create order + deduct stock atomically
          placement = await prisma.$transaction(async (tx) => {
            const existing = await tx.order.findFirst({ where: { userId, idempotencyKey: context.idempotencyKey }, include: orderResponseInclude() });
            if (existing) {
              assertIdempotentReplay(existing, userId, context.requestFingerprint);
              return { order: existing, replayed: true };
            }
            const catalogMap = await ProductService.getSellableCatalog(tx, context.productIds);
            const created = await tx.order.create({
              data: {
                ...await allocateOrderNumber(tx),
                user: { connect: { id: userId } },
                customerEmail: data.customerEmail?.trim() || context.identity!.email,
                idempotencyKey: context.idempotencyKey,
                idempotencyFingerprint: context.requestFingerprint,
                status: OrderStatus.PENDING,
                paymentStatus: PaymentStatus.PENDING,
                subtotalAmount: context.subtotalAmount,
                shippingAmount: context.shippingAmount,
                shippingMethod: context.selectedShipping
                  ? {
                    providerSlug: context.selectedShipping.providerSlug,
                    optionId: data.shippingOptionId.split(':').slice(1).join(':'),
                    label: context.selectedShipping.label,
                    amountMinor: context.shippingMinor,
                  }
                  : null,
                taxAmount: context.taxAmount,
                taxInclusive: context.tax.pricesIncludeTax,
                totalAmount: context.totalAmount,
                // The order stores the currency its amounts are in. The payment
                // of the order is charged in that currency, so the stored
                // currency is the one the customer is charged in.
                currency: context.currency,
                paymentMethod: data.paymentMethod,
                unpaidExpiresAt: context.unpaidExpiresAt,
                // Create order address relation
                shippingAddress: data.shippingAddress
                  ? {
                    create: {
                      firstName: context.normalizedShippingAddress!.firstName.trim(),
                      lastName: context.normalizedShippingAddress!.lastName.trim(),
                      phone: context.normalizedShippingAddress!.phone?.trim(),
                      addressLine1: context.normalizedShippingAddress!.addressLine1.trim(),
                      addressLine2: context.normalizedShippingAddress!.addressLine2?.trim() || undefined,
                      city: context.normalizedShippingAddress!.city.trim(),
                      state: context.normalizedShippingAddress!.state?.trim() || '',
                      country: context.normalizedShippingAddress!.country.trim(),
                      postalCode: context.normalizedShippingAddress!.postalCode?.trim() || '',
                      email: context.normalizedShippingAddress!.email?.trim() || undefined,
                    }
                  }
                  : undefined,
                items: {
                  create: context.orderItems.map((item, index) => {
                    const product = catalogMap.get(item.productId);
                    const variant = product?.variants.find(variant => variant.id === item.variantId);
                    if (!product || !variant || !product.isActive || !variant.isActive) throw new ApiError('BAD_REQUEST');
                    return {
                      productId: item.productId,
                      variantId: item.variantId,
                      quantity: item.quantity,
                      // The line carries the exact amount of its price, so the
                      // line and the total of the order agree exactly.
                      unitPrice: Number(minorToDecimal(item.unitPriceMinor, currency)),
                      // The line stores the currency of its price, the same
                      // currency the order and its total are in.
                      currency: context.currency,
                      catalogSnapshot: createCatalogSnapshot({
                        id: product.id,
                        name: product.name,
                        productType: product.productType,
                        typeData: product.typeData as Prisma.JsonValue,
                        translations: product.translations,
                      }, {
                        id: variant.id,
                        name: variant.name,
                        skuCode: variant.skuCode,
                        attributes: variant.attributes as Prisma.JsonValue,
                      }),
                      lineTotal: new Prisma.Decimal(minorToDecimal(item.unitPriceMinor, currency)).mul(item.quantity),
                      taxAmount: Number(minorToDecimal(context.tax.lines.find((line) => line.lineId === String(index))?.taxMinor ?? 0, currency)),
                    };
                  })
                },
              },
              include: {
                shippingAddress: true,
                items: true
              }
            });

            if (data.pluginPurchaseOriginId) await bindPurchaseOrigin(tx, data.pluginPurchaseOriginId, userId, created.id);
            // The stock rows are deducted in the ascending order of their
            // variant id, the order every other writer of those rows takes:
            // the admin product path locks the variants of a product by
            // ascending id, so a deduction in the order of the cart could
            // hold a later variant and wait for an earlier one while the
            // admin path held the earlier one and waited for the later one.
            // Only the order of the deductions changes: the lines of the
            // order, their positions and the order items that are written
            // keep the order of the request.
            const stockDeductions = [...context.stockItems].sort((left, right) =>
              left.variantId < right.variantId ? -1 : left.variantId > right.variantId ? 1 : 0
            );
            for (const item of stockDeductions) {
              await InventoryService.decrementStock(tx, item.variantId, item.quantity, {
                type: 'sale',
                reason: 'order_placed',
                referenceId: created.id,
                userId,
                metadata: { orderNumber: created.orderNumber },
              });
            }
            await CartService.consumePurchasedItems(tx, userId, context.orderItems);

            await recordOrderStatusHistory(tx, {
              orderId: created.id,
              fromStatus: null,
              toStatus: created.status as PrismaOrderStatus,
              fromPaymentStatus: null,
              toPaymentStatus: created.paymentStatus as PrismaOrderPaymentStatus,
              actorType: 'user',
              actorId: userId,
              reason: 'order_created',
            });

            await emitEvent(tx, 'order.created', 1, created.id, {
              id: created.id,
              orderNumber: created.orderNumber,
              userId: created.userId,
              totalAmount: Number(created.totalAmount),
              currency,
              items: created.items.map((item: any) => ({
                id: item.id,
                productId: item.productId,
                variantId: item.variantId,
                quantity: item.quantity,
                unitPrice: Number(item.unitPrice),
                fulfillmentData: parseJsonRecord(item.fulfillmentData),
              }))
            });

            return { order: created, replayed: false };
          }, {
            // The placement writes the order, its lines, the stock and the
            // outbox events in one transaction, so it gets the explicit
            // bounds of the house style instead of the Prisma defaults.
            timeout: ORDER_PLACEMENT_TRANSACTION_TIMEOUT_MS,
            maxWait: ORDER_PLACEMENT_TRANSACTION_MAX_WAIT_MS,
          });
        } catch (error) {
          context.transactionFailed = true;
          context.transactionError = error;
          return;
        }
        context.result = placement;
        // The cached admin order list is stale after the write, so its version
        // is bumped here: after the transaction resolved, so a rollback keeps
        // the cache correct, and before a reader can repopulate it with the
        // state that the write replaced. A replayed request writes nothing,
        // so it leaves the cache alone. The bump names the placement it
        // belongs to, so an operator can find the order whose cached list
        // went stale.
        if (!placement.replayed) await CacheService.incrementOrderVersion({ scope: 'order.placement', reference: placement.order.id });
      },
    },
    {
      name: 'recover-idempotency-conflict',
      run: async context => {
        if (!context.transactionFailed) return;
        const error = context.transactionError;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          // A concurrent request with the same key won the unique index race.
          const replay = await findOrderByIdempotencyKey(
            context.idempotencyKey,
            context.userId,
            context.requestFingerprint,
          );
          if (replay) {
            context.result = { order: replay.order, replayed: true };
            return;
          }
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
          if (/order_items_(productId|variantId)_fkey/.test(String(error.meta?.field_name)) ||
              countCatalogVariants(context.catalog, context.orderItems) < new Set(context.orderItems.map(item => item.variantId)).size) {
            throw new ApiError('BAD_REQUEST');
          }
        }
        throw error;
      },
    },
  ];
}

/** The names of the stages of the order placement, in the order they run. */
export function orderPlacementStageNames(): string[] {
  return createOrderPlacementStages().map(stage => stage.name);
}

/** The context of a fresh order placement. */
function createOrderPlacementContext(userId: string, data: CreateOrderRequest): OrderPlacementContext {
  return {
    userId,
    data,
    identity: null,
    currency: '',
    idempotencyKey: '',
    requestFingerprint: '',
    productIds: [],
    catalog: new Map<string, CatalogProductProjection>(),
    orderItems: [],
    itemFulfillments: [],
    stockItems: [],
    fulfillmentPlan: {
      requiresShippingAddress: false,
      requiresShippingQuote: false,
      tracksInventory: false,
    },
    selectedShipping: null,
    paymentMethodDescription: { unpaidTimeoutMinutes: 0, supportedCurrencies: [] },
    shippingMinor: 0,
    tax: { pricesIncludeTax: false, lines: [], totalTaxMinor: 0 },
    totalMinor: 0,
    totalAmount: 0,
    subtotalAmount: 0,
    shippingAmount: 0,
    taxAmount: 0,
    unpaidExpiresAt: new Date(0),
    result: null,
    transactionFailed: false,
    transactionError: undefined,
    stopped: false,
  };
}

/**
 * Place an order: run the stages of the placement and return the order and
 * the currency and the locale of the account behind it.
 *
 * A stage that stops the pipeline ends the placement, so the idempotent
 * replay returns the original order before any provider work runs.
 */
export async function runOrderPlacement(userId: string, data: CreateOrderRequest): Promise<OrderPlacementOutcome> {
  const context = createOrderPlacementContext(userId, data);
  const stages = createOrderPlacementStages();
  try {
    for (const stage of stages) {
      await stage.run(context);
      if (context.stopped) break;
    }
  } catch (error) {
    // A bad amount is a validation failure of the request, not an internal
    // error: the placement answers it with the validation error of the
    // repository. The money module keeps its own diagnostic, the reason and
    // the detail of the amount it could not convert.
    if (error instanceof MoneyError) throw new ApiError('VALIDATION_ERROR');
    throw error;
  }
  const result = context.result!;
  return {
    order: result.order,
    replayed: result.replayed,
    currency: context.currency,
    locale: context.identity?.locale ?? null,
  };
}
