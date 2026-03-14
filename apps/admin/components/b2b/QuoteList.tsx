/**
 * Quote List Component
 *
 * Displays the list of quotes in a table format
 * Can be reused in different contexts
 */

'use client'

import { FileText, Eye, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useT, useLocale } from 'shared/src/i18n/react'
import { Quote } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

interface QuoteListProps {
  quotes: Quote[]
  onApprove?: (quote: Quote) => void
  emptyMessage?: string
}

export function QuoteList({ quotes, onApprove, emptyMessage }: QuoteListProps) {
  const t = useT()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800'
      case 'REJECTED':
        return 'bg-red-100 text-red-800'
      case 'EXPIRED':
        return 'bg-orange-100 text-orange-800'
      case 'CONVERTED':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString(locale || 'en', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  const isExpiringSoon = (validUntil: string) => {
    const validDate = new Date(validUntil)
    const now = new Date()
    const daysUntilExpiry = Math.ceil((validDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0
  }

  const isExpired = (validUntil: string) => {
    const validDate = new Date(validUntil)
    const now = new Date()
    return validDate < now
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.quotes.quoteNumber', 'Quote #')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.quotes.company', 'Company')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.quotes.customer', 'Customer')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.quotes.amount', 'Amount')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.quotes.validUntil', 'Valid Until')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.quotes.status', 'Status')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.quotes.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {quotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="text-gray-500">
                      {emptyMessage || getText('merchant.b2b.quotes.noQuotesFound', 'No quotes found.')}
                    </div>
                  </td>
                </tr>
              ) : (
                quotes.map((quote: Quote) => (
                  <tr key={quote.id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full mr-4 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{quote.quoteNumber}</div>
                          <div className="text-sm text-gray-500">{formatDate(quote.createdAt)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm">
                        <div className="text-gray-900 font-medium">{quote.company?.name || getText('merchant.b2b.quotes.noCompany', 'No Company')}</div>
                        <div className="text-gray-500">{quote.company?.email || ''}</div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm">
                        <div className="text-gray-900">{quote.user?.username || quote.user?.email || getText('merchant.b2b.quotes.noCustomer', 'No Customer')}</div>
                        {quote.user?.username && <div className="text-gray-500">{quote.user?.email}</div>}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-gray-900">{formatCurrency(quote.total)}</div>
                      {quote.items && quote.items.length > 0 && (
                        <div className="text-sm text-gray-500">{quote.items.length} {getText('merchant.b2b.quotes.items', 'items')}</div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm">
                        <div className={`${isExpiringSoon(quote.validUntil) ? 'text-orange-600 font-medium' : isExpired(quote.validUntil) ? 'text-red-600' : 'text-gray-900'}`}>
                          {formatDate(quote.validUntil)}
                        </div>
                        {isExpiringSoon(quote.validUntil) && (
                          <div className="text-orange-600 text-xs">{getText('merchant.b2b.quotes.expiringSoon', 'Expiring soon')}</div>
                        )}
                        {isExpired(quote.validUntil) && (
                          <div className="text-red-600 text-xs">{getText('merchant.b2b.quotes.expired', 'Expired')}</div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <Badge className={getStatusColor(quote.status)}>
                        {quote.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <Link href={`/${locale}/b2b/quotes/${quote.id}`}>
                          <Button variant="ghost" size="sm" title={getText('merchant.b2b.quotes.viewDetails', 'View Details')}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        {quote.status === 'PENDING' && onApprove && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title={getText('merchant.b2b.quotes.approveReject', 'Approve/Reject')}
                            onClick={() => onApprove(quote)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
