import type { Order } from './checkout-types';
import type { ProviderIds } from './storefront-providers';

export type PurchaseData = {
  id: string;
  totalAmount: number | string;
  shippingAmount: number | string;
  taxAmount: number | string;
  currency: string;
  items: Array<Pick<Order['items'][number], 'productId' | 'productName' | 'variantId' | 'unitPrice' | 'quantity'>>;
};

export function purchaseData(order: PurchaseData): PurchaseData {
  return {
    id: order.id, totalAmount: Number(order.totalAmount), shippingAmount: Number(order.shippingAmount),
    taxAmount: Number(order.taxAmount), currency: order.currency,
    items: order.items.map(({ productId, productName, variantId, unitPrice, quantity }) => ({
      productId, productName, ...(variantId ? { variantId } : {}), unitPrice: Number(unitPrice), quantity,
    })),
  };
}

export function purchaseCommands(order: PurchaseData) {
  const value = Number(order.totalAmount);
  return {
    ga4: ['event', 'purchase', {
      transaction_id: order.id, value, currency: order.currency,
      shipping: Number(order.shippingAmount), tax: Number(order.taxAmount),
      items: order.items.map((item) => ({
        item_id: item.productId, item_name: item.productName,
        ...(item.variantId ? { item_variant: item.variantId } : {}),
        price: Number(item.unitPrice), quantity: item.quantity,
      })),
    }],
    meta: ['track', 'Purchase', {
      value, currency: order.currency, content_type: 'product',
      content_ids: order.items.map((item) => item.productId),
      contents: order.items.map((item) => ({ id: item.productId, quantity: item.quantity })),
      num_items: order.items.reduce((total, item) => total + item.quantity, 0),
    }, { eventID: `purchase-${order.id}` }],
    baidu: ['_trackOrder', {
      orderId: order.id, orderTotal: value,
      item: order.items.map((item) => ({
        skuId: item.variantId || item.productId, skuName: item.productName,
        Price: Number(item.unitPrice), Quantity: item.quantity,
      })),
    }],
  };
}

type TrackingState = {
  claimedDocument: boolean;
  ready: Promise<ProviderIds>;
  initialized: (ids: ProviderIds) => void;
};
type TrackingDocument = Document & { jiffooPurchaseTracking?: TrackingState };

export function documentTracking(): TrackingState {
  const target = document as TrackingDocument;
  if (!target.jiffooPurchaseTracking) {
    let initialized!: (ids: ProviderIds) => void;
    const ready = new Promise<ProviderIds>((resolve) => { initialized = resolve; });
    target.jiffooPurchaseTracking = { claimedDocument: false, ready, initialized };
  }
  return target.jiffooPurchaseTracking;
}

export function sendPurchase(order: PurchaseData, ids: ProviderIds) {
  const commands = purchaseCommands(order);
  const target = window as Window & {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    _hmt?: unknown[][];
  };
  if (ids.ga4MeasurementId) target.gtag?.(...commands.ga4);
  if (ids.metaPixelId) target.fbq?.(...commands.meta);
  if (ids.baiduSiteKey) target._hmt?.push(commands.baidu);
}
