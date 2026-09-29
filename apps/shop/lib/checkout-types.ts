export type CartLine = {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  variantName?: string;
  price: number;
  quantity: number;
  maxQuantity: number;
  subtotal: number;
};

export type Cart = {
  items: CartLine[];
  itemCount: number;
  subtotal: number;
};

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
  id: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  paymentInstructions: string | null;
  paymentSessionId: string | null;
  items: Array<{ id: string; productId: string; variantId?: string | null; productName: string; variantName?: string; unitPrice: number | string; quantity: number; totalPrice: number }>;
  shippingAddress: Address | null;
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
