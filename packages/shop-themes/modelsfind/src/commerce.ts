import type { Cart } from 'shared/src/types/cart';

interface AddressLike {
  addressLine1?: string;
  address?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
}

export function formatMoneyPrecise(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return 'Unknown';
  }

  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatOrderId(id: string): string {
  return id.slice(-8).toUpperCase();
}

export function humanizeStatus(status?: string | null): string {
  if (!status) {
    return 'Pending';
  }

  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getStatusClasses(status?: string | null): string {
  switch ((status || '').toLowerCase()) {
    case 'pending':
      return 'border-yellow-500/20 bg-yellow-500/10 text-yellow-100';
    case 'processing':
    case 'paid':
      return 'border-blue-500/20 bg-blue-500/10 text-blue-100';
    case 'completed':
    case 'delivered':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100';
    case 'shipped':
      return 'border-violet-500/20 bg-violet-500/10 text-violet-100';
    case 'cancelled':
      return 'border-red-500/20 bg-red-500/10 text-red-100';
    default:
      return 'border-white/10 bg-white/5 text-[var(--modelsfind-copy)]';
  }
}

export function summarizeAddress(address?: AddressLike | null): string {
  if (!address) {
    return 'Address provided during checkout';
  }

  const line = address.addressLine1 || address.address || address.street || '';
  const city = address.city || '';
  const region = address.state || '';
  const country = address.country || '';

  return [line, city, region, country].filter(Boolean).join(', ') || 'Address provided during checkout';
}

export function getCartSelection(
  cart: Cart,
  selectedItemIds?: string[],
  fallbackToAll = true
) {
  const selectedIds =
    selectedItemIds !== undefined ? selectedItemIds : fallbackToAll ? cart.items.map((item) => item.id) : [];
  const selectedSet = new Set(selectedIds);
  const selectedItems = cart.items.filter((item) => selectedSet.has(item.id));
  const selectedSubtotal = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const ratio = cart.subtotal > 0 ? selectedSubtotal / cart.subtotal : 0;

  return {
    selectedIds,
    selectedSet,
    selectedItems,
    selectedSubtotal,
    selectedTax: Number(((cart.tax || 0) * ratio).toFixed(2)),
    selectedShipping: Number(((cart.shipping || 0) * ratio).toFixed(2)),
    selectedDiscount: Number(((cart.discount || 0) * ratio).toFixed(2)),
  };
}
