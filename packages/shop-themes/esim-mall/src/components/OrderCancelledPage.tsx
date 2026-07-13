/**
 * Order Cancelled Page — TravelPass Design
 * eSIM-themed payment cancellation with support options.
 */

import React from 'react';
import type { OrderCancelledPageProps } from '../types';

export const OrderCancelledPage = React.memo(function OrderCancelledPage({
  config,
  onReturnToCart,
  onContinueShopping,
  onContactSupport,
}: OrderCancelledPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 pt-28 pb-12">
        <div className="max-w-2xl mx-auto text-center">
          {/* Cancelled Icon */}
          <div className="mb-8">
            <div className="w-24 h-24 rounded-full bg-yellow-100 flex items-center justify-center mx-auto">
              <i className="fas fa-times-circle text-yellow-600 text-5xl" />
            </div>
          </div>

          {/* Title */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-yellow-600 mb-3">Payment Cancelled</h1>
            <p className="text-lg text-gray-600">
              Your payment was cancelled. No charges were made to your account.
            </p>
          </div>

          {/* Information Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="space-y-4 text-left">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-shopping-cart text-blue-600 text-sm" />
                </div>
                <div>
                  <p className="font-medium text-gray-800 mb-1">Your cart is still saved</p>
                  <p className="text-sm text-gray-600">
                    All eSIM packages remain in your cart and you can complete your purchase anytime
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-headset text-purple-600 text-sm" />
                </div>
                <div>
                  <p className="font-medium text-gray-800 mb-1">Need help?</p>
                  <p className="text-sm text-gray-600">
                    If you encountered any issues during checkout, our support team is available 24/7
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* What Happened */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">What Happened?</h2>
            <p className="text-gray-600 text-left mb-4">
              You cancelled the payment process before completing your eSIM order. This could happen if you:
            </p>
            <ul className="text-left text-gray-600 space-y-2 list-disc list-inside">
              <li>Clicked the back button during checkout</li>
              <li>Closed the payment window</li>
              <li>Decided to review your eSIM selection again</li>
              <li>Encountered a technical issue</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onReturnToCart}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md px-6 py-3 transition-colors"
            >
              <i className="fas fa-shopping-cart mr-2" />
              Return to Cart
            </button>

            <button
              onClick={onContinueShopping}
              className="border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-md px-6 py-3 transition-colors"
            >
              <i className="fas fa-arrow-left mr-2" />
              Browse Packages
            </button>
          </div>

          {/* Help Section */}
          {onContactSupport && (
            <div className="mt-8 text-sm text-gray-500">
              <p>
                Need assistance?{' '}
                <button
                  onClick={onContactSupport}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Contact Support
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
