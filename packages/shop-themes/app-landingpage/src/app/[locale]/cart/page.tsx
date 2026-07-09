'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuthGuard } from '../../../components/AuthGuard';
import { cartApi, type Cart, type CartItem } from '../../../lib/api';

function CartContent() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';

  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);

  // Fetch cart from Core API
  useEffect(() => {
    async function fetchCart() {
      setIsLoading(true);
      setError(null);
      try {
        const cartData = await cartApi.getCart();
        setCart(cartData);
      } catch (err) {
        console.error('Failed to fetch cart:', err);
        setError(err instanceof Error ? err.message : 'Failed to load cart');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCart();
  }, []);

  // Handle update quantity
  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      return handleRemoveItem(itemId);
    }

    setUpdatingItem(itemId);
    try {
      const updatedCart = await cartApi.updateCartItem(itemId, newQuantity);
      setCart(updatedCart);
    } catch (err) {
      console.error('Failed to update quantity:', err);
      setError(err instanceof Error ? err.message : 'Failed to update quantity');
    } finally {
      setUpdatingItem(null);
    }
  };

  // Handle remove item
  const handleRemoveItem = async (itemId: string) => {
    setUpdatingItem(itemId);
    try {
      const updatedCart = await cartApi.removeFromCart(itemId);
      setCart(updatedCart);
    } catch (err) {
      console.error('Failed to remove item:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove item');
    } finally {
      setUpdatingItem(null);
    }
  };

  // Handle clear cart
  const handleClearCart = async () => {
    if (!confirm('Are you sure you want to clear your cart?')) return;

    setIsLoading(true);
    try {
      const updatedCart = await cartApi.clearCart();
      setCart(updatedCart);
    } catch (err) {
      console.error('Failed to clear cart:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear cart');
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate to checkout
  const handleCheckout = () => {
    router.push(`/${locale}/checkout`);
  };

  // Continue shopping
  const handleContinueShopping = () => {
    router.push(`/${locale}/products`);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-24 h-24 bg-gray-200 rounded"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error loading cart</h1>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Empty cart
  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="bg-white rounded-lg shadow-md p-12">
              <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
              <p className="text-gray-600 mb-8">Looks like you haven't added any items yet</p>
              <button
                onClick={handleContinueShopping}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Start Shopping
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Shopping Cart ({cart.itemCount} items)
            </h1>
            <button
              onClick={handleClearCart}
              className="text-red-600 hover:text-red-700 text-sm font-medium"
            >
              Clear Cart
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cart.items.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white rounded-lg shadow-md p-6 ${updatingItem === item.id ? 'opacity-50' : ''}`}
                >
                  <div className="flex gap-4">
                    {/* Product Image */}
                    <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={item.productImage || '/placeholder-product.svg'}
                        alt={item.productName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder-product.svg';
                        }}
                      />
                    </div>

                    {/* Product Info */}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{item.productName}</h3>
                      {item.variantName && (
                        <p className="text-sm text-gray-500 mb-2">{item.variantName}</p>
                      )}
                      <p className="text-lg font-bold text-blue-600">${item.price.toFixed(2)}</p>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-4 mt-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                            disabled={updatingItem === item.id}
                            className="w-8 h-8 rounded border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                            disabled={updatingItem === item.id || item.quantity >= item.maxQuantity}
                            className="w-8 h-8 rounded border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={updatingItem === item.id}
                          className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Item Subtotal */}
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        ${item.subtotal.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Availability Warning - stock check via maxQuantity */}
                  {item.maxQuantity <= 0 && (
                    <div className="mt-4 p-3 bg-red-50 rounded-lg">
                      <p className="text-red-600 text-sm">This item is no longer available</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h2>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>${cart.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span>{cart.shipping > 0 ? `$${cart.shipping.toFixed(2)}` : 'Free'}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Tax</span>
                    <span>${cart.tax.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex justify-between text-xl font-bold text-gray-900">
                      <span>Total</span>
                      <span>${cart.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition"
                >
                  Proceed to Checkout
                </button>

                <button
                  onClick={handleContinueShopping}
                  className="w-full mt-4 text-blue-600 font-medium hover:underline"
                >
                  Continue Shopping
                </button>
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
