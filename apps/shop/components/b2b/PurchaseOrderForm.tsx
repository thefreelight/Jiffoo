/**
 * Purchase Order Form Component
 *
 * Form for B2B customers to enter purchase order information at checkout
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileText, AlertCircle } from 'lucide-react';

interface PurchaseOrderFormProps {
  companyName: string;
  paymentTerms: string;
  creditLimit: number | null;
  currentBalance: number;
  onSubmit: (data: {
    purchaseOrderNumber: string;
    department?: string;
    notes?: string;
  }) => Promise<void>;
  isLoading?: boolean;
  getText: (key: string, fallback: string) => string;
}

export function PurchaseOrderForm({
  companyName,
  paymentTerms,
  creditLimit,
  currentBalance,
  onSubmit,
  isLoading,
  getText,
}: PurchaseOrderFormProps) {
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Format payment terms for display
  const formatPaymentTerms = (terms: string): string => {
    switch (terms) {
      case 'NET15': return getText('shop.b2b.paymentTerms.net15', 'Net 15 Days');
      case 'NET30': return getText('shop.b2b.paymentTerms.net30', 'Net 30 Days');
      case 'NET60': return getText('shop.b2b.paymentTerms.net60', 'Net 60 Days');
      case 'NET90': return getText('shop.b2b.paymentTerms.net90', 'Net 90 Days');
      case 'IMMEDIATE': return getText('shop.b2b.paymentTerms.immediate', 'Immediate');
      default: return terms;
    }
  };

  // Format currency
  const formatCurrency = (amount: number | null): string => {
    if (amount === null) return getText('shop.b2b.unlimited', 'Unlimited');
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Validate form
  const validateForm = (): boolean => {
    if (!purchaseOrderNumber.trim()) {
      setError(getText('shop.b2b.errorNoPONumber', 'Purchase order number is required'));
      return false;
    }

    setError(null);
    return true;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit({
        purchaseOrderNumber: purchaseOrderNumber.trim(),
        department: department.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      setError((err as Error).message || getText('shop.b2b.errorSubmitPO', 'Failed to submit purchase order'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>{getText('shop.b2b.purchaseOrder', 'Purchase Order')}</CardTitle>
            <CardDescription>
              {getText('shop.b2b.poDescription', 'Complete your order using a purchase order')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Company Information */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-3">
          <h3 className="font-semibold text-sm">
            {getText('shop.b2b.companyInfo', 'Company Information')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">{getText('shop.b2b.company', 'Company')}:</span>
              <p className="font-medium mt-1">{companyName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{getText('shop.b2b.paymentTerms', 'Payment Terms')}:</span>
              <p className="font-medium mt-1">
                <Badge variant="secondary" className="mt-1">
                  {formatPaymentTerms(paymentTerms)}
                </Badge>
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">{getText('shop.b2b.creditLimit', 'Credit Limit')}:</span>
              <p className="font-medium mt-1">{formatCurrency(creditLimit)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{getText('shop.b2b.currentBalance', 'Current Balance')}:</span>
              <p className={`font-medium mt-1 ${currentBalance > 0 ? 'text-orange-600' : ''}`}>
                {formatCurrency(currentBalance)}
              </p>
            </div>
          </div>

          {/* Credit warning if over limit */}
          {creditLimit !== null && currentBalance > creditLimit * 0.8 && (
            <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-orange-800">
                {getText('shop.b2b.creditWarning', 'Your account balance is approaching the credit limit. Please ensure sufficient credit is available.')}
              </p>
            </div>
          )}
        </div>

        {/* PO Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="purchaseOrderNumber">
              {getText('shop.b2b.poNumber', 'Purchase Order Number')} *
            </Label>
            <Input
              id="purchaseOrderNumber"
              value={purchaseOrderNumber}
              onChange={(e) => setPurchaseOrderNumber(e.target.value)}
              placeholder={getText('shop.b2b.poNumberPlaceholder', 'e.g., PO-2024-001')}
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="department">
              {getText('shop.b2b.department', 'Department')}
            </Label>
            <Input
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder={getText('shop.b2b.departmentPlaceholder', 'e.g., Marketing, IT, Sales')}
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="notes">
              {getText('shop.b2b.orderNotes', 'Order Notes')}
            </Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={getText('shop.b2b.orderNotesPlaceholder', 'Any additional information...')}
              className="w-full min-h-[80px] px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              disabled={isLoading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={isLoading}>
            <FileText className="h-4 w-4 mr-2" />
            {isLoading
              ? getText('common.actions.processing', 'Processing...')
              : getText('shop.b2b.submitPO', 'Submit Purchase Order')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
