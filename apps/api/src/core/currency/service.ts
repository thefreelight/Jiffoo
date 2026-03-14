// @ts-nocheck
/**
 * Currency Service
 * Handles exchange rates, currency conversions, and currency-specific pricing using Prisma
 */

import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import type {
  ExchangeRateResponse,
  CurrencyPriceResponse,
  ConversionResultResponse
} from './types';

const EXCHANGE_RATE_CACHE_KEY = 'currency:exchange_rates';
const ENABLED_CURRENCIES_CACHE_KEY = 'currency:enabled_list';
const CACHE_TTL = 3600; // 1 hour TTL for currency cache
const EXCHANGE_RATE_API_URL = 'https://api.exchangerate-api.com/v4/latest';

/**
 * Exchange Rate API Response Format
 */
interface ExchangeRateApiResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export class CurrencyService {

  /**
   * Fetch exchange rates from external API
   * Uses exchangerate-api.com free tier
   */
  async fetchExchangeRates(baseCurrency: string = 'USD'): Promise<Record<string, number>> {
    try {
      const response = await fetch(`${EXCHANGE_RATE_API_URL}/${baseCurrency}`);

      if (!response.ok) {
        throw new Error(`Exchange rate API returned ${response.status}`);
      }

      const data: ExchangeRateApiResponse = await response.json();
      return data.rates;
    } catch (error) {
      throw new Error(`Failed to fetch exchange rates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update exchange rates in database
   * Fetches latest rates and stores them with validity period
   */
  async updateExchangeRates(baseCurrency: string = 'USD'): Promise<number> {
    const rates = await this.fetchExchangeRates(baseCurrency);
    const now = new Date();
    const validUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Valid for 24 hours

    let updatedCount = 0;

    // Store each rate in the database
    for (const [toCurrency, rate] of Object.entries(rates)) {
      await prisma.exchangeRate.create({
        data: {
          fromCurrency: baseCurrency,
          toCurrency,
          rate,
          validFrom: now,
          validUntil,
          source: 'exchangerate-api.com'
        }
      });
      updatedCount++;
    }

    // Invalidate cache after update
    await CacheService.delete(EXCHANGE_RATE_CACHE_KEY);

    return updatedCount;
  }

  /**
   * Get exchange rate between two currencies
   * Returns cached rate if available, otherwise fetches from database
   */
  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    // Same currency, rate is 1
    if (fromCurrency === toCurrency) {
      return 1;
    }

    // Try to get from cache
    const cacheKey = `${EXCHANGE_RATE_CACHE_KEY}:${fromCurrency}:${toCurrency}`;
    const cached = await CacheService.get<number>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database - get most recent valid rate
    const now = new Date();
    const exchangeRate = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency,
        toCurrency,
        validFrom: { lte: now },
        OR: [
          { validUntil: { gte: now } },
          { validUntil: null }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!exchangeRate) {
      throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
    }

    const rateValue = Number(exchangeRate.rate);

    // Cache the rate
    await CacheService.set(cacheKey, rateValue, { ttl: CACHE_TTL });

    return rateValue;
  }

  /**
   * Convert price between currencies
   */
  async convertPrice(amount: number, fromCurrency: string, toCurrency: string): Promise<ConversionResultResponse> {
    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    const convertedAmount = amount * rate;

    return {
      amount,
      fromCurrency,
      toCurrency,
      convertedAmount,
      rate,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get list of enabled currencies from system settings
   * Returns array of currency codes
   */
  async getEnabledCurrencies(): Promise<string[]> {
    // Try cache first
    const cached = await CacheService.get<string[]>(ENABLED_CURRENCIES_CACHE_KEY);
    if (cached) {
      return cached;
    }

    // Fetch from system settings
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'system' }
    });

    if (!settings?.settings) {
      // Default to USD if no settings
      return ['USD'];
    }

    try {
      const settingsObj = typeof settings.settings === 'string'
        ? JSON.parse(settings.settings)
        : settings.settings;

      if (!settingsObj || typeof settingsObj !== 'object' || Array.isArray(settingsObj)) {
        return ['USD'];
      }

      const enabledCurrencies = (settingsObj as Record<string, unknown>)['currency.enabled'] || ['USD'];

      // Cache the result
      await CacheService.set(ENABLED_CURRENCIES_CACHE_KEY, enabledCurrencies, { ttl: CACHE_TTL });

      return enabledCurrencies;
    } catch {
      return ['USD'];
    }
  }

  /**
   * Get currency-specific price for a variant
   * Returns null if no custom price is set
   */
  async getCurrencyPrice(variantId: string, currency: string): Promise<CurrencyPriceResponse | null> {
    const currencyPrice = await prisma.currencyPrice.findUnique({
      where: {
        variantId_currency: {
          variantId,
          currency
        }
      }
    });

    if (!currencyPrice) {
      return null;
    }

    return {
      id: currencyPrice.id,
      variantId: currencyPrice.variantId,
      currency: currencyPrice.currency,
      price: Number(currencyPrice.price),
      createdAt: currencyPrice.createdAt.toISOString(),
      updatedAt: currencyPrice.updatedAt.toISOString()
    };
  }

  /**
   * Set currency-specific price for a variant
   */
  async setCurrencyPrice(variantId: string, currency: string, price: number): Promise<CurrencyPriceResponse> {
    const currencyPrice = await prisma.currencyPrice.upsert({
      where: {
        variantId_currency: {
          variantId,
          currency
        }
      },
      update: {
        price
      },
      create: {
        variantId,
        currency,
        price
      }
    });

    return {
      id: currencyPrice.id,
      variantId: currencyPrice.variantId,
      currency: currencyPrice.currency,
      price: Number(currencyPrice.price),
      createdAt: currencyPrice.createdAt.toISOString(),
      updatedAt: currencyPrice.updatedAt.toISOString()
    };
  }

  /**
   * Get variant price in specified currency
   * Returns custom price if set, otherwise converts base price
   */
  async getVariantPriceInCurrency(variantId: string, currency: string, baseCurrency: string = 'USD'): Promise<number> {
    // First check if there's a custom price for this currency
    const customPrice = await this.getCurrencyPrice(variantId, currency);
    if (customPrice) {
      return customPrice.price;
    }

    // No custom price, get base price and convert
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { salePrice: true }
    });

    if (!variant) {
      throw new Error(`Variant ${variantId} not found`);
    }

    // If requesting base currency, return sale price
    if (currency === baseCurrency) {
      return Number((variant as any).salePrice);
    }

    // Convert from base currency to requested currency
    const rate = await this.getExchangeRate(baseCurrency, currency);
    return Number((variant as any).salePrice) * rate;
  }

  /**
   * List all exchange rates with pagination
   */
  async listExchangeRates(page: number = 1, limit: number = 50): Promise<{
    items: ExchangeRateResponse[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.exchangeRate.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.exchangeRate.count()
    ]);

    return {
      items: items.map(item => ({
        id: item.id,
        fromCurrency: item.fromCurrency,
        toCurrency: item.toCurrency,
        rate: Number(item.rate),
        validFrom: item.validFrom?.toISOString() || '',
        validUntil: item.validUntil?.toISOString() || null,
        source: item.source || '',
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString()
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Get all currency prices for a variant
   */
  async getVariantCurrencyPrices(variantId: string): Promise<CurrencyPriceResponse[]> {
    const prices = await prisma.currencyPrice.findMany({
      where: { variantId },
      orderBy: { currency: 'asc' }
    });

    return prices.map(price => ({
      id: price.id,
      variantId: price.variantId,
      currency: price.currency,
      price: Number(price.price),
      createdAt: price.createdAt.toISOString(),
      updatedAt: price.updatedAt.toISOString()
    }));
  }

  /**
   * Delete currency-specific price
   */
  async deleteCurrencyPrice(variantId: string, currency: string): Promise<boolean> {
    try {
      await prisma.currencyPrice.delete({
        where: {
          variantId_currency: {
            variantId,
            currency
          }
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear currency cache
   */
  async clearCache(): Promise<void> {
    await CacheService.delete(EXCHANGE_RATE_CACHE_KEY);
    await CacheService.delete(ENABLED_CURRENCIES_CACHE_KEY);
  }
}
