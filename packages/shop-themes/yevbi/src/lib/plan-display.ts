import type { Product } from '../types';

export interface PlanDisplay {
  title: string;
  destination: string;
  city: string;
  country: string;
  region: string;
  data: string;
  validity: string;
  network: string;
  badge: string;
  summary: string;
  image: string;
  priceLabel: string;
  accent: string;
  background: string;
}

export const POPULAR_DESTINATIONS: PlanDisplay[] = [
  {
    title: 'Tokyo',
    destination: 'Tokyo',
    city: 'Tokyo',
    country: 'Japan',
    region: 'Japan',
    data: '5GB',
    validity: '15 days',
    network: 'High speed data',
    badge: 'Best seller',
    summary: 'Instant QR delivery for Tokyo, Osaka, and beyond.',
    image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=900&q=82',
    priceLabel: '$4.50 USD',
    accent: '#176bff',
    background: 'from-blue-50 to-white',
  },
  {
    title: 'Lisbon',
    destination: 'Lisbon',
    city: 'Lisbon',
    country: 'Portugal',
    region: 'Portugal',
    data: '3GB',
    validity: '7 days',
    network: 'Instant QR delivery',
    badge: 'City pick',
    summary: 'A calm plan for Lisbon weekends and Portugal stays.',
    image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=900&q=82',
    priceLabel: '$3.90 USD',
    accent: '#176bff',
    background: 'from-sky-50 to-white',
  },
  {
    title: 'Seoul',
    destination: 'Seoul',
    city: 'Seoul',
    country: 'South Korea',
    region: 'South Korea',
    data: '5GB',
    validity: '15 days',
    network: '5G ready',
    badge: 'Fast setup',
    summary: 'Reliable travel data across Seoul and major Korean cities.',
    image: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=900&q=82',
    priceLabel: '$4.80 USD',
    accent: '#176bff',
    background: 'from-indigo-50 to-white',
  },
  {
    title: 'Paris',
    destination: 'Paris',
    city: 'Paris',
    country: 'France',
    region: 'France',
    data: '3GB',
    validity: '15 days',
    network: 'Instant QR delivery',
    badge: 'Popular',
    summary: 'Simple data for France with coverage across Europe.',
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=82',
    priceLabel: '$4.20 USD',
    accent: '#176bff',
    background: 'from-blue-50 to-white',
  },
];

export const FEATURED_PLANS: PlanDisplay[] = [
  {
    ...POPULAR_DESTINATIONS[0],
    title: 'Japan',
    destination: 'Japan',
    region: 'Japan',
    data: '5GB',
    validity: '15 days',
    summary: 'High speed data with instant QR delivery.',
    priceLabel: '$4.50 USD',
    badge: 'Most popular',
  },
  {
    ...POPULAR_DESTINATIONS[1],
    title: 'Europe Regional',
    destination: 'Europe Regional',
    city: 'Europe',
    country: '35 countries',
    region: '35 countries',
    data: '10GB',
    validity: '30 days',
    summary: 'Use one plan across 35 countries.',
    priceLabel: '$24.90 USD',
    badge: 'Great value',
  },
  {
    ...POPULAR_DESTINATIONS[2],
    title: 'United States',
    destination: 'United States',
    city: 'United States',
    country: 'Nationwide',
    region: 'United States',
    data: '5GB',
    validity: '15 days',
    summary: 'Nationwide coverage with quick activation.',
    priceLabel: '$6.90 USD',
    badge: 'Fast setup',
  },
  {
    ...POPULAR_DESTINATIONS[3],
    title: 'Global 126',
    destination: 'Global 126',
    city: 'Global',
    country: '126 countries',
    region: '126 countries',
    data: '3GB',
    validity: '30 days',
    summary: 'Flexible coverage for multi-country trips.',
    priceLabel: '$29.90 USD',
    badge: 'Global',
  },
];

export const RECENTLY_VIEWED: PlanDisplay[] = [
  POPULAR_DESTINATIONS[3],
  {
    ...FEATURED_PLANS[2],
    title: 'New York',
    destination: 'New York',
    city: 'New York',
    country: 'United States',
    image: 'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=900&q=82',
  },
  {
    ...POPULAR_DESTINATIONS[1],
    title: 'Bangkok',
    destination: 'Bangkok',
    city: 'Bangkok',
    country: 'Thailand',
    image: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=900&q=82',
    priceLabel: '$3.90 USD',
  },
  {
    ...FEATURED_PLANS[3],
    title: 'Dubai',
    destination: 'Dubai',
    city: 'Dubai',
    country: 'UAE',
    image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=900&q=82',
    priceLabel: '$8.90 USD',
  },
];

function hashString(value: string): number {
  return value.split('').reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function getCategoryName(product: Product): string {
  const category = product.category as Product['category'] | string | undefined;
  if (!category) return '';
  return typeof category === 'string' ? category : category.name || category.slug || '';
}

function getTags(product: Product): string[] {
  return Array.isArray(product.tags) ? product.tags : [];
}

function getImage(product: Product, fallback: string): string {
  const images = Array.isArray(product.images) ? product.images : [];
  const first = images[0] as unknown;
  if (!first) return fallback;
  if (typeof first === 'string') return first;
  return (first as { url?: string }).url || fallback;
}

function looksLikeESimProduct(product: Product): boolean {
  const haystack = [
    product.name,
    product.description,
    product.sku,
    getCategoryName(product),
    ...getTags(product),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return /\besim\b|\b5g\b|\blte\b|\bgb\b|\bdata\b|\btravel\b|\bjapan\b|\beurope\b|\bglobal\b|\btokyo\b|\bseoul\b|\bparis\b/.test(haystack);
}

function extractData(product: Product): string | null {
  const text = `${product.name} ${product.description} ${getTags(product).join(' ')}`;
  const match = text.match(/\b(unlimited|\d+\s?gb)\b/i);
  return match ? match[1].replace(/\s+/g, '').replace(/^unlimited$/i, 'Unlimited') : null;
}

function extractValidity(product: Product): string | null {
  const text = `${product.name} ${product.description} ${getTags(product).join(' ')}`;
  const match = text.match(/\b(\d+)\s?(day|days)\b/i);
  return match ? `${match[1]} days` : null;
}

export function formatPrice(value: number): string {
  return `$${value.toFixed(2)} USD`;
}

export function getPlanDisplay(product: Product, index?: number): PlanDisplay {
  const seed = index ?? hashString(product.id || product.sku || product.name);
  const fallback = FEATURED_PLANS[seed % FEATURED_PLANS.length];
  const isNative = looksLikeESimProduct(product);
  const categoryName = getCategoryName(product);
  const destination = isNative ? categoryName || fallback.destination : fallback.destination;
  const data = extractData(product) || fallback.data;
  const validity = extractValidity(product) || fallback.validity;

  return {
    ...fallback,
    title: isNative ? product.name : fallback.title,
    destination,
    city: destination,
    country: fallback.country,
    region: categoryName || fallback.region,
    data,
    validity,
    image: getImage(product, fallback.image),
    priceLabel: formatPrice(product.price || Number(fallback.priceLabel.replace(/[^0-9.]/g, '')) || 0),
    summary:
      isNative && product.description
        ? product.description
        : `${data} high-speed data with instant QR delivery.`,
  };
}
