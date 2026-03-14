/**
 * Error List Component
 *
 * Displays a table of error logs with severity badges and action buttons.
 * Can be reused in different contexts (dashboard, dedicated error page, etc.)
 */

'use client'

import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { useT, useLocale } from 'shared/src/i18n/react'

export interface ErrorLogItem {
  id: string
  message: string
  severity: string
  occurrenceCount: number
  lastSeenAt: string
  resolved: boolean
  path?: string | null
  method?: string | null
}

interface ErrorListProps {
  errors: ErrorLogItem[]
  isLoading?: boolean
  onRefresh?: () => void
}

export function ErrorList({ errors, isLoading, onRefresh }: ErrorListProps) {
  const t = useT()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const getSeverityColor = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800'
      case 'ERROR':
        return 'bg-orange-100 text-orange-800'
      case 'WARNING':
        return 'bg-yellow-100 text-yellow-800'
      case 'INFO':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
      case 'ERROR':
        return <XCircle className="w-4 h-4" />
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4" />
      case 'INFO':
        return <CheckCircle className="w-4 h-4" />
      default:
        return <AlertTriangle className="w-4 h-4" />
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">{getText('merchant.errors.loading', 'Loading errors...')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.errors.message', 'Error Message')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.errors.severity', 'Severity')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.errors.occurrences', 'Occurrences')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.errors.lastSeen', 'Last Seen')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.errors.status', 'Status')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.errors.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {errors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="text-gray-500">
                      {getText('merchant.errors.noErrorsFound', 'No errors found.')}
                    </div>
                  </td>
                </tr>
              ) : (
                errors.map((errorLog) => (
                  <tr key={errorLog.id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <Link href={`/${locale}/errors/${errorLog.id}`}>
                        <div className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer">
                          {errorLog.message.substring(0, 80)}
                          {errorLog.message.length > 80 ? '...' : ''}
                        </div>
                      </Link>
                      {errorLog.path && (
                        <div className="text-sm text-gray-500 mt-1">
                          {errorLog.method} {errorLog.path}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <Badge className={getSeverityColor(errorLog.severity)} variant="secondary">
                        <div className="flex items-center space-x-1">
                          {getSeverityIcon(errorLog.severity)}
                          <span>{errorLog.severity}</span>
                        </div>
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-medium text-gray-900">{errorLog.occurrenceCount}</span>
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      {errorLog.lastSeenAt ? format(new Date(errorLog.lastSeenAt), 'MMM d, yyyy HH:mm') : 'N/A'}
                    </td>
                    <td className="py-4 px-6">
                      {errorLog.resolved ? (
                        <Badge className="bg-green-100 text-green-800" variant="secondary">
                          {getText('merchant.errors.resolved', 'Resolved')}
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800" variant="secondary">
                          {getText('merchant.errors.unresolved', 'Unresolved')}
                        </Badge>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <Link href={`/${locale}/errors/${errorLog.id}`}>
                        <Button variant="ghost" size="sm">
                          {getText('merchant.errors.viewDetails', 'View Details')}
                        </Button>
                      </Link>
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
