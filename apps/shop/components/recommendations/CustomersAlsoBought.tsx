/**
 * CustomersAlsoBought Component
 *
 * Displays "Customers Also Bought" product recommendations on product detail pages.
 * Uses collaborative filtering to show products frequently purchased together.
 */

'use client';

import * as React from 'react';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useCartStore } from '@/store/cart';
import { useToast } from '@/hooks/use-toast';
import { RecommendationsService, RecommendedProduct } from '@/services/recommendations.service';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/state-components';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useT } from 'shared/src/i18n/react';
import { cn } from '@/lib/utils';
import { ShoppingCart } from 'lucide-react';

interface CustomersAlsoBoughtProps {
  productId: string;
  limit?: number;
  excludeProductIds?: string[];
  className?: string;
}

export function CustomersAlsoBought({
  productId,
  limit = 8,
  excludeProductIds = [],
  className
}: CustomersAlsoBoughtProps) {
  const nav = useLocalizedNavigation();
  const { addToCart } = useCartStore();
  const { toast } = useToast();
  const t = useT();

  const [recommendations, setRecommendations] = React.useState<RecommendedProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const fetchedRef = React.useRef(false);

  // Stabilize excludeProductIds reference to prevent infinite useEffect loop
  const excludeKey = excludeProductIds.join(',');
  const stableExcludeIds = React.useMemo(() => excludeProductIds, [excludeKey]);

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Load recommendations
  React.useEffect(() => {
    if (fetchedRef.current) return;
    const loadRecommendations = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await RecommendationsService.getCustomersAlsoBought(
          productId,
          limit,
          stableExcludeIds
        );

        setRecommendations(response.products);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recommendations');
        console.error('Failed to load recommendations:', err);
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchedRef.current = true;
      loadRecommendations();
    }
  }, [productId, limit, stableExcludeIds]);

  // Handle product click - track interaction and navigate
  const handleProductClick = async (recommendedProduct: RecommendedProduct) => {
    try {
      // Track the click interaction
      await RecommendationsService.trackInteraction({
        productId: recommendedProduct.productId,
        action: 'click',
        recommendationType: 'customers-also-bought',
        sourceProductId: productId,
      });
    } catch (err) {
      console.error('Failed to track interaction:', err);
    }

    // Navigate to product page
    nav.push(`/products/${recommendedProduct.productId}`);
  };

  // Handle add to cart
  const handleAddToCart = async (recommendedProduct: RecommendedProduct, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent product click navigation

    try {
      await addToCart(recommendedProduct.productId, 1, '');

      // Track the add-to-cart interaction
      await RecommendationsService.trackInteraction({
        productId: recommendedProduct.productId,
        action: 'add-to-cart',
        recommendationType: 'customers-also-bought',
        sourceProductId: productId,
      });

      toast({
        title: getText('shop.cart.itemAdded', 'Added to cart'),
        description: recommendedProduct.name,
      });
    } catch (err) {
      console.error('Failed to add to cart:', err);
      toast({
        title: getText('shop.cart.addFailed', 'Failed to add item'),
        description: err instanceof Error ? err.message : getText('common.errors.unknown', 'Unknown error'),
        variant: 'destructive',
      });
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className={cn('py-8', className)}>
        <LoadingState
          type="spinner"
          message={getText('shop.recommendations.loading', 'Loading recommendations...')}
          size="md"
        />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('py-8', className)}>
        <ErrorState
          title={getText('shop.recommendations.errorTitle', 'Unable to load recommendations')}
          message={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  // Empty state - no recommendations
  if (recommendations.length === 0) {
    return null; // Don't show anything if there are no recommendations
  }

  // Render recommendations grid
  return (
    <div className={cn('py-8', className)}>
      {/* Section header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {getText('shop.recommendations.customersAlsoBought', 'Customers Also Bought')}
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {getText('shop.recommendations.customersAlsoBoughtDescription', 'Based on what other customers purchased')}
        </p>
      </div>

      {/* Recommendations grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {recommendations.map((product) => (
          <Card
            key={product.productId}
            className="group cursor-pointer hover:shadow-lg transition-shadow duration-200"
            onClick={() => handleProductClick(product)}
          >
            <CardContent className="p-4">
              {/* Product image */}
              <div className="aspect-square relative mb-3 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <ShoppingCart className="w-12 h-12" />
                  </div>
                )}
              </div>

              {/* Product info */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 min-h-[2.5rem]">
                  {product.name}
                </h3>

                <div className="flex items-center justify-between">
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    ${product.price.toFixed(2)}
                  </p>
                  {product.stock > 0 ? (
                    <span className="text-xs text-green-600 dark:text-green-400">
                      {getText('shop.product.inStock', 'In Stock')}
                    </span>
                  ) : (
                    <span className="text-xs text-red-600 dark:text-red-400">
                      {getText('shop.product.outOfStock', 'Out of Stock')}
                    </span>
                  )}
                </div>

                {/* Recommendation reason */}
                {product.reason && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                    {product.reason}
                  </p>
                )}

                {/* Add to cart button */}
                <Button
                  size="sm"
                  type="button"
                  className={cn('w-full mt-2', product.stock === 0 && 'cursor-not-allowed opacity-50')}
                  aria-disabled={product.stock === 0}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (product.stock === 0) return;
                    void handleAddToCart(product, e);
                  }}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {getText('shop.product.addToCart', 'Add to Cart')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default CustomersAlsoBought;
