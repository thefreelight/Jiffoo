import React from 'react';
import { cents, money, saleUnitPrice, type Sale } from '../lib/sale';

/**
 * A price under a promotion: the sale price, the list price struck through
 * next to it, and the difference. Without a sale it is the plain price.
 * With a quantity it prices the line: sale unit price times quantity, as the
 * checkout bills it.
 */
export const SalePrice = React.memo(function SalePrice({ unitPrice, quantity, sale }: { unitPrice: number; quantity?: number; sale: Sale | null }) {
  const count = Math.max(1, Math.floor(Number(quantity) || 1));
  const unit = Number(Number.isFinite(unitPrice) ? unitPrice : 0);
  const list = cents(unit * count);
  if (!sale) return <span data-purpose="price">{money(list)}</span>;
  return (
    <span className="bokmoo-sale" data-purpose="sale-price">
      <span className="bokmoo-sale-now">{money(cents(saleUnitPrice(sale, unit) * count))}</span>
      <s className="bokmoo-sale-was">{money(list)}</s>
      <span className="bokmoo-sale-badge">
        {sale.discountType === 'percent' ? `-${Math.round(sale.discountValue)}%` : 'SALE'}
      </span>
    </span>
  );
});
