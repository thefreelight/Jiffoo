import React from 'react';
import { ArrowRight, CheckCircle2, PackageCheck } from 'lucide-react';
import { getPlanDisplay } from '../lib/plan-display';
import { cn } from '../lib/utils';
import type { Product } from '../types';

export interface ProductCardProps {
  product: Product;
  viewMode?: 'grid' | 'list';
  showWishlist?: boolean;
  onAddToCart: () => void;
  onClick: () => void;
}

export const ProductCard = React.memo(function ProductCard({
  product,
  viewMode = 'grid',
  onAddToCart,
  onClick,
}: ProductCardProps) {
  const plan = getPlanDisplay(product);
  const stockValue = (product as any).stock ?? product.inventory?.available ?? product.inventory?.quantity ?? 1;
  const isOutOfStock = product.inventory?.isInStock === false || stockValue <= 0;

  const handleActionClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isOutOfStock) {
      onAddToCart();
    }
  };

  if (viewMode === 'list') {
    return (
      <article
        onClick={onClick}
        className="group grid cursor-pointer gap-5 rounded-[18px] border border-[#d7e8ff] bg-white p-3 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#b7d6ff] hover:shadow-[0_18px_44px_rgb(15_23_42_/_0.09)] md:grid-cols-[240px_1fr]"
      >
        <img src={plan.image} alt={plan.title} className="h-52 w-full rounded-[14px] object-cover" />
        <div className="flex flex-col justify-between p-3">
          <div>
            <span className="rounded-full border border-[#b7d6ff] bg-[#eaf4ff] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.04em] text-[#0b4eb8]">
              {plan.badge}
            </span>
            <h3 className="mt-3 text-3xl font-black leading-tight tracking-[-0.055em] text-[#071d49]">{plan.title}</h3>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#52657f]">{plan.summary}</p>
          </div>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <PlanFacts plan={plan} />
            <PriceAction priceLabel={plan.priceLabel} isOutOfStock={isOutOfStock} onClick={handleActionClick} />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      onClick={onClick}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-[16px] border border-[#d7e8ff] bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#b7d6ff] hover:shadow-[0_18px_44px_rgb(15_23_42_/_0.09)]"
    >
      <div className="relative overflow-hidden">
        <img src={plan.image} alt={plan.title} className="h-[176px] w-full object-cover transition duration-500 group-hover:scale-105" />
        <span className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.04em] text-[#0b4eb8] backdrop-blur">
          {plan.badge}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-lg font-black tracking-[-0.04em] text-[#071d49]">{plan.title}</h3>
        <p className="mt-1 text-xs font-semibold text-[#6b7b94]">
          {plan.country} • {plan.data} • {plan.validity}
        </p>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#52657f]">{plan.summary}</p>
        <PlanFacts plan={plan} className="mt-4" />
        <div className="mt-auto pt-5">
          <PriceAction priceLabel={plan.priceLabel} isOutOfStock={isOutOfStock} onClick={handleActionClick} fullWidth />
        </div>
      </div>
    </article>
  );
});

function PlanFacts({ plan, className }: { plan: ReturnType<typeof getPlanDisplay>; className?: string }) {
  return (
    <div className={cn('grid gap-2 text-xs font-semibold text-[#6b7b94]', className)}>
      <span className="flex items-center gap-2">
        <PackageCheck className="h-4 w-4 text-[#31557f]" />
        {plan.network}
      </span>
      <span className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-[#31557f]" />
        Instant QR delivery
      </span>
    </div>
  );
}

function PriceAction({
  priceLabel,
  isOutOfStock,
  onClick,
  fullWidth = false,
}: {
  priceLabel: string;
  isOutOfStock: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  fullWidth?: boolean;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4', fullWidth && 'w-full')}>
      <span className="text-lg font-black text-[#1167e8]">{priceLabel}</span>
      <button
        type="button"
        onClick={onClick}
        aria-disabled={isOutOfStock}
        className={cn(
          'inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-black transition',
          isOutOfStock
            ? 'cursor-not-allowed border border-[#d7e8ff] text-[#8ba0ba]'
            : 'bg-[#1167e8] text-white shadow-[0_12px_24px_rgb(23_107_255_/_0.22)] hover:bg-[#0b4eb8]',
          fullWidth && 'min-w-28',
        )}
      >
        {isOutOfStock ? 'Unavailable' : 'Add'}
        {!isOutOfStock ? <ArrowRight className="h-4 w-4" /> : null}
      </button>
    </div>
  );
}
