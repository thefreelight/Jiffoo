/**
 * Currency Settings Component
 *
 * Manages multi-currency configuration including base currency,
 * enabled currencies, and exchange rates.
 */

'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, DollarSign, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useT, useLocale } from 'shared/src/i18n/react'
import { toast } from 'sonner'
import { apiClient, unwrapApiResponse } from '@/lib/api'

// Currency metadata with symbols
const CURRENCY_INFO: Record<string, { name: string; symbol: string }> = {
  USD: { name: 'US Dollar', symbol: '$' },
  EUR: { name: 'Euro', symbol: '€' },
  GBP: { name: 'British Pound', symbol: '£' },
  CAD: { name: 'Canadian Dollar', symbol: 'CA$' },
  AUD: { name: 'Australian Dollar', symbol: 'A$' },
  JPY: { name: 'Japanese Yen', symbol: '¥' },
  CNY: { name: 'Chinese Yuan', symbol: '¥' },
  INR: { name: 'Indian Rupee', symbol: '₹' },
}

interface ExchangeRate {
  id: string
  fromCurrency: string
  toCurrency: string
  rate: number
  validFrom: string
  validUntil: string | null
  source: string
  updatedAt: string
}

interface CurrencySettingsProps {
  onSettingsChange?: (settings: Record<string, any>) => void
}

export default function CurrencySettings({ onSettingsChange }: CurrencySettingsProps) {
  const t = useT()
  const locale = useLocale()

  const [baseCurrency, setBaseCurrency] = useState('USD')
  const [enabledCurrencies, setEnabledCurrencies] = useState<string[]>(['USD'])
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([])
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  const availableCurrencies = Object.keys(CURRENCY_INFO)

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Load current settings and exchange rates
  useEffect(() => {
    loadCurrencySettings()
    loadExchangeRates()
  }, [])

  const loadCurrencySettings = async () => {
    try {
      const response = await apiClient.get('/admin/settings')
      const data = unwrapApiResponse(response)

      if (data.baseCurrency) {
        setBaseCurrency(data.baseCurrency)
      }
      if (data.enabledCurrencies && Array.isArray(data.enabledCurrencies)) {
        setEnabledCurrencies(data.enabledCurrencies)
      }
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      toast.error('Failed to load currency settings: ' + errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const loadExchangeRates = async () => {
    try {
      const response = await apiClient.get('/api/currency/rates', {
        params: { page: 1, limit: 50 }
      })
      const data = unwrapApiResponse(response)

      if (data.items && Array.isArray(data.items)) {
        setExchangeRates(data.items)

        // Find most recent update time
        if (data.items.length > 0) {
          const mostRecent = data.items.reduce((latest: ExchangeRate, current: ExchangeRate) =>
            new Date(current.updatedAt) > new Date(latest.updatedAt) ? current : latest
          )
          setLastUpdate(mostRecent.updatedAt)
        }
      }
    } catch (err: any) {
      // Exchange rates might not exist yet, don't show error
      console.warn('Exchange rates not available:', err)
    }
  }

  const handleBaseCurrencyChange = async (currency: string) => {
    setBaseCurrency(currency)

    // Ensure base currency is enabled
    if (!enabledCurrencies.includes(currency)) {
      const newEnabled = [...enabledCurrencies, currency]
      setEnabledCurrencies(newEnabled)
      await saveCurrencySettings(currency, newEnabled)
    } else {
      await saveCurrencySettings(currency, enabledCurrencies)
    }
  }

  const handleCurrencyToggle = async (currency: string, enabled: boolean) => {
    let newEnabled: string[]

    if (enabled) {
      newEnabled = [...enabledCurrencies, currency]
    } else {
      // Prevent disabling base currency
      if (currency === baseCurrency) {
        toast.error('Cannot disable the base currency')
        return
      }
      newEnabled = enabledCurrencies.filter(c => c !== currency)
    }

    setEnabledCurrencies(newEnabled)
    await saveCurrencySettings(baseCurrency, newEnabled)
  }

  const saveCurrencySettings = async (base: string, enabled: string[]) => {
    try {
      const settings = {
        baseCurrency: base,
        enabledCurrencies: enabled,
      }

      const response = await apiClient.put('/admin/settings/batch', { settings })
      unwrapApiResponse(response)

      // Notify parent component
      if (onSettingsChange) {
        onSettingsChange(settings)
      }

      toast.success(getText('common.messages.saveSuccess', 'Settings saved successfully'))
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      toast.error('Failed to save currency settings: ' + errorMsg)
    }
  }

  const handleRefreshRates = async () => {
    setUpdating(true)
    try {
      const response = await apiClient.post('/api/currency/rates/update')
      unwrapApiResponse(response)

      toast.success(getText('merchant.settings.currency.ratesUpdated', 'Exchange rates updated successfully'))

      // Reload exchange rates
      await loadExchangeRates()
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      toast.error('Failed to update exchange rates: ' + errorMsg)
    } finally {
      setUpdating(false)
    }
  }

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleString(locale || 'en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatRate = (rate: number): string => {
    return rate.toFixed(4)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">
          {getText('common.loading', 'Loading...')}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Base Currency Selection */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {getText('merchant.settings.currency.baseCurrency', 'Base Currency')}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {getText('merchant.settings.currency.baseCurrencyDesc', 'Primary currency for your store. All prices are stored in this currency.')}
              </p>
              <Select value={baseCurrency} onValueChange={handleBaseCurrencyChange}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableCurrencies.map((code) => (
                    <SelectItem key={code} value={code}>
                      {CURRENCY_INFO[code].symbol} {code} - {CURRENCY_INFO[code].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-8 w-8 text-blue-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enabled Currencies */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {getText('merchant.settings.currency.enabledCurrencies', 'Enabled Currencies')}
            </h3>
            <p className="text-sm text-gray-500">
              {getText('merchant.settings.currency.enabledCurrenciesDesc', 'Select which currencies customers can use in your store.')}
            </p>
          </div>

          <div className="space-y-3">
            {availableCurrencies.map((code) => {
              const isEnabled = enabledCurrencies.includes(code)
              const isBase = code === baseCurrency

              return (
                <div
                  key={code}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-xl font-bold text-blue-600">
                      {CURRENCY_INFO[code].symbol}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{code}</span>
                        {isBase && (
                          <Badge variant="default" className="text-xs">
                            {getText('merchant.settings.currency.base', 'Base')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{CURRENCY_INFO[code].name}</p>
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleCurrencyToggle(code, checked)}
                    disabled={isBase}
                  />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Exchange Rates */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {getText('merchant.settings.currency.exchangeRates', 'Exchange Rates')}
              </h3>
              {lastUpdate && (
                <p className="text-sm text-gray-500">
                  {getText('merchant.settings.currency.lastUpdated', 'Last updated')}: {formatDateTime(lastUpdate)}
                </p>
              )}
            </div>
            <Button
              onClick={handleRefreshRates}
              disabled={updating}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${updating ? 'animate-spin' : ''}`} />
              {updating
                ? getText('merchant.settings.currency.updating', 'Updating...')
                : getText('merchant.settings.currency.updateRates', 'Update Rates')}
            </Button>
          </div>

          {exchangeRates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-2">
                {getText('merchant.settings.currency.noRates', 'No exchange rates available')}
              </p>
              <p className="text-sm">
                {getText('merchant.settings.currency.clickUpdate', 'Click "Update Rates" to fetch current exchange rates')}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{getText('merchant.settings.currency.from', 'From')}</TableHead>
                    <TableHead>{getText('merchant.settings.currency.to', 'To')}</TableHead>
                    <TableHead>{getText('merchant.settings.currency.rate', 'Rate')}</TableHead>
                    <TableHead>{getText('merchant.settings.currency.source', 'Source')}</TableHead>
                    <TableHead>{getText('merchant.settings.currency.updated', 'Updated')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exchangeRates.map((rate) => (
                    <TableRow key={rate.id}>
                      <TableCell className="font-medium">
                        {rate.fromCurrency}
                      </TableCell>
                      <TableCell className="font-medium">
                        {rate.toCurrency}
                      </TableCell>
                      <TableCell>
                        <code className="px-2 py-1 bg-gray-100 rounded text-sm">
                          {formatRate(rate.rate)}
                        </code>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {rate.source}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDateTime(rate.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {exchangeRates.length > 0 && (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>
                {getText('merchant.settings.currency.ratesActive', 'Exchange rates are active and will be used for currency conversion')}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
