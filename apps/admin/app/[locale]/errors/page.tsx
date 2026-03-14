/**
 * Errors Page for Admin Application
 *
 * Displays error logs with search, filter, and pagination.
 * Supports i18n through the translation function.
 */

'use client'

import { AlertTriangle, CheckCircle, Filter, Search, XCircle } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useErrors, type ErrorLog, type ErrorListParams } from '@/lib/hooks/use-api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageNav } from '@/components/layout/page-nav'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useT, useLocale } from 'shared/src/i18n/react'
import { format } from 'date-fns'

export default function ErrorsPage() {
  const t = useT()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Page navigation items
  const navItems = [
    { label: getText('merchant.errors.allErrors', 'All Errors'), href: '/errors', exact: true },
  ]

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSeverity, setSelectedSeverity] = useState('All')
  const [selectedResolved, setSelectedResolved] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // Build filter params
  const filterParams: ErrorListParams = {
    page: currentPage,
    limit: pageSize,
    search: searchTerm || undefined,
    severity: selectedSeverity !== 'All' ? selectedSeverity as any : undefined,
    resolved: selectedResolved === 'All' ? undefined : selectedResolved === 'Resolved',
  }

  // API hooks
  const {
    data: errorsData,
    isLoading,
    error,
    refetch
  } = useErrors(filterParams)

  const errors = errorsData?.data || []
  const pagination = errorsData?.pagination

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

  // Calculate stats from errors data
  const errorStats = {
    total: pagination?.total || 0,
    critical: errors.filter((err: ErrorLog) => err.severity === 'CRITICAL').length,
    error: errors.filter((err: ErrorLog) => err.severity === 'ERROR').length,
    resolved: errors.filter((err: ErrorLog) => err.resolved).length,
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">{getText('merchant.errors.loading', 'Loading errors...')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{getText('merchant.errors.loadFailed', 'Failed to load errors')}</h3>
              <p className="text-gray-600 mb-4">{getText('merchant.errors.loadError', 'There was an error loading the error logs.')}</p>
              <Button onClick={() => refetch()}>{getText('merchant.errors.tryAgain', 'Try Again')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getText('merchant.errors.title', 'Error Logs')}</h1>
            <p className="text-gray-600 mt-1">{getText('merchant.errors.subtitle', 'Monitor and track application errors')}</p>
          </div>
        </div>
        {/* In-page Navigation */}
        <PageNav items={navItems} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.errors.totalErrors', 'Total Errors')}</p>
                <p className="text-2xl font-bold text-gray-900">{errorStats.total.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.errors.critical', 'Critical')}</p>
                <p className="text-2xl font-bold text-red-600">{errorStats.critical}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.errors.errors', 'Errors')}</p>
                <p className="text-2xl font-bold text-orange-600">{errorStats.error}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.errors.resolved', 'Resolved')}</p>
                <p className="text-2xl font-bold text-green-600">{errorStats.resolved}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={getText('merchant.errors.searchPlaceholder', 'Search errors by message...')}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={getText('merchant.errors.allSeverity', 'All Severity')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">{getText('merchant.errors.allSeverity', 'All Severity')}</SelectItem>
                  <SelectItem value="CRITICAL">{getText('merchant.errors.critical', 'Critical')}</SelectItem>
                  <SelectItem value="ERROR">{getText('merchant.errors.error', 'Error')}</SelectItem>
                  <SelectItem value="WARNING">{getText('merchant.errors.warning', 'Warning')}</SelectItem>
                  <SelectItem value="INFO">{getText('merchant.errors.info', 'Info')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedResolved} onValueChange={setSelectedResolved}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={getText('merchant.errors.allStatus', 'All Status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">{getText('merchant.errors.allStatus', 'All Status')}</SelectItem>
                  <SelectItem value="Resolved">{getText('merchant.errors.resolved', 'Resolved')}</SelectItem>
                  <SelectItem value="Unresolved">{getText('merchant.errors.unresolved', 'Unresolved')}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                {getText('merchant.errors.moreFilters', 'More Filters')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Errors Table */}
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
                        {searchTerm || selectedSeverity !== 'All' || selectedResolved !== 'All'
                          ? getText('merchant.errors.noErrorsMatching', 'No errors found matching your filters.')
                          : getText('merchant.errors.noErrorsFound', 'No errors found.')}
                      </div>
                    </td>
                  </tr>
                ) : (
                  errors.map((errorLog: ErrorLog) => (
                    <tr key={errorLog.id} className="hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <Link href={`/${locale}/errors/${errorLog.id}`}>
                          <div className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer">
                            {errorLog.message.substring(0, 80)}
                            {errorLog.message.length > 80 ? '...' : ''}
                          </div>
                        </Link>
                        <div className="text-sm text-gray-500 mt-1">
                          {errorLog.path && `${errorLog.method} ${errorLog.path}`}
                        </div>
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

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {getText('merchant.errors.showingResults', 'Showing {from} to {to} of {total} results')
              .replace('{from}', String((currentPage - 1) * pageSize + 1))
              .replace('{to}', String(Math.min(currentPage * pageSize, pagination.total)))
              .replace('{total}', String(pagination.total))}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              {getText('merchant.errors.previous', 'Previous')}
            </Button>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const page = i + 1
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              )
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
              disabled={currentPage === pagination.totalPages}
            >
              {getText('merchant.errors.next', 'Next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
