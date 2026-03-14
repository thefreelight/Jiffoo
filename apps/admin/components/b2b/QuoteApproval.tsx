/**
 * Quote Approval Component
 *
 * Dialog for approving or rejecting B2B quotes
 */

'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useT } from 'shared/src/i18n/react'
import { Quote } from '@/lib/api'
import { useApproveQuote, useRejectQuote } from '@/lib/hooks/use-api'
import { formatCurrency } from '@/lib/utils'

interface QuoteApprovalProps {
  quote: Quote | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function QuoteApproval({ quote, open, onOpenChange, onSuccess }: QuoteApprovalProps) {
  const t = useT()
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [validUntilExtension, setValidUntilExtension] = useState('')

  const approveQuoteMutation = useApproveQuote()
  const rejectQuoteMutation = useRejectQuote()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const handleApprove = async () => {
    if (!quote) return

    try {
      await approveQuoteMutation.mutateAsync({
        id: quote.id,
        data: {
          approvedBy: 'admin',
          validUntil: validUntilExtension || undefined,
        },
      })
      handleClose()
      if (onSuccess) onSuccess()
    } catch (error) {
      // Error is handled by the mutation
    }
  }

  const handleReject = async () => {
    if (!quote || !rejectionReason.trim()) return

    try {
      await rejectQuoteMutation.mutateAsync({
        id: quote.id,
        data: {
          rejectedBy: 'admin',
          rejectionReason: rejectionReason.trim(),
        },
      })
      handleClose()
      if (onSuccess) onSuccess()
    } catch (error) {
      // Error is handled by the mutation
    }
  }

  const handleClose = () => {
    setAction(null)
    setRejectionReason('')
    setValidUntilExtension('')
    onOpenChange(false)
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  if (!quote) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{getText('merchant.b2b.quotes.approvalTitle', 'Quote Approval')}</DialogTitle>
          <DialogDescription>
            {getText('merchant.b2b.quotes.approvalDescription', 'Review and approve or reject this quote request')}
          </DialogDescription>
        </DialogHeader>

        {/* Quote Details */}
        <div className="space-y-4 py-4">
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-600">{getText('merchant.b2b.quotes.quoteNumber', 'Quote #')}</p>
                <p className="font-semibold text-gray-900">{quote.quoteNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">{getText('merchant.b2b.quotes.amount', 'Amount')}</p>
                <p className="font-semibold text-gray-900">{formatCurrency(quote.total)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">{getText('merchant.b2b.quotes.company', 'Company')}</p>
                <p className="font-medium text-gray-900">{quote.company?.name || getText('merchant.b2b.quotes.noCompany', 'No Company')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{getText('merchant.b2b.quotes.customer', 'Customer')}</p>
                <p className="font-medium text-gray-900">{quote.user?.username || quote.user?.email || getText('merchant.b2b.quotes.noCustomer', 'No Customer')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">{getText('merchant.b2b.quotes.validUntil', 'Valid Until')}</p>
                <p className="font-medium text-gray-900">{formatDate(quote.validUntil)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{getText('merchant.b2b.quotes.items', 'Items')}</p>
                <p className="font-medium text-gray-900">{quote.items?.length || 0} {getText('merchant.b2b.quotes.items', 'items')}</p>
              </div>
            </div>

            {quote.notes && (
              <div>
                <p className="text-sm text-gray-600">{getText('merchant.b2b.quotes.customerNotes', 'Customer Notes')}</p>
                <p className="text-sm text-gray-900 mt-1">{quote.notes}</p>
              </div>
            )}
          </div>

          {/* Action Selection */}
          {!action && (
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => setAction('approve')}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {getText('merchant.b2b.quotes.approve', 'Approve Quote')}
              </Button>
              <Button
                onClick={() => setAction('reject')}
                variant="outline"
                className="flex-1 border-red-600 text-red-600 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-2" />
                {getText('merchant.b2b.quotes.reject', 'Reject Quote')}
              </Button>
            </div>
          )}

          {/* Approve Form */}
          {action === 'approve' && (
            <div className="space-y-4 pt-4 border-t">
              <div className="bg-green-50 p-3 rounded-lg flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-900">{getText('merchant.b2b.quotes.approveConfirm', 'Approve this quote?')}</p>
                  <p className="text-sm text-green-700 mt-1">
                    {getText('merchant.b2b.quotes.approveInfo', 'The customer will be notified and can convert this quote to an order.')}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="validUntilExtension">{getText('merchant.b2b.quotes.extendValidity', 'Extend validity (optional)')}</Label>
                <input
                  id="validUntilExtension"
                  type="date"
                  value={validUntilExtension}
                  onChange={(e) => setValidUntilExtension(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  min={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-gray-500">
                  {getText('merchant.b2b.quotes.currentValidity', 'Current validity: {date}').replace('{date}', formatDate(quote.validUntil))}
                </p>
              </div>
            </div>
          )}

          {/* Reject Form */}
          {action === 'reject' && (
            <div className="space-y-4 pt-4 border-t">
              <div className="bg-red-50 p-3 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900">{getText('merchant.b2b.quotes.rejectConfirm', 'Reject this quote?')}</p>
                  <p className="text-sm text-red-700 mt-1">
                    {getText('merchant.b2b.quotes.rejectInfo', 'The customer will be notified. Please provide a reason.')}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rejectionReason">{getText('merchant.b2b.quotes.rejectionReason', 'Rejection Reason')} *</Label>
                <Textarea
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder={getText('merchant.b2b.quotes.rejectionReasonPlaceholder', 'Explain why this quote is being rejected...')}
                  rows={4}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {!action ? (
            <Button variant="outline" onClick={handleClose}>
              {getText('merchant.b2b.quotes.cancel', 'Cancel')}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setAction(null)}>
                {getText('merchant.b2b.quotes.back', 'Back')}
              </Button>
              {action === 'approve' ? (
                <Button
                  onClick={handleApprove}
                  disabled={approveQuoteMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {approveQuoteMutation.isPending ? getText('merchant.b2b.quotes.approving', 'Approving...') : getText('merchant.b2b.quotes.confirmApprove', 'Confirm Approval')}
                </Button>
              ) : (
                <Button
                  onClick={handleReject}
                  disabled={!rejectionReason.trim() || rejectQuoteMutation.isPending}
                  variant="destructive"
                >
                  {rejectQuoteMutation.isPending ? getText('merchant.b2b.quotes.rejecting', 'Rejecting...') : getText('merchant.b2b.quotes.confirmReject', 'Confirm Rejection')}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
