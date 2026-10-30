import { ApiError } from '@/utils/api-errors';
import { CartService } from '@/core/cart/service';
import { systemSettingsService } from '@/core/settings/service';
import { declaresContract, getAllPluginPackages, getDefaultInstance, listProviders, resolveSingleProvider } from '@/core/extensions/registry';
import { PLUGIN_CONTRACT_VERSIONS } from '@jiffoo/shared';
import { callContract } from '@/core/extensions/runtime/plugin-runtime';
import { ContractCallError } from '@/core/extensions/runtime/contract-errors';
import { recordPluginFailure } from '@/core/extensions/runtime/failure';
import { decimalToMinor, minorToDecimal, MoneyError } from '@/core/shared/money';
import { fulfillmentPlanFor, type FulfillmentPlan } from '@/core/shared/fulfillment-policy';

type Address = { country: string; state?: string; city?: string; postalCode?: string; addressLine1?: string; addressLine2?: string };

/** A line of a quote. */
type QuoteItem = { productId: string; variantId: string; quantity: number; unitPriceMinor: number };

/** A shipping option of a quote. */
type QuoteShippingOption = {
  id: string;
  providerSlug: string;
  label: string;
  amount: string;
  amountMinor: number;
  estimatedDays?: { min: number; max: number };
};

/** A payment method of a quote. */
type QuotePaymentMethod = { providerSlug: string; displayName: string; requiresManualConfirmation: boolean };

function contractAddress(address: Address) {
  return { country: address.country, region: address.state, city: address.city, postalCode: address.postalCode, line1: address.addressLine1, line2: address.addressLine2 };
}

function unavailableProvider(): never {
  throw new ContractCallError('CONTRACT_CALL_FAILED', 'Checkout provider is temporarily unavailable');
}

async function excludeFailedProvider(slug: string, error: unknown): Promise<void> {
  if (!(error instanceof ContractCallError)) throw error;
  if (error.code !== 'PLUGIN_DISABLED') await recordPluginFailure(slug, error, 'checkout');
  console.error(JSON.stringify({ event: 'checkout_provider_excluded', slug, reason: error.code }));
}

export class CheckoutService {
  /**
   * A bad amount is a validation failure of the request, not an internal
   * error: the quote answers it with the validation error of the repository.
   * The money module keeps its own diagnostic, the reason and the detail of
   * the amount it could not convert.
   */
  private static amount<T>(convert: () => T): T {
    try { return convert(); }
    catch (error) { if (error instanceof MoneyError) throw new ApiError('VALIDATION_ERROR'); throw error; }
  }

  static async quote(userId: string, input: { shippingAddress: Address; shippingOptionId?: string }) {
    const [cart, currency] = await Promise.all([CartService.getCart(userId), systemSettingsService.getShopCurrency()]);
    if (!cart.items.length) throw new ApiError('BAD_REQUEST');
    const items = cart.items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity, unitPriceMinor: this.amount(() => decimalToMinor(item.price, currency)) }));
    // The fulfilment plan of the cart comes from the product type of every
    // line, which the cart module projects. The quote of a cart that needs no
    // shipping quote offers no shipping option.
    const lines = await CartService.getLineFulfillments(userId);
    return this.quoteItems(currency, items, input, false, fulfillmentPlanFor(lines.map((line) => line.productType)));
  }

  static async quoteItems(
    currency: string,
    items: Array<{ productId: string; variantId: string; quantity: number; unitPriceMinor: number }>,
    input: { shippingAddress: Address; shippingOptionId?: string },
    allowUnavailableForOrder = false,
    plan?: Pick<FulfillmentPlan, 'requiresShippingQuote'>,
  ) {
    // Without a plan the quote needs a shipping quote, which is the behaviour
    // of a store that enables no fulfilment policy.
    const requiresShippingQuote = plan?.requiresShippingQuote ?? true;
    const subtotalMinor = items.reduce((total, item) => total + item.unitPriceMinor * item.quantity, 0);
    const shippingProviders = requiresShippingQuote ? await listProviders('shipping') : [];
    const failedShippingSlugs = new Set<string>();
    const shippingOptions = (await Promise.all(shippingProviders.map(async (provider) => {
      let result: { options: Array<{ id: string; label: string; amountMinor: number; estimatedDays?: { min: number; max: number } }> };
      try {
        result = await callContract(provider.pluginSlug, 'shipping', PLUGIN_CONTRACT_VERSIONS.shipping, 'quote', { currency, items, subtotalMinor, address: contractAddress(input.shippingAddress) }) as typeof result;
      } catch (error) {
        await excludeFailedProvider(provider.pluginSlug, error);
        failedShippingSlugs.add(provider.pluginSlug);
        return [];
      }
      return result.options.map((option) => ({ id: `${provider.pluginSlug}:${option.id}`, providerSlug: provider.pluginSlug, label: option.label, amount: this.amount(() => minorToDecimal(option.amountMinor, currency)), amountMinor: option.amountMinor, estimatedDays: option.estimatedDays }));
    }))).flat();
    const paymentPackages = await getAllPluginPackages();
    const paymentMethods = (await Promise.all(paymentPackages.map(async (pkg) => {
      const instance = await getDefaultInstance(pkg.slug);
      if (!instance?.enabled || !declaresContract(pkg.manifestJson, 'payment')) return null;
      let description: { displayName: string; requiresManualConfirmation: boolean; supportedCurrencies: string[] };
      try {
        description = await callContract(pkg.slug, 'payment', PLUGIN_CONTRACT_VERSIONS.payment, 'describe', { storeCurrency: currency }) as typeof description;
      } catch (error) {
        await excludeFailedProvider(pkg.slug, error);
        return null;
      }
      return description.supportedCurrencies.includes(currency) ? { providerSlug: pkg.slug, displayName: description.displayName, requiresManualConfirmation: description.requiresManualConfirmation } : null;
    }))).filter((method): method is NonNullable<typeof method> => method !== null);
    if (!allowUnavailableForOrder && ((requiresShippingQuote && !shippingOptions.length) || !paymentMethods.length)) unavailableProvider();
    // The tax provider is isolated for every caller, so the switch that
    // accepts an unavailable provider needs no tax branch of its own: a
    // failed tax provider never blocks a quote. The quote answers with an
    // unknown tax instead of a zero tax, and the order path refuses a
    // placement with an unknown tax.
    // A quote that needs no shipping quote offers no shipping option, so a
    // shipping option of the request is not resolved either. The quote still
    // carries the tax and the total the client can rely on: the tax does not
    // need a shipping option, and the order compares the expected total of
    // the request with the tax the order computes.
    if (!requiresShippingQuote) {
      return this.quoteWithTax(currency, items, input, shippingOptions, paymentMethods, 0);
    }
    if (!input.shippingOptionId) return { currency, subtotal: this.amount(() => minorToDecimal(subtotalMinor, currency)), shippingOptions, paymentMethods };
    const selected = shippingOptions.find((option) => option.id === input.shippingOptionId);
    if (!selected) {
      if (allowUnavailableForOrder && failedShippingSlugs.has(input.shippingOptionId.split(':')[0]))
        return { currency, subtotal: this.amount(() => minorToDecimal(subtotalMinor, currency)), shippingOptions, paymentMethods };
      throw new ApiError('SHIPPING_OPTION_UNAVAILABLE');
    }
    return this.quoteWithTax(currency, items, input, shippingOptions, paymentMethods, selected.amountMinor);
  }

  /**
   * The tax and the total of a quote.
   *
   * The tax of a quote does not need a shipping option, so a quote that
   * offers no shipping option carries the tax and the total as well. The
   * total is the amount the order of the quote computes, so a client can
   * send it as the expected total of the order.
   *
   * The tax provider is isolated like the shipping and the payment
   * providers: a tax provider whose contract call fails is excluded, its
   * failure is recorded, and the quote answers with an unknown tax instead
   * of failing as a whole. The quote never reports an unknown tax as the
   * zero tax of a store without a tax provider.
   */
  private static async quoteWithTax(
    currency: string,
    items: QuoteItem[],
    input: { shippingAddress: Address },
    shippingOptions: QuoteShippingOption[],
    paymentMethods: QuotePaymentMethod[],
    shippingMinor: number,
  ) {
    const subtotalMinor = items.reduce((total, item) => total + item.unitPriceMinor * item.quantity, 0);
    const taxProvider = await resolveSingleProvider('tax');
    if (!taxProvider) return { currency, subtotal: this.amount(() => minorToDecimal(subtotalMinor, currency)), shippingOptions, paymentMethods, tax: '0', taxInclusive: false, total: this.amount(() => minorToDecimal(subtotalMinor + shippingMinor, currency)) };
    const lines = items.map((item, index) => ({ lineId: String(index), productId: item.productId, variantId: item.variantId, quantity: item.quantity, amountMinor: item.unitPriceMinor * item.quantity }));
    let tax: { totalTaxMinor: number; pricesIncludeTax: boolean };
    try {
      tax = await callContract(taxProvider.pluginSlug, 'tax', PLUGIN_CONTRACT_VERSIONS.tax, 'calculate', { currency, lines, shippingAmountMinor: shippingMinor, address: contractAddress(input.shippingAddress) }) as { totalTaxMinor: number; pricesIncludeTax: boolean };
    } catch (error) {
      // A tax provider that failed is not a store without a tax provider: the
      // tax of the quote is unknown. The quote carries no tax and no total,
      // so it never charges an unknown tax, and it says that the tax
      // provider was unavailable. The order path refuses a placement with an
      // unknown tax.
      await excludeFailedProvider(taxProvider.pluginSlug, error);
      return { currency, subtotal: this.amount(() => minorToDecimal(subtotalMinor, currency)), shippingOptions, paymentMethods, taxUnavailable: true as const };
    }
    return { currency, subtotal: this.amount(() => minorToDecimal(subtotalMinor, currency)), shippingOptions, paymentMethods, tax: this.amount(() => minorToDecimal(tax.totalTaxMinor, currency)), taxInclusive: tax.pricesIncludeTax, total: this.amount(() => minorToDecimal(subtotalMinor + shippingMinor + (tax.pricesIncludeTax ? 0 : tax.totalTaxMinor), currency)) };
  }
}
