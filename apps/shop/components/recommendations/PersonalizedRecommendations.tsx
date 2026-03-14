/**
 * PersonalizedRecommendations Component
 *
 * Displays personalized product recommendations on the homepage.
 * Uses machine learning to show products based on user purchase history and browsing behavior.
 */

'use client';

import * as React from 'react';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import { RecommendationsService, RecommendedProduct } from '@/services/recommendations.service';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/state-components';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useT } from 'shared/src/i18n/react';
import { cn } from '@/lib/utils';
import { ShoppingCart, Sparkles } from 'lucide-react';

interface PersonalizedRecommendationsProps {
  limit?: number;
  excludeProductIds?: string[];
  className?: string;
}

// Generate or retrieve session ID for anonymous users
const getSessionId = (): string => {
  if (typeof window === 'undefined') return '';

  const storageKey = 'recommendations-session-id';
  let sessionId = sessionStorage.getItem(storageKey);

  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem(storageKey, sessionId);
  }

  return sessionId;
};

export function PersonalizedRecommendations({
  limit = 8,
  excludeProductIds = [],
  className
}: PersonalizedRecommendationsProps) {
  const nav = useLocalizedNavigation();
  const { addToCart } = useCartStore();
  // Use selectors to avoid re-renders on unrelated auth store changes
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const userId = useAuthStore(state => state.user?.id);
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

  // Load personalized recommendations (once)
  React.useEffect(() => {
    if (fetchedRef.current && recommendations.length > 0) return;

    const loadRecommendations = async () => {
      try {
        if (recommendations.length === 0) {
          setLoading(true);
        }
        setError(null);

        const sessionId = !userId ? getSessionId() : undefined;

        const response = await RecommendationsService.getHomepageRecommendations(
          userId,
          sessionId,
          limit
        );

        // Filter out excluded products (if any)
        const filteredProducts = stableExcludeIds.length > 0
          ? response.products.filter(p => !stableExcludeIds.includes(p.productId))
          : response.products;

        setRecommendations(filteredProducts);
        fetchedRef.current = true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recommendations');
        console.error('Failed to load recommendations:', err);
      } finally {
        setLoading(false);
      }
    };

    loadRecommendations();
  }, [userId, limit, stableExcludeIds]);

  // Handle product click - track interaction and navigate
  const handleProductClick = async (recommendedProduct: RecommendedProduct) => {
    try {
      // Get userId or sessionId for tracking
      const trackUserId = userId || undefined;
      const sessionId = !trackUserId ? getSessionId() : undefined;

      // Track the click interaction
      await RecommendationsService.trackInteraction({
        userId: trackUserId,
        sessionId,
        productId: recommendedProduct.productId,
        action: 'click',
        recommendationType: 'personalized',
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

      // Get userId or sessionId for tracking
      const trackUserId = userId || undefined;
      const sessionId = !trackUserId ? getSessionId() : undefined;

      // Track the add-to-cart interaction
      await RecommendationsService.trackInteraction({
        userId: trackUserId,
        sessionId,
        productId: recommendedProduct.productId,
        action: 'add-to-cart',
        recommendationType: 'personalized',
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
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-6 h-6 text-yellow-500 dark:text-yellow-400" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isAuthenticated
              ? getText('shop.recommendations.personalizedForYou', 'Recommended For You')
              : getText('shop.recommendations.popularProducts', 'Popular Products')}
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {isAuthenticated
            ? getText('shop.recommendations.personalizedDescription', 'Based on your interests and shopping history')
            : getText('shop.recommendations.popularDescription', 'Trending products you might like')}
        </p>
      </div>

      {/* Recommendations grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {recommendations.map((product, index) => (
          <Card
            key={`${product.productId}-${index}`}
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

export default PersonalizedRecommendations;
