import { CartService } from '@/core/cart/service';
import { systemSettingsService } from '@/core/admin/system-settings/service';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';
import { decimalToMinor, minorToDecimal } from '@/core/payment/minor-units';

type Address = { country: string; state?: string; city?: string; postalCode?: string; addressLine1?: string; addressLine2?: string };

function contractAddress(address: Address) {
  return { country: address.country, region: address.state, city: address.city, postalCode: address.postalCode, line1: address.addressLine1, line2: address.addressLine2 };
}

export class CheckoutService {
  static async quote(userId: string, input: { shippingAddress: Address; shippingOptionId?: string }) {
    const [cart, currency] = await Promise.all([CartService.getCart(userId), systemSettingsService.getShopCurrency()]);
    if (!cart.items.length) throw new Error('Cart is empty');
    const items = cart.items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity, unitPriceMinor: decimalToMinor(item.price, currency) }));
    return this.quoteItems(currency, items, input);
  }

  static async quoteItems(
    currency: string,
    items: Array<{ productId: string; variantId: string; quantity: number; unitPriceMinor: number }>,
    input: { shippingAddress: Address; shippingOptionId?: string },
  ) {
    const subtotalMinor = items.reduce((total, item) => total + item.unitPriceMinor * item.quantity, 0);
    const shippingProviders = await PluginManagementService.listProviders('shipping');
    const shippingOptions = (await Promise.all(shippingProviders.map(async (provider) => {
      const result = await callContract(provider.pluginSlug, 'shipping', 1, 'quote', { currency, items, subtotalMinor, address: contractAddress(input.shippingAddress) }) as { options: Array<{ id: string; label: string; amountMinor: number; estimatedDays?: { min: number; max: number } }> };
      return result.options.map((option) => ({ id: `${provider.pluginSlug}:${option.id}`, providerSlug: provider.pluginSlug, label: option.label, amount: minorToDecimal(option.amountMinor, currency), amountMinor: option.amountMinor, estimatedDays: option.estimatedDays }));
    }))).flat();
    const paymentPackages = await PluginManagementService.getAllPluginPackages();
    const paymentMethods = (await Promise.all(paymentPackages.map(async (pkg) => {
      const instance = await PluginManagementService.getDefaultInstance(pkg.slug);
      if (!instance?.enabled || !Array.isArray((pkg.manifestJson as { contracts?: unknown[] }).contracts) || !(pkg.manifestJson as { contracts: Array<{ name: string; version: number }> }).contracts.some((contract) => contract.name === 'payment' && contract.version === 1)) return null;
      const description = await callContract(pkg.slug, 'payment', 1, 'describe', { storeCurrency: currency }) as { displayName: string; requiresManualConfirmation: boolean; supportedCurrencies: string[] };
      return description.supportedCurrencies.includes(currency) ? { providerSlug: pkg.slug, displayName: description.displayName, requiresManualConfirmation: description.requiresManualConfirmation } : null;
    }))).filter((method): method is NonNullable<typeof method> => method !== null);
    if (!input.shippingOptionId) return { currency, subtotal: minorToDecimal(subtotalMinor, currency), shippingOptions, paymentMethods };
    const selected = shippingOptions.find((option) => option.id === input.shippingOptionId);
    if (!selected) {
      const error = new Error('SHIPPING_OPTION_UNAVAILABLE') as Error & { statusCode?: number; code?: string };
      error.statusCode = 409;
      error.code = 'SHIPPING_OPTION_UNAVAILABLE';
      throw error;
    }
    const taxProvider = await PluginManagementService.resolveSingleProvider('tax');
    if (!taxProvider) return { currency, subtotal: minorToDecimal(subtotalMinor, currency), shippingOptions, paymentMethods, tax: '0', taxInclusive: false, total: minorToDecimal(subtotalMinor + selected.amountMinor, currency) };
    const lines = items.map((item, index) => ({ lineId: String(index), productId: item.productId, variantId: item.variantId, quantity: item.quantity, amountMinor: item.unitPriceMinor * item.quantity }));
    const tax = await callContract(taxProvider.pluginSlug, 'tax', 1, 'calculate', { currency, lines, shippingAmountMinor: selected.amountMinor, address: contractAddress(input.shippingAddress) }) as { totalTaxMinor: number; pricesIncludeTax: boolean };
    return { currency, subtotal: minorToDecimal(subtotalMinor, currency), shippingOptions, paymentMethods, tax: minorToDecimal(tax.totalTaxMinor, currency), taxInclusive: tax.pricesIncludeTax, total: minorToDecimal(subtotalMinor + selected.amountMinor + (tax.pricesIncludeTax ? 0 : tax.totalTaxMinor), currency) };
  }
}
