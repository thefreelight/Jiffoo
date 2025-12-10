'use client';

import { forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../../utils/cn';
import { prefersReducedMotion } from '../../utils/a11y';

export type CardBadge = 'NEW' | 'SALE' | 'HOT';
export type CardAspectRatio = 'square' | 'portrait' | 'landscape';

export interface ProductCardProps extends Omit<HTMLMotionProps<'div'>, 'title'> {
  image?: string;
  title: string;
  description?: string;
  price: number;
  originalPrice?: number;
  badge?: CardBadge;
  aspectRatio?: CardAspectRatio;
  currency?: string;
  onAddToCart?: () => void;
}

const aspectRatioStyles: Record<CardAspectRatio, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[4/5]',
  landscape: 'aspect-video',
};

const badgeStyles: Record<CardBadge, string> = {
  NEW: 'bg-blue-50 text-blue-600',
  SALE: 'bg-red-50 text-red-600',
  HOT: 'bg-orange-50 text-orange-600',
};

export const ProductCard = forwardRef<HTMLDivElement, ProductCardProps>(
  (
    {
      image,
      title,
      description,
      price,
      originalPrice,
      badge,
      aspectRatio = 'portrait',
      currency = '¥',
      onAddToCart,
      className,
      ...props
    },
    ref
  ) => {
    const reducedMotion = prefersReducedMotion();

    return (
      <motion.div
        ref={ref}
        initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
        whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true }}
        whileHover={reducedMotion ? undefined : { y: -8 }}
        transition={{ duration: 0.3, ease: [0.0, 0.0, 0.2, 1] }}
        className={cn('group cursor-pointer', className)}
        {...props}
      >
        {/* Image Container */}
        <div
          className={cn(
            'bg-slate-50 rounded-2xl mb-4 overflow-hidden relative',
            'shadow-sm transition-all duration-normal',
            'group-hover:shadow-card-hover',
            'border border-transparent group-hover:border-blue-100',
            aspectRatioStyles[aspectRatio]
          )}
        >
          {image ? (
            <img
              src={image}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-slow group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-100 to-white" />
          )}

          {/* Badge */}
          {badge && (
            <div
              className={cn(
                'absolute top-3 right-3',
                'bg-white/90 backdrop-blur px-2.5 py-1 rounded-full',
                'text-xs font-bold shadow-sm',
                badgeStyles[badge]
              )}
            >
              {badge}
            </div>
          )}

          {/* Hover Overlay */}
          <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-normal" />
        </div>

        {/* Content */}
        <h3 className="text-base font-semibold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors line-clamp-2">
          {title}
        </h3>

        {description && (
          <p className="text-slate-500 text-sm mb-2 line-clamp-2">{description}</p>
        )}

        {/* Price and Action */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-900">
              {currency}{price.toLocaleString()}
            </span>
            {originalPrice && (
              <span className="text-sm text-slate-400 line-through">
                {currency}{originalPrice.toLocaleString()}
              </span>
            )}
          </div>

          {onAddToCart && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart();
              }}
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                'bg-blue-50 text-blue-600',
                'hover:bg-blue-600 hover:text-white',
                'transition-all duration-fast shadow-sm hover:shadow-brand-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'
              )}
              aria-label={`Add ${title} to cart`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
      </motion.div>
    );
  }
);

ProductCard.displayName = 'ProductCard';

