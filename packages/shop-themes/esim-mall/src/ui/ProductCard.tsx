/**
 * Product Card Component
 * Hardcore digital network infrastructure style
 */

import React from 'react';
import { Activity, ShieldCheck, Cpu } from 'lucide-react';
import { Button } from './Button';
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
  showWishlist = true,
  onAddToCart,
  onClick,
}: ProductCardProps) {
  let imageUrl = '/placeholder-product.svg';
  if (product.images && product.images.length > 0) {
    const firstImage = product.images[0];
    if (typeof firstImage === 'string') {
      imageUrl = firstImage;
    } else if (firstImage && typeof firstImage === 'object' && 'url' in firstImage) {
      imageUrl = firstImage.url;
    }
  }

  const stockValue = (product as any).stock ?? product.inventory?.available ?? product.inventory?.quantity ?? 0;
  const isOutOfStock = product.inventory?.isInStock === false || stockValue <= 0;
  const availableStock = product.inventory?.available ?? stockValue;
  const handleActionClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    onAddToCart();
  };

  const hasDiscount = product.originalPrice && product.originalPrice > product.price;

  if (viewMode === 'list') {
    return (
      <div
        onClick={onClick}
        className="group flex flex-col md:flex-row gap-6 p-4 bg-[#141414] border border-[#2a2a2a] hover:border-[var(--c-eae)] transition-colors duration-300 cursor-pointer w-full relative"
      >
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[var(--c-eae)] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[var(--c-eae)] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

        {/* Image */}
        <div className="relative w-full md:w-48 h-48 md:h-auto flex-shrink-0 bg-[#0f0f0f] border border-[#2a2a2a] overflow-hidden">
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-500"
          />
          {isOutOfStock && (
            <div className="absolute inset-0 bg-[#0f0f0f] bg- flex items-center justify-center flex-col">
              <span className="text-[#bdbdbd] font-mono text-xs uppercase tracking-widest">[ UNAVAILABLE ]</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col py-2">
          <div className="font-mono text-[10px] text-[#bdbdbd] uppercase tracking-widest mb-2 flex items-center gap-2">
            <Cpu className="w-3 h-3" /> {(product as any).category || 'NODE_PROTOCOL'}
          </div>

          <h3 className="text-xl font-bold text-[#eaeaea] uppercase tracking-wide mb-2">
            {product.name}
          </h3>

          {product.description && (
            <p className="text-sm text-[#bdbdbd] font-light mt-2 line-clamp-2 max-w-2xl">
              {product.description}
            </p>
          )}

          <div className="mt-auto pt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-mono font-bold text-[#eaeaea]">${product.price.toFixed(2)}</span>
              {hasDiscount && (
                <span className="text-sm font-mono text-[#bdbdbd] line-through">
                  ${product.originalPrice?.toFixed(2)}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleActionClick}
              aria-disabled={isOutOfStock}
              className={cn(
                "px-6 py-2 border font-mono text-xs uppercase tracking-widest transition-all",
                isOutOfStock
                  ? "border-[#2a2a2a] text-[#bdbdbd]  cursor-not-allowed bg-transparent"
                  : "border-[var(--c-eae)] text-[var(--c-000)] bg-[var(--c-eae)] hover:bg-[var(--c-fff)] hover:border-[var(--c-fff)] flex items-center gap-2"
              )}
            >
              {!isOutOfStock && <Activity className="w-3 h-3" />}
              {isOutOfStock ? 'OFFLINE' : 'INITIALIZE'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group h-full flex flex-col bg-[#141414] border border-[#2a2a2a] hover:border-[var(--c-eae)] transition-colors duration-300 cursor-pointer overflow-hidden p-3 relative"
      onClick={onClick}
    >
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[var(--c-eae)] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[var(--c-eae)] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

      {/* Image - fixed height container */}
      <div className="relative w-full h-56 flex-shrink-0 bg-[#0f0f0f] border border-[#2a2a2a] overflow-hidden mb-4">
        <div className="absolute inset-0 border border-[#2a2a2a] pointer-events-none z-10 mix-blend-overlay"></div>

        <img
          src={imageUrl}
          alt={product.name}
          className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-500 scale-100 group-hover:scale-105"
        />

        {/* Overlay graphic for tech feel */}
        <div className="absolute inset-0 bg-[#0f0f0f] group-hover:opacity-0 transition-opacity duration-300"></div>

        {/* Badges */}
        <div className="absolute top-0 w-full flex justify-between p-2 z-20">
          <div className="font-mono text-[10px] bg-[#0f0f0f]/80 backdrop-blur-sm border border-[#2a2a2a] px-2 py-1 text-[#bdbdbd] uppercase">
            ID:{product.id.slice(0, 6)}
          </div>
          {isOutOfStock && (
            <div className="font-mono text-[10px] bg-[#0f0f0f]/80 backdrop-blur-sm border border-[#2a2a2a] px-2 py-1 text-[#bdbdbd] uppercase">
              ERR_NODES_FULL
            </div>
          )}
        </div>
      </div>

      {/* Product info */}
      <div className="flex-1 flex flex-col px-1 pb-1">
        <div className="font-mono text-[10px] text-[#bdbdbd] uppercase tracking-widest mb-1">
          PROTOCOL // {(product as any).category || 'GENERAL'}
        </div>

        <h3 className="font-bold text-lg text-[#eaeaea] group-hover:text-[#bdbdbd] transition-colors line-clamp-2 uppercase leading-tight mb-3">
          {product.name}
        </h3>

        {/* Price - push to bottom */}
        <div className="mt-auto border-t border-[#2a2a2a] pt-3 mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-mono font-bold text-[#eaeaea]">${product.price.toFixed(2)}</span>
            {hasDiscount && (
              <span className="text-xs font-mono text-[#bdbdbd] line-through">
                ${product.originalPrice?.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Action button */}
        <button
          type="button"
          onClick={handleActionClick}
          aria-disabled={isOutOfStock}
          className={cn(
            "w-full py-2.5 border font-mono text-xs uppercase tracking-widest transition-all",
            isOutOfStock
              ? "border-[#2a2a2a] text-[#bdbdbd]  cursor-not-allowed bg-[#1c1c1c]"
              : "border-[var(--c-eae)] text-[var(--c-000)] bg-[var(--c-eae)] hover:bg-[var(--c-fff)] hover:border-[var(--c-fff)] flex items-center justify-center gap-2"
          )}
        >
          {!isOutOfStock && <Activity className="w-3 h-3" />}
          {isOutOfStock ? 'CAPACITY_REACHED' : 'INITIALIZE'}
        </button>
      </div>
    </div>
  );
});
