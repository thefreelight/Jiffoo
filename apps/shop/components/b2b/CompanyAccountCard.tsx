/**
 * Company Account Card Component
 *
 * Displays company information in a card format for B2B customers
 */

'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Company {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  taxId: string | null;
  accountType: string;
  paymentTerms: string;
  creditLimit: number | null;
  currentBalance: number;
  taxExempt: boolean;
  isActive: boolean;
  customerGroupId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CompanyAccountCardProps {
  company: Company;
  userRole?: string;
  getText: (key: string, fallback: string) => string;
}

export function CompanyAccountCard({ company, userRole, getText }: CompanyAccountCardProps) {
  // Format payment terms for display
  const formatPaymentTerms = (terms: string): string => {
    switch (terms) {
      case 'NET15': return 'Net 15';
      case 'NET30': return 'Net 30';
      case 'NET60': return 'Net 60';
      case 'NET90': return 'Net 90';
      case 'IMMEDIATE': return getText('shop.b2b.paymentTerms.immediate', 'Immediate');
      default: return terms;
    }
  };

  // Format account type for display
  const formatAccountType = (type: string): string => {
    switch (type) {
      case 'STANDARD': return getText('shop.b2b.accountType.standard', 'Standard');
      case 'PREMIUM': return getText('shop.b2b.accountType.premium', 'Premium');
      case 'ENTERPRISE': return getText('shop.b2b.accountType.enterprise', 'Enterprise');
      default: return type;
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{company.name}</CardTitle>
            <CardDescription>{company.email}</CardDescription>
          </div>
          <div className="flex gap-2">
            {company.isActive ? (
              <Badge variant="default" className="bg-green-500">
                {getText('common.status.active', 'Active')}
              </Badge>
            ) : (
              <Badge variant="secondary">
                {getText('common.status.inactive', 'Inactive')}
              </Badge>
            )}
            {company.taxExempt && (
              <Badge variant="outline">
                {getText('shop.b2b.taxExempt', 'Tax Exempt')}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contact Information */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-muted-foreground">
              {getText('shop.b2b.contactInfo', 'Contact Information')}
            </h3>
            {company.phone && (
              <div className="text-sm">
                <span className="font-medium">{getText('common.fields.phone', 'Phone')}:</span> {company.phone}
              </div>
            )}
            {company.taxId && (
              <div className="text-sm">
                <span className="font-medium">{getText('shop.b2b.taxId', 'Tax ID')}:</span> {company.taxId}
              </div>
            )}
            {userRole && (
              <div className="text-sm">
                <span className="font-medium">{getText('shop.b2b.yourRole', 'Your Role')}:</span>{' '}
                <Badge variant="outline" className="ml-1">
                  {userRole}
                </Badge>
              </div>
            )}
          </div>

          {/* Account Details */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-muted-foreground">
              {getText('shop.b2b.accountDetails', 'Account Details')}
            </h3>
            <div className="text-sm">
              <span className="font-medium">{getText('shop.b2b.accountType', 'Account Type')}:</span>{' '}
              {formatAccountType(company.accountType)}
            </div>
            <div className="text-sm">
              <span className="font-medium">{getText('shop.b2b.paymentTerms', 'Payment Terms')}:</span>{' '}
              {formatPaymentTerms(company.paymentTerms)}
            </div>
            <div className="text-sm">
              <span className="font-medium">{getText('shop.b2b.creditLimit', 'Credit Limit')}:</span>{' '}
              {formatCurrency(company.creditLimit)}
            </div>
            <div className="text-sm">
              <span className="font-medium">{getText('shop.b2b.currentBalance', 'Current Balance')}:</span>{' '}
              <span className={company.currentBalance > 0 ? 'text-orange-600 font-semibold' : ''}>
                {formatCurrency(company.currentBalance)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
