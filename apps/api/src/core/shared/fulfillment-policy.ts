/**
 * Fulfilment policy of a product type.
 *
 * The policy answers how a product type is fulfilled: whether an order of
 * that type needs a shipping address, whether it needs a shipping quote and
 * whether its stock is tracked. A product type without a registered policy
 * uses the default policy, which is the behaviour of a physical product: it
 * needs a shipping address, it needs a shipping quote and its stock is
 * tracked.
 *
 * The registry is the only module scope state of this module: it holds the
 * policies of the product types of the installation. It never holds request
 * data, only the policy flags of a product type.
 */

export interface FulfillmentPolicy {
  /** The order of this product type needs a shipping address. */
  requiresShippingAddress: boolean;
  /** The order of this product type needs a shipping quote and a shipping option. */
  requiresShippingQuote: boolean;
  /** The stock of this product type is tracked and decremented when it is sold. */
  tracksInventory: boolean;
}

/** The policies registered per product type. */
const policies = new Map<string, FulfillmentPolicy>();

/**
 * The policy of a product type without a registered policy.
 *
 * It is the behaviour of the physical products: a shipping address, a
 * shipping quote and tracked stock.
 */
export function defaultFulfillmentPolicy(): FulfillmentPolicy {
  return { requiresShippingAddress: true, requiresShippingQuote: true, tracksInventory: true };
}

/** The policy of a product type, the default one when it has no registered policy. */
export function fulfillmentPolicyFor(productType: string): FulfillmentPolicy {
  const policy = policies.get(productType);
  return policy ? { ...policy } : defaultFulfillmentPolicy();
}

/**
 * Register the policy of a product type.
 *
 * A product type is a non empty name and a policy carries the three boolean
 * flags of the fulfilment; anything else is a programming error and is
 * rejected before the registry changes.
 */
export function registerFulfillmentPolicy(productType: string, policy: FulfillmentPolicy): void {
  if (typeof productType !== 'string' || productType.trim().length === 0) {
    throw new TypeError('A fulfilment policy needs a product type');
  }
  if (!policy || typeof policy !== 'object'
    || typeof policy.requiresShippingAddress !== 'boolean'
    || typeof policy.requiresShippingQuote !== 'boolean'
    || typeof policy.tracksInventory !== 'boolean') {
    throw new TypeError(
      `The fulfilment policy of "${productType}" needs the boolean flags requiresShippingAddress, requiresShippingQuote and tracksInventory`,
    );
  }
  policies.set(productType, {
    requiresShippingAddress: policy.requiresShippingAddress,
    requiresShippingQuote: policy.requiresShippingQuote,
    tracksInventory: policy.tracksInventory,
  });
}

/** The product types with a registered policy. */
export function registeredFulfillmentPolicyTypes(): string[] {
  return [...policies.keys()];
}
