'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Trash2,
  Plus,
  Minus,
  Loader2,
  AlertCircle,
  X,
  ShieldCheck,
  Zap,
  ArrowRight,
  ShoppingBag,
} from 'lucide-react';
import { AuthGuard } from '../../../components/AuthGuard';
import { cartApi, type Cart } from '../../../lib/api';
import { formatVariantNameWithBillingPeriod } from '../../../lib/esim';
import { cn } from '../../../lib/utils';

function CartContent() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';

  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCart() {
      setIsLoading(true);
      setError(null);
      try {
        const cartData = await cartApi.getCart();
        setCart(cartData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cart');
      } finally {
        setIsLoading(false);
      }
    }
    fetchCart();
  }, []);

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return handleRemoveItem(itemId);
    setUpdatingItem(itemId);
    try {
      const updatedCart = await cartApi.updateCartItem(itemId, newQuantity);
      setCart(updatedCart);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update quantity');
    } finally {
      setUpdatingItem(null);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    setUpdatingItem(itemId);
    try {
      const updatedCart = await cartApi.removeFromCart(itemId);
      setCart(updatedCart);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item');
    } finally {
      setUpdatingItem(null);
    }
  };

  const handleClearCart = async () => {
    if (!confirm('Remove all items from cart?')) return;
    setIsLoading(true);
    try {
      const updatedCart = await cartApi.clearCart();
      setCart(updatedCart);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear cart');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
          <p className="font-mono text-xs text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="font-mono text-xs uppercase tracking-widest text-muted-foreground border border-border px-4 py-2 hover:border-foreground hover:text-foreground transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <ShoppingBag className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
          <p className="font-bold text-sm text-foreground uppercase tracking-tight mb-1">Your cart is empty</p>
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-8">No items added yet.</p>
          <button
            onClick={() => router.push(`/${locale}/products`)}
            className="font-mono text-sm uppercase tracking-widest px-6 py-3 bg-primary text-primary-foreground border border-border hover:bg-muted hover:text-foreground transition-all inline-flex items-center gap-2"
          >
            Browse Plans <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 transition-colors duration-300">
      <div className="network-grid-bg"></div>
      <div className="container mx-auto px-4 lg:px-8 max-w-5xl pt-28">

        {/* Header row */}
        <div className="flex items-center justify-between pb-5 border-b border-border mb-0">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-foreground uppercase tracking-tight">Cart</h1>
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
              {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <button
            onClick={handleClearCart}
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear All
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-10 items-start">

          {/* Item list */}
          <div className="lg:col-span-7 divide-y divide-border">
            {cart.items.map((item) => {
              const variantDisplayName = formatVariantNameWithBillingPeriod(
                item.variantName,
                item.variantAttributes
              );
              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-4 py-4 transition-opacity',
                    updatingItem === item.id && 'opacity-40 pointer-events-none'
                  )}
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 bg-muted flex-shrink-0 overflow-hidden">
                    <img
                      src={item.productImage || '/placeholder-product.svg'}
                      alt={item.productName}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground uppercase tracking-tight leading-tight truncate">
                      {item.productName}
                    </p>
                    {variantDisplayName && (
                      <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5 truncate">
                        {variantDisplayName}
                      </p>
                    )}
                  </div>

                  {/* Qty stepper */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                      disabled={updatingItem === item.id}
                      className="w-7 h-7 flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground hover:bg-border transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center font-mono text-xs text-foreground">{item.quantity}</span>
                    <button
                      onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                      disabled={updatingItem === item.id || item.quantity >= item.maxQuantity}
                      className="w-7 h-7 flex items-center justify-center bg-muted text-muted-foreground hover:text-foreground hover:bg-border transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Price */}
                  <div className="text-right flex-shrink-0 w-20">
                    <p className="text-sm font-bold text-foreground">${item.subtotal.toFixed(2)}</p>
                    {item.quantity > 1 && (
                      <p className="font-mono text-[10px] text-muted-foreground">${item.price.toFixed(2)} ea</p>
                    )}
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            {/* Out of stock warnings */}
            {cart.items.filter(i => i.maxQuantity <= 0).map(item => (
              <div key={`warn-${item.id}`} className="flex items-center gap-2 py-3">
                <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                  "{item.productName}" is out of stock — remove to continue.
                </p>
              </div>
            ))}

            {/* Add more link */}
            <div className="py-4">
              <button
                onClick={() => router.push(`/${locale}/products`)}
                className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3 h-3" /> Add Another Plan
              </button>
            </div>
          </div>

          {/* Order summary */}
          <div className="lg:col-span-5 lg:sticky lg:top-28 mt-6 lg:mt-0">
            <div className="border border-border">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Order Summary</h2>
              </div>

              <div className="px-5 py-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Subtotal</span>
                  <span className="font-bold text-sm text-foreground">${cart.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Delivery</span>
                  <span className="font-mono text-xs text-muted-foreground uppercase">Free</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Tax</span>
                  <span className="font-bold text-sm text-foreground">${cart.tax.toFixed(2)}</span>
                </div>
              </div>

              {/* Total */}
              <div className="px-5 py-4 border-t border-border flex justify-between items-center">
                <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Total</span>
                <span className="text-xl font-bold text-foreground">${cart.total.toFixed(2)}</span>
              </div>

              {/* CTA */}
              <div className="px-5 pb-5">
                <button
                  onClick={() => router.push(`/${locale}/checkout`)}
                  className="w-full font-mono text-sm uppercase tracking-widest py-3.5 bg-primary text-primary-foreground border border-border hover:bg-muted hover:text-foreground transition-all flex items-center justify-center gap-2"
                >
                  Checkout <Zap className="w-4 h-4" />
                </button>
                <div className="flex items-center justify-center gap-1.5 mt-3 text-muted-foreground">
                  <ShieldCheck className="w-3 h-3" />
                  <span className="font-mono text-[10px] uppercase tracking-widest">SSL encrypted</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  return (
    <AuthGuard>
      <CartContent />
    </AuthGuard>
  );
}
