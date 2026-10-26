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
 * This module is the single source of the fulfilment rules. The cart, the
 * checkout and the order read the rules from here, so they answer the same
 * fulfilment question the same way:
 *
 * - The stock of a line: a line of a product type whose policy tracks the
 *   inventory is limited by the stock of its variant and its stock is
 *   decremented when it is sold. A line of a product type whose policy does
 *   not track the inventory is not limited by the stock of its variant and
 *   its stock is not decremented.
 * - The address of a line: a line needs a shipping address when the product
 *   asks for shipping and the policy of its product type asks for an
 *   address. The product flag can only veto the policy, never add to it: a
 *   product whose requiresShipping flag is still true asks for an address
 *   under a policy that asks for an address, and a policy that does not ask
 *   for an address vetoes the line, so the line of a product type without an
 *   address needs none.
 * - The address of an order: an order needs a shipping address when a
 *   policy of the order asks for one or when a line of the order needs one.
 *   The default policy of every product type asks for an address, so an
 *   order of a store that enables no policy always needs one.
 *
 * The rules above are the rules that are implemented; the cart line and the
 * order answer two different questions, the address of one line and the
 * address of the whole order, so they can differ: an order of a store that
 * enables no policy needs an address even when none of its lines needs one.
 *
 * The registry is the only module scope state of this module: it holds the
 * policies of the product types of the installation. It never holds request
 * data, only the policy flags of a product type.
 *
 * The catalogue of the policies the Core knows is built inside a function
 * body, so the module holds no other container. A store selects the policies
 * of its product types through the store settings, and the settings module
 * applies that selection to the registry, so the registry of a running
 * process holds the selection of the store. A store that selects nothing
 * keeps the default policy of every product type.
 */

export interface FulfillmentPolicy {
  /** The order of this product type needs a shipping address. */
  requiresShippingAddress: boolean;
  /** The order of this product type needs a shipping quote and a shipping option. */
  requiresShippingQuote: boolean;
  /** The stock of this product type is tracked and decremented when it is sold. */
  tracksInventory: boolean;
}

/**
 * The plan of a set of product types: the combination of their policies.
 *
 * The plan is the single place where the fulfilment rules of several product
 * types meet, so the cart, the checkout and the order read the fulfilment of
 * an order from the same rules.
 */
export type FulfillmentPlan = {
  /** The order needs a shipping address. */
  requiresShippingAddress: boolean;
  /** The order needs a shipping quote and a shipping option. */
  requiresShippingQuote: boolean;
  /** The stock of the order is tracked and decremented when it is sold. */
  tracksInventory: boolean;
};

/**
 * The stock ceiling of a line whose product type does not track inventory.
 *
 * A product type that does not track its inventory has no stock ceiling: the
 * quantity of such a line is not limited by the stock of its variant. The
 * value is a large finite integer, so the ceiling of such a line is a number
 * the client can rely on and never null.
 */
export const UNTRACKED_INVENTORY_QUANTITY = 1_000_000;

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

/**
 * Remove every registered policy.
 *
 * The registry is a process global, so a test or a shutdown path resets it
 * with this function; the default policy applies again to every product type.
 */
export function clearFulfillmentPolicies(): void {
  policies.clear();
}

/** One entry of the catalogue of the fulfilment policies the Core knows. */
export type FulfillmentPolicyCatalogEntry = {
  /** The name of the policy, the value a store selects for a product type. */
  name: string;
  /** The product type the policy describes. */
  productType: string;
  /** The flags of the policy. */
  policy: FulfillmentPolicy;
};

/**
 * The catalogue of the fulfilment policies the Core knows.
 *
 * The catalogue holds the physical policy, which is the default policy of
 * every product type without a registered policy, and the digital policy,
 * which is the fulfilment of a product that is delivered without a shipment.
 *
 * The catalogue is built inside the function body, so the module keeps no
 * module scope container besides the registry.
 */
export function builtinFulfillmentPolicies(): FulfillmentPolicyCatalogEntry[] {
  return [
    { name: 'physical', productType: 'physical', policy: defaultFulfillmentPolicy() },
    {
      name: 'digital',
      productType: 'digital',
      policy: { requiresShippingAddress: false, requiresShippingQuote: false, tracksInventory: false },
    },
  ];
}

/**
 * The selection of a store: the policy of a product type, by product type.
 *
 * The value of the store setting `fulfillment.policies`, for example
 * `{ "digital": "digital" }`.
 */
export type FulfillmentPolicySelection = Record<string, string>;

/**
 * Validate a fulfilment policy selection.
 *
 * A selection names a product type of the catalogue and a policy of the
 * catalogue for it. An unknown product type or an unknown policy is a
 * programming or configuration error and is rejected before the registry
 * changes.
 */
export function assertFulfillmentPolicySelection(selection: unknown): FulfillmentPolicySelection {
  const catalogue = builtinFulfillmentPolicies();
  const knownProductTypes = new Set(catalogue.map(entry => entry.productType));
  const knownPolicies = new Set(catalogue.map(entry => entry.name));

  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) {
    throw new TypeError('A fulfilment policy selection needs an object of product type and policy name');
  }

  const entries = Object.entries(selection as Record<string, unknown>);
  for (const [productType, policyName] of entries) {
    if (!knownProductTypes.has(productType)) {
      throw new TypeError(`Unknown fulfilment product type "${productType}"`);
    }
    if (typeof policyName !== 'string' || !knownPolicies.has(policyName)) {
      throw new TypeError(`Unknown fulfilment policy "${String(policyName)}" of the product type "${productType}"`);
    }
  }

  return Object.fromEntries(entries) as FulfillmentPolicySelection;
}

/**
 * Apply a selection of the catalogue to the registry.
 *
 * The registry is replaced by the selected entries: the policy of a selected
 * product type becomes the policy of the catalogue entry the selection names.
 * A selection that names an unknown product type or an unknown policy is
 * rejected before the registry changes, so the registry never holds a
 * half applied selection.
 */
export function applyFulfillmentPolicySelection(selection: unknown): void {
  const catalogue = builtinFulfillmentPolicies();
  const validated = assertFulfillmentPolicySelection(selection);
  const entries: Array<[string, FulfillmentPolicy]> = [];

  for (const [productType, name] of Object.entries(validated)) {
    const entry = catalogue.find(candidate => candidate.name === name);
    if (!entry) throw new TypeError(`Unknown fulfilment policy "${name}" of the product type "${productType}"`);
    entries.push([productType, entry.policy]);
  }

  clearFulfillmentPolicies();
  for (const [productType, policy] of entries) registerFulfillmentPolicy(productType, policy);
}

/**
 * The fulfilment plan of the given product types.
 *
 * The plan combines the policies of the product types: the order needs a
 * shipping address and a shipping quote when a policy of the product types
 * asks for them, and its stock is tracked when a policy of them tracks it.
 *
 * The plan of no product type at all is the default plan, which is the
 * conservative answer: a plan that is not known asks for a shipping address,
 * a shipping quote and tracked stock.
 */
export function fulfillmentPlanFor(productTypes: string[]): FulfillmentPlan {
  if (productTypes.length === 0) return defaultFulfillmentPolicy();
  const policiesOfTypes = productTypes.map(productType => fulfillmentPolicyFor(productType));
  return {
    requiresShippingAddress: policiesOfTypes.some(policy => policy.requiresShippingAddress),
    requiresShippingQuote: policiesOfTypes.some(policy => policy.requiresShippingQuote),
    tracksInventory: policiesOfTypes.some(policy => policy.tracksInventory),
  };
}

/**
 * The stock ceiling of a line.
 *
 * The ceiling of a line of a product type whose policy tracks the inventory
 * is the stock of the variant. The ceiling of a line of a product type whose
 * policy does not track the inventory is
 * {@link UNTRACKED_INVENTORY_QUANTITY}: such a line is not limited by the
 * stock of its variant, because its stock is not tracked.
 */
export function stockCeilingFor(productType: string, stock: number): number {
  return fulfillmentPolicyFor(productType).tracksInventory ? stock : UNTRACKED_INVENTORY_QUANTITY;
}

/**
 * The address rule of a line.
 *
 * A line needs a shipping address when the product asks for shipping and the
 * policy of its product type asks for an address. The product flag can only
 * veto the policy: a product whose requiresShipping flag is still true asks
 * for an address under a policy that asks for an address, and a policy that
 * does not ask for an address vetoes the line.
 */
export function lineRequiresShippingAddress(productType: string, productRequiresShipping: boolean): boolean {
  return productRequiresShipping && fulfillmentPolicyFor(productType).requiresShippingAddress;
}

/** A line of an order, as the address rule of the order sees it. */
export type FulfillmentAddressLine = {
  /** The product type of the line, the key of the fulfilment policy. */
  productType: string;
  /** The product of the line asks for shipping. */
  requiresShipping: boolean;
};

/**
 * The address rule of an order.
 *
 * An order needs a shipping address when a policy of the order asks for one
 * or when a line of the order needs one. Under the default policy every
 * product type asks for an address, so an order of a store that enables no
 * policy always needs one.
 */
export function orderRequiresShippingAddress(plan: FulfillmentPlan, lines: FulfillmentAddressLine[]): boolean {
  return plan.requiresShippingAddress
    || lines.some(line => lineRequiresShippingAddress(line.productType, line.requiresShipping));
}
