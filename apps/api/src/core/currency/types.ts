import { z } from 'zod';

// Supported Currency Codes (ISO 4217)
export const SupportedCurrency = {
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  CAD: 'CAD',
  AUD: 'AUD',
  JPY: 'JPY',
  CNY: 'CNY',
  INR: 'INR',
} as const;

export type SupportedCurrencyType = typeof SupportedCurrency[keyof typeof SupportedCurrency];

// Currency Conversion Request
export const ConversionRequestSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  fromCurrency: z.string().min(3).max(3, 'Currency code must be 3 characters'),
  toCurrency: z.string().min(3).max(3, 'Currency code must be 3 characters'),
});

// Currency Settings
export const CurrencySettingsSchema = z.object({
  baseCurrency: z.string().min(3).max(3, 'Currency code must be 3 characters'),
  enabledCurrencies: z.array(z.string().min(3).max(3)).min(1, 'At least one currency must be enabled'),
  autoUpdateRates: z.boolean().optional(),
  updateFrequency: z.string().optional(), // e.g., "daily", "hourly"
});

// Set Currency Price Request
export const SetCurrencyPriceSchema = z.object({
  variantId: z.string().min(1, 'Variant ID is required'),
  currency: z.string().min(3).max(3, 'Currency code must be 3 characters'),
  price: z.number().positive('Price must be positive'),
});

// TypeScript Type Inference
export type ConversionRequest = z.infer<typeof ConversionRequestSchema>;
export type CurrencySettings = z.infer<typeof CurrencySettingsSchema>;
export type SetCurrencyPriceRequest = z.infer<typeof SetCurrencyPriceSchema>;

// Exchange Rate Response Interface
export interface ExchangeRateResponse {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  validFrom: string;
  validUntil: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

// Currency Price Response Interface
export interface CurrencyPriceResponse {
  id: string;
  variantId: string;
  currency: string;
  price: number;
  createdAt: string;
  updatedAt: string;
}

// Currency List Response Interface
export interface CurrencyListResponse {
  code: string;
  name: string;
  symbol: string;
  enabled: boolean;
}

// Conversion Result Response Interface
export interface ConversionResultResponse {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  convertedAmount: number;
  rate: number;
  timestamp: string;
}

// Paginated Exchange Rate List Response (PageResult format)
export interface ExchangeRateListResponse {
  items: ExchangeRateResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
