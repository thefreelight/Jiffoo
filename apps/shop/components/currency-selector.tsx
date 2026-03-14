'use client';

import { useCurrency } from '@/hooks/use-currency';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * CurrencySelector Component
 *
 * Dropdown showing enabled currencies with symbols.
 * Uses useCurrency hook for state management.
 *
 * Features:
 * - Displays currency code and symbol (e.g., "USD $", "EUR €")
 * - Only shows enabled currencies from API
 * - Persists selection to localStorage
 * - Responsive and accessible
 *
 * @example
 * ```tsx
 * <CurrencySelector />
 * ```
 */
export function CurrencySelector() {
  const {
    currency,
    setCurrency,
    enabledCurrencies,
    currencies,
    getCurrencySymbol,
    isLoading,
  } = useCurrency();

  // Don't render if only one currency is enabled or still loading
  if (isLoading || enabledCurrencies.length <= 1) {
    return null;
  }

  return (
    <Select value={currency} onValueChange={setCurrency}>
      <SelectTrigger className="w-[120px] h-9 text-sm">
        <SelectValue>
          {currency} {getCurrencySymbol(currency)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {enabledCurrencies.map((code) => {
          const currencyInfo = currencies.find((c) => c.code === code);
          const symbol = getCurrencySymbol(code);
          const name = currencyInfo?.name || code;

          return (
            <SelectItem key={code} value={code}>
              <span className="flex items-center gap-2">
                <span className="font-medium">{code}</span>
                <span className="text-muted-foreground">{symbol}</span>
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
