/**
 * Quotes Page for B2B Admin
 *
 * Displays quote list with search, filter, and pagination.
 * Supports i18n through the translation function.
 * Uses in-page navigation (Shopify style).
 */

'use client'

import { AlertTriangle, FileText, Search, Eye } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useQuotes, type Quote } from '@/lib/hooks/use-api'
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
import { QuoteList } from '@/components/b2b/QuoteList'
import { QuoteApproval } from '@/components/b2b/QuoteApproval'
import { formatCurrency } from '@/lib/utils'

export default function QuotesPage() {
  const t = useT()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Page navigation items for Quotes module
  const navItems = [
    { label: getText('merchant.b2b.quotes.allQuotes', 'All Quotes'), href: '/b2b/quotes', exact: true },
  ]
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  // Approval dialog state
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)

  // API hooks
  const {
    data: quotesData,
    isLoading,
    error,
    refetch
  } = useQuotes({
    page: currentPage,
    limit: pageSize,
    status: selectedStatus !== 'All' ? selectedStatus : undefined
  })

  const quotes = quotesData?.data || []
  const pagination = quotesData?.pagination

  // Filter quotes locally for immediate feedback
  const filteredQuotes = quotes.filter((quote: Quote) => {
    if (!quote) return false
    const matchesSearch = searchTerm === '' ||
      quote.quoteNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.company?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.user?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

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

  // Calculate stats from quotes data
  const quoteStats = {
    total: pagination?.total || 0,
    pending: quotes.filter((q: Quote) => q.status === 'PENDING').length,
    approved: quotes.filter((q: Quote) => q.status === 'APPROVED').length,
    totalValue: quotes.reduce((sum: number, q: Quote) => sum + (q.total || 0), 0),
  }

  // Handle approve/reject
  const handleApprove = (quote: Quote) => {
    setSelectedQuote(quote)
    setApprovalDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">{getText('merchant.b2b.quotes.loadFailed', 'Failed to load quotes')}</h3>
              <p className="text-gray-600 mb-4">{getText('merchant.b2b.quotes.loadError', 'There was an error loading the quotes data.')}</p>
              <Button onClick={() => refetch()}>{getText('merchant.b2b.quotes.tryAgain', 'Try Again')}</Button>
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
            <h1 className="text-2xl font-bold text-gray-900">{getText('merchant.b2b.quotes.title', 'Quote Requests')}</h1>
            <p className="text-gray-600 mt-1">{getText('merchant.b2b.quotes.subtitle', 'Manage B2B quote requests and approvals')}</p>
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
                <p className="text-sm font-medium text-gray-600">{getText('merchant.b2b.quotes.totalQuotes', 'Total Quotes')}</p>
                <p className="text-2xl font-bold text-gray-900">{quoteStats.total.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.b2b.quotes.pending', 'Pending')}</p>
                <p className="text-2xl font-bold text-yellow-600">{quoteStats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.b2b.quotes.approved', 'Approved')}</p>
                <p className="text-2xl font-bold text-green-600">{quoteStats.approved}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{getText('merchant.b2b.quotes.totalValue', 'Total Value')}</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(quoteStats.totalValue)}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600" />
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
                  placeholder={getText('merchant.b2b.quotes.searchPlaceholder', 'Search quotes by number, company, or customer...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={getText('merchant.b2b.quotes.allStatus', 'All Status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">{getText('merchant.b2b.quotes.allStatus', 'All Status')}</SelectItem>
                  <SelectItem value="DRAFT">{getText('merchant.b2b.quotes.statusDraft', 'Draft')}</SelectItem>
                  <SelectItem value="PENDING">{getText('merchant.b2b.quotes.statusPending', 'Pending')}</SelectItem>
                  <SelectItem value="APPROVED">{getText('merchant.b2b.quotes.statusApproved', 'Approved')}</SelectItem>
                  <SelectItem value="REJECTED">{getText('merchant.b2b.quotes.statusRejected', 'Rejected')}</SelectItem>
                  <SelectItem value="EXPIRED">{getText('merchant.b2b.quotes.statusExpired', 'Expired')}</SelectItem>
                  <SelectItem value="CONVERTED">{getText('merchant.b2b.quotes.statusConverted', 'Converted')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quotes List */}
      <QuoteList
        quotes={filteredQuotes}
        onApprove={handleApprove}
        emptyMessage={searchTerm ? getText('merchant.b2b.quotes.noQuotesMatching', 'No quotes found matching your search.') : undefined}
      />

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {getText('merchant.b2b.quotes.showingResults', 'Showing {from} to {to} of {total} results')
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
              {getText('merchant.b2b.quotes.previous', 'Previous')}
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
              {getText('merchant.b2b.quotes.next', 'Next')}
            </Button>
          </div>
        </div>
      )}

      {/* Approval Dialog */}
      <QuoteApproval
        quote={selectedQuote}
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
        onSuccess={() => {
          refetch()
          setApprovalDialogOpen(false)
          setSelectedQuote(null)
        }}
      />
    </div>
  )
}
