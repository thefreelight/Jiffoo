import type { ShopLocale } from './locale';

export type CartLine = {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  productImage: string;
  variantName?: string;
  variantAttributes?: Record<string, unknown> | null;
  /** The exact price of the line, as the exact decimal string of the API. */
  price: string | number;
  quantity: number;
  maxQuantity: number;
  /** The exact amount of the line, as the exact decimal string of the API. */
  subtotal: string | number;
};

export type Cart = {
  items: CartLine[];
  itemCount: number;
  /** The exact amount of the cart, as the exact decimal string of the API. */
  subtotal: string | number;
};

export function variantText(line: CartLine) {
  return line.variantAttributes && Object.keys(line.variantAttributes).length
    ? Object.entries(line.variantAttributes).map(([key, value]) => `${key}: ${String(value)}`).join(' / ')
    : line.variantName;
}

export type Address = {
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type SavedAddress = { [Field in keyof Address]?: string | null } & { company?: string | null };

export function addressFormValues(address: SavedAddress | null): Address {
  return {
    firstName: address?.firstName ?? '', lastName: address?.lastName ?? '', phone: address?.phone ?? '',
    addressLine1: address?.addressLine1 ?? '', addressLine2: address?.addressLine2 ?? '',
    city: address?.city ?? '', state: address?.state ?? '', postalCode: address?.postalCode ?? '', country: address?.country ?? '',
  };
}

export function addressRequest(values: Address) {
  const { addressLine2, state, postalCode, ...required } = values;
  return {
    ...Object.fromEntries(Object.entries(required).map(([key, value]) => [key, value.trim()])),
    ...(addressLine2.trim() ? { addressLine2: addressLine2.trim() } : {}),
    ...(state.trim() ? { state: state.trim() } : {}),
    ...(postalCode.trim() ? { postalCode: postalCode.trim() } : {}),
  };
}

export type Quote = {
  currency: string;
  subtotal: string;
  shippingOptions: Array<{ id: string; label: string; amount: string }>;
  paymentMethods: Array<{ providerSlug: string; displayName: string }>;
  tax?: string;
  taxInclusive?: boolean;
  total?: string;
};

export type Order = {
  pluginReturnTarget?: { path: string; title: Record<ShopLocale, string> };
  orderNumber: string;
  id: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  paymentInstructions: string | null;
  paymentSessionId: string | null;
  paymentId?: string | null;
  paymentAttemptState?: string | null;
  refundRequired?: boolean;
  items: Array<{ id: string; productId: string; variantId?: string | null; productName: string; productImages?: string[]; variantName?: string; unitPrice: number | string; quantity: number; totalPrice: number }>;
  shippingAddress: SavedAddress | null;
  currency: string;
  subtotalAmount: number;
  shippingAmount: number;
  taxAmount: number;
  taxInclusive: boolean;
  totalAmount: number;
  shippingMethod: { label: string } | null;
  shipments: Array<{ id: string; carrier: string | null; trackingNumber: string | null }>;
  cancelReason: string | null;
  cancelledAt: string | null;
  unpaidExpiresAt: string | null;
};
