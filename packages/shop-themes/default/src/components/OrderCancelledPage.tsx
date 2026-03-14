/**
 * Order Cancelled Page Component - Admin Style Design
 */

import React from 'react';
import { XCircle, ArrowLeft, ShoppingCart, HelpCircle } from 'lucide-react';
import type { OrderCancelledPageProps } from '../../../../shared/src/types/theme';

export function OrderCancelledPage({
  config,
  onReturnToCart,
  onContinueShopping,
  onContactSupport,
}: OrderCancelledPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto text-center">
          {/* Cancelled Icon */}
          <div className="mb-8">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 flex items-center justify-center mx-auto shadow-sm">
              <XCircle className="h-12 w-12 sm:h-14 sm:w-14 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>

          {/* Title */}
          <div className="mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-full mb-4">
              <div className="w-2 h-2 bg-yellow-600 dark:bg-yellow-400 rounded-full" />
              <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-widest">PAYMENT CANCELLED</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">Payment Cancelled</h1>
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">NO CHARGES WERE MADE TO YOUR ACCOUNT</p>
          </div>

          {/* Information Card */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 sm:p-8 mb-6 sm:mb-8">
            <div className="space-y-4 text-left">
              <div className="flex items-start gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-1">CART SAVED</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    All items remain in your cart and you can complete your purchase anytime
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-100 dark:border-purple-800">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                  <HelpCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-1">NEED HELP?</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    If you encountered any issues during checkout, please contact our support team
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* What Happened */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 sm:p-8 mb-6 sm:mb-8">
            <div className="flex items-center gap-2 mb-6 justify-center">
              <div className="h-4 w-1 bg-blue-600 rounded-full" />
              <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">WHAT HAPPENED</h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-left mb-4">
              You cancelled the payment process before completing your order. This could happen if you:
            </p>
            <ul className="text-left text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                <span>Clicked the back button during checkout</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                <span>Closed the payment window</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                <span>Decided to review your order again</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                <span>Encountered a technical issue</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6 sm:mb-8">
            <button
              onClick={onReturnToCart}
              className="h-12 px-8 rounded-xl font-semibold text-sm shadow-md shadow-blue-100 dark:shadow-none bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center justify-center gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              RETURN TO CART
            </button>

            <button
              onClick={onContinueShopping}
              className="h-12 px-8 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold text-sm text-gray-700 dark:text-gray-300 transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              <ArrowLeft className="h-4 w-4" />
              CONTINUE SHOPPING
            </button>
          </div>

          {/* Help Section */}
          {onContactSupport && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <p>
                NEED ASSISTANCE?{' '}
                <button
                  onClick={onContactSupport}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold uppercase tracking-wider"
                >
                  CONTACT SUPPORT
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
