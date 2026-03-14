/**
 * Quote List Component
 *
 * Displays a list of quotes with status badges and action buttons
 */

'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/state-components';
import { FileText, Eye } from 'lucide-react';
import type { Quote } from '@/store/quotes';

interface QuoteListProps {
  quotes: Quote[];
  isLoading: boolean;
  onViewQuote?: (quoteId: string) => void;
  getText: (key: string, fallback: string) => string;
}

export function QuoteList({ quotes, isLoading, onViewQuote, getText }: QuoteListProps) {
  // Format date for display
  const formatDate = (dateString: string): string => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(dateString));
    } catch {
      return dateString;
    }
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Get status badge variant
  const getStatusVariant = (status: Quote['status']): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'APPROVED':
        return 'default';
      case 'PENDING':
        return 'secondary';
      case 'REJECTED':
      case 'EXPIRED':
        return 'destructive';
      case 'DRAFT':
        return 'outline';
      case 'CONVERTED':
        return 'default';
      default:
        return 'secondary';
    }
  };

  // Format status for display
  const formatStatus = (status: Quote['status']): string => {
    switch (status) {
      case 'DRAFT': return getText('shop.b2b.quoteStatus.draft', 'Draft');
      case 'PENDING': return getText('shop.b2b.quoteStatus.pending', 'Pending');
      case 'APPROVED': return getText('shop.b2b.quoteStatus.approved', 'Approved');
      case 'REJECTED': return getText('shop.b2b.quoteStatus.rejected', 'Rejected');
      case 'EXPIRED': return getText('shop.b2b.quoteStatus.expired', 'Expired');
      case 'CONVERTED': return getText('shop.b2b.quoteStatus.converted', 'Converted');
      default: return status;
    }
  };

  if (isLoading) {
    return <LoadingState type="spinner" message={getText('common.actions.loading', 'Loading quotes...')} />;
  }

  if (quotes.length === 0) {
    return (
      <EmptyState
        title={getText('shop.b2b.noQuotes', 'No Quotes Yet')}
        message={getText('shop.b2b.noQuotesMessage', 'You haven\'t created any quote requests yet.')}
        icon={<FileText className="h-8 w-8 text-gray-400" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      {quotes.map((quote) => (
        <Card key={quote.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{quote.quoteNumber}</CardTitle>
                <CardDescription>
                  {getText('shop.b2b.createdOn', 'Created on')} {formatDate(quote.createdAt)}
                </CardDescription>
              </div>
              <Badge variant={getStatusVariant(quote.status)}>
                {formatStatus(quote.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Quote details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{getText('shop.b2b.totalAmount', 'Total')}:</span>
                  <p className="font-semibold">{formatCurrency(quote.totalAmount)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{getText('shop.b2b.items', 'Items')}:</span>
                  <p className="font-semibold">{quote.items?.length || 0}</p>
                </div>
                {quote.validUntil && (
                  <div>
                    <span className="text-muted-foreground">{getText('shop.b2b.validUntil', 'Valid Until')}:</span>
                    <p className="font-semibold">{formatDate(quote.validUntil)}</p>
                  </div>
                )}
                {quote.contactName && (
                  <div>
                    <span className="text-muted-foreground">{getText('shop.b2b.contact', 'Contact')}:</span>
                    <p className="font-semibold">{quote.contactName}</p>
                  </div>
                )}
              </div>

              {/* Customer notes */}
              {quote.customerNotes && (
                <div className="pt-3 border-t">
                  <span className="text-sm text-muted-foreground">{getText('shop.b2b.notes', 'Notes')}:</span>
                  <p className="text-sm mt-1">{quote.customerNotes}</p>
                </div>
              )}

              {/* Actions */}
              {onViewQuote && (
                <div className="pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewQuote(quote.id)}
                    className="w-full md:w-auto"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {getText('common.actions.viewDetails', 'View Details')}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
