import { ApiError } from '@/utils/api-errors';
import { prisma } from '@/config/database';
import {
  Prisma,
  OrderStatus as PrismaOrderStatus,
  OrderPaymentStatus as PrismaOrderPaymentStatus,
} from '@prisma/client';
import { PLUGIN_CONTRACT_VERSIONS } from '@jiffoo/shared';
import { CartService } from '@/core/cart/service';
import { CheckoutService } from '@/core/checkout/service';
import { ProductService, type CatalogProductProjection } from '@/core/product/service';
import { InventoryService } from '@/core/inventory/service';
import { systemSettingsService } from '@/core/settings/service';
import { AuthIdentityService } from '@/core/auth/identity-service';
import { emitEvent } from '@/infra/events/emit';
import { resolveSingleProvider } from '@/core/extensions/registry';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';
import { ContractCallError } from '@/core/extensions/runtime/contract-errors';
import { bindPurchaseOrigin } from '@/core/plugin-pages/service';
import { decimalToMinor, minorToDecimal } from '@/core/shared/money';
import { currentLinePrice } from '@/core/shared/pricing';
import { fulfillmentPolicyFor, type FulfillmentPolicy } from '@/core/shared/fulfillment-policy';
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

/** A line of the order, as it is placed. */
type OrderItemDraft = {
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
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
  requiresShippingAddress: boolean;
  requiresShippingQuote: boolean;
  tracksInventory: boolean;
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
  itemPolicies: FulfillmentPolicy[];
  requiresShipping: boolean;
  stockItems: StockItem[];
  fulfillmentPlan: OrderPlacementFulfillmentPlan;
  selectedShipping: ShippingOption | null;
  paymentMethodDescription: PaymentMethodDescription;
  shippingMinor: number;
  tax: TaxResult;
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
 */
async function findOrderByIdempotencyKey(
  idempotencyKey: string,
  userId: string,
  requestFingerprint: string,
): Promise<{ order: any; replayed: true } | null> {
  const existing = await prisma.order.findUnique({ where: { idempotencyKey }, include: orderResponseInclude() });
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
        let totalAmount = 0;
        const orderItems: OrderItemDraft[] = [];
        const itemPolicies: FulfillmentPolicy[] = [];
        const stockItems: StockItem[] = [];
        let requiresOrderShipping = false;

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
          if (product.requiresShipping) {
            requiresOrderShipping = true;
          }

          const unitPrice = currentLinePrice(variant, context.currency).unitPrice;
          const requestedQuantity = requestedQuantityByVariant.get(variantId) ?? item.quantity;
          const stock = variant.stock;

          if (stock < requestedQuantity) {
            throw Object.assign(new ApiError('BAD_REQUEST'), { message: `Insufficient stock for variant ${variant.name} of product: ${product.name}` });
          }

          totalAmount += unitPrice * item.quantity;
          orderItems.push({
            productId: item.productId,
            variantId,
            quantity: item.quantity,
            unitPrice,
          });
          itemPolicies.push(policy);
          if (policy.tracksInventory) {
            stockItems.push({ variantId, quantity: item.quantity });
          }
        }

        context.orderItems = orderItems;
        context.itemPolicies = itemPolicies;
        context.stockItems = stockItems;
        context.requiresShipping = requiresOrderShipping;
        context.totalAmount = totalAmount;
      },
    },
    {
      name: 'resolve-shipping-requirement',
      run: async context => {
        // The plan of the order combines the shipping flag of its items with
        // the fulfilment policy of their product types.
        const policies = context.itemPolicies;
        const plan: OrderPlacementFulfillmentPlan = {
          requiresShippingAddress: context.requiresShipping && policies.some(policy => policy.requiresShippingAddress),
          requiresShippingQuote: policies.some(policy => policy.requiresShippingQuote),
          tracksInventory: policies.some(policy => policy.tracksInventory),
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

        if (plan.requiresShippingQuote && !address) throw new ApiError('BAD_REQUEST');

        const quote = await CheckoutService.quoteItems(context.currency, context.orderItems.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPriceMinor: decimalToMinor(item.unitPrice, context.currency),
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
        }, true);
        const selectedShipping = quote.shippingOptions.find((option) => option.id === data.shippingOptionId);
        if (plan.requiresShippingQuote && !selectedShipping) {
          throw new ApiError('SHIPPING_METHOD_UNAVAILABLE');
        }
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
        const taxLines = context.orderItems.map((item, index) => ({ lineId: String(index), productId: item.productId, variantId: item.variantId, quantity: item.quantity, amountMinor: decimalToMinor(item.unitPrice * item.quantity, context.currency) }));
        const shippingMinor = context.selectedShipping?.amountMinor ?? 0;
        context.shippingMinor = shippingMinor;
        const tax = taxProvider
          ? await callContract(taxProvider.pluginSlug, 'tax', PLUGIN_CONTRACT_VERSIONS.tax, 'calculate', { currency: context.currency, lines: taxLines, shippingAmountMinor: shippingMinor, address: { country: address?.country ?? '', region: address?.state, city: address?.city ?? '', postalCode: address?.postalCode, line1: address?.addressLine1 ?? '', line2: address?.addressLine2 } }) as TaxResult
          : { pricesIncludeTax: false, lines: taxLines.map((line) => ({ lineId: line.lineId, taxMinor: 0 })), totalTaxMinor: 0 };
        context.tax = tax;
      },
    },
    {
      name: 'compute-totals',
      run: async context => {
        const subtotalAmount = context.totalAmount;
        const shippingAmount = Number(minorToDecimal(context.shippingMinor, context.currency));
        const taxAmount = Number(minorToDecimal(context.tax.totalTaxMinor, context.currency));
        context.totalAmount = subtotalAmount + shippingAmount + (context.tax.pricesIncludeTax ? 0 : taxAmount);
        if (decimalToMinor(context.data.expectedTotal, context.currency) !==
          decimalToMinor(subtotalAmount, context.currency) + context.shippingMinor + (context.tax.pricesIncludeTax ? 0 : context.tax.totalTaxMinor)) {
          throw new ApiError('QUOTE_CHANGED');
        }
        context.subtotalAmount = subtotalAmount;
        context.shippingAmount = shippingAmount;
        context.taxAmount = taxAmount;
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
        try {
          // Create order + deduct stock atomically
          context.result = await prisma.$transaction(async (tx) => {
            const existing = await tx.order.findUnique({ where: { idempotencyKey: context.idempotencyKey }, include: orderResponseInclude() });
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
                      unitPrice: item.unitPrice,
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
                      lineTotal: new Prisma.Decimal(item.unitPrice).mul(item.quantity),
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
            for (const item of context.stockItems) {
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
          });
        } catch (error) {
          context.transactionFailed = true;
          context.transactionError = error;
        }
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
    itemPolicies: [],
    requiresShipping: false,
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
  for (const stage of stages) {
    await stage.run(context);
    if (context.stopped) break;
  }
  const result = context.result!;
  return {
    order: result.order,
    replayed: result.replayed,
    currency: context.currency,
    locale: context.identity?.locale ?? null,
  };
}
