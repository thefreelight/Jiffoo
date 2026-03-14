/**
 * Tiered Pricing Table Component
 *
 * Displays tiered pricing information for B2B customers on product pages
 */

'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, LoadingState } from '@/components/ui/state-components';
import { TrendingDown, Package } from 'lucide-react';

export interface TieredPricingTier {
  minQuantity: number;
  maxQuantity?: number | null;
  pricePerUnit: number;
  discount: number;
  discountType: string;
  totalSavings: number;
  ruleId: string;
  ruleName: string;
}

interface TieredPricingTableProps {
  tiers: TieredPricingTier[];
  isLoading: boolean;
  currency?: string;
  getText: (key: string, fallback: string) => string;
}

export function TieredPricingTable({
  tiers,
  isLoading,
  currency = '$',
  getText
}: TieredPricingTableProps) {
  // Format currency
  const formatCurrency = (amount: number): string => {
    return `${currency}${amount.toFixed(2)}`;
  };

  // Format quantity range
  const formatQuantityRange = (min: number, max?: number | null): string => {
    if (max === null || max === undefined) {
      return `${min}+`;
    }
    return `${min}-${max}`;
  };

  // Get discount badge variant based on amount
  const getDiscountVariant = (discount: number): 'default' | 'secondary' | 'destructive' => {
    if (discount >= 20) return 'destructive';
    if (discount >= 10) return 'default';
    return 'secondary';
  };

  // Format discount display
  const formatDiscount = (discount: number, discountType: string): string => {
    if (discountType === 'PERCENTAGE') {
      return `${discount.toFixed(0)}% ${getText('shop.b2b.off', 'off')}`;
    } else if (discountType === 'FIXED_AMOUNT') {
      return `${formatCurrency(discount)} ${getText('shop.b2b.off', 'off')}`;
    }
    return `${getText('shop.b2b.specialPrice', 'Special Price')}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            {getText('shop.b2b.tieredPricing', 'Volume Pricing')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState type="spinner" message={getText('common.actions.loading', 'Loading pricing...')} />
        </CardContent>
      </Card>
    );
  }

  if (tiers.length === 0) {
    return null; // Don't show card if no tiered pricing is available
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          {getText('shop.b2b.tieredPricing', 'Volume Pricing')}
        </CardTitle>
        <CardDescription>
          {getText('shop.b2b.tieredPricingDescription', 'Save more when you buy in bulk')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">
                  {getText('shop.b2b.quantity', 'Quantity')}
                </TableHead>
                <TableHead>{getText('shop.b2b.pricePerUnit', 'Price/Unit')}</TableHead>
                <TableHead>{getText('shop.b2b.discount', 'Discount')}</TableHead>
                <TableHead className="text-right">
                  {getText('shop.b2b.savings', 'You Save')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((tier, index) => (
                <TableRow key={tier.ruleId + '-' + index}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      {formatQuantityRange(tier.minQuantity, tier.maxQuantity)}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrency(tier.pricePerUnit)}
                  </TableCell>
                  <TableCell>
                    {tier.discount > 0 ? (
                      <Badge variant={getDiscountVariant(tier.discount)}>
                        {formatDiscount(tier.discount, tier.discountType)}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {getText('shop.b2b.regularPrice', 'Regular')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {tier.totalSavings > 0 ? (
                      <span className="font-semibold text-green-600">
                        {formatCurrency(tier.totalSavings)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Additional info */}
        <div className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
          <TrendingDown className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>
            {getText(
              'shop.b2b.tieredPricingNote',
              'Prices automatically adjust based on your order quantity. Higher quantities unlock better rates.'
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
