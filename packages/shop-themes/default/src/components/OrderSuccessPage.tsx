/**
 * Order Success Page Component - Admin Style Design
 */

import React from 'react';
import { CheckCircle, Package, Mail, ArrowRight } from 'lucide-react';
import type { OrderSuccessPageProps } from '../../../../shared/src/types/theme';

export function OrderSuccessPage({
  orderNumber,
  config,
  onContinueShopping,
  onViewOrders,
}: OrderSuccessPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto text-center">
          {/* Success Icon */}
          <div className="mb-8">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle className="h-12 w-12 sm:h-14 sm:w-14 text-green-600 dark:text-green-400" />
            </div>
          </div>

          {/* Title */}
          <div className="mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-full mb-4">
              <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest">ORDER CONFIRMED</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">Order Successful!</h1>
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">THANK YOU FOR YOUR PURCHASE</p>
          </div>

          {/* Order Details */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 sm:p-8 mb-6 sm:mb-8">
            <div className="text-center mb-6 sm:mb-8">
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">ORDER NUMBER</p>
              <p className="text-2xl sm:text-3xl font-bold font-mono text-gray-900 dark:text-white">{orderNumber}</p>
            </div>

            <div className="space-y-4 text-left">
              <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-100 dark:border-green-800">
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-1">PAYMENT PROCESSED</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Your payment has been successfully processed</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-1">CONFIRMATION SENT</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Order confirmation email sent to your inbox</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl border border-yellow-100 dark:border-yellow-800">
                <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                  <Package className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-1">TRACKING INFO</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Tracking information will be sent to your email</p>
                </div>
              </div>
            </div>

            <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-gray-50 dark:bg-slate-700/50 rounded-2xl border border-gray-100 dark:border-slate-600">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">ESTIMATED DELIVERY</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">3-5 BUSINESS DAYS</span>
              </div>
            </div>
          </div>

          {/* What's Next */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 sm:p-8 mb-6 sm:mb-8">
            <div className="flex items-center gap-2 mb-6 sm:mb-8 justify-center">
              <div className="h-4 w-1 bg-blue-600 rounded-full" />
              <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">WHAT'S NEXT</h2>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4 text-left">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">1</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-1">ORDER CONFIRMATION</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">You'll receive an email confirmation shortly</p>
                </div>
              </div>

              <div className="flex items-start gap-4 text-left">
                <div className="w-10 h-10 bg-yellow-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">2</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-1">PROCESSING</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">We'll prepare your order for shipment</p>
                </div>
              </div>

              <div className="flex items-start gap-4 text-left">
                <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">3</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-1">SHIPPING</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Your order will be shipped and you'll get tracking info</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onContinueShopping}
              className="h-12 px-8 rounded-xl font-semibold text-sm shadow-md shadow-blue-100 dark:shadow-none bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center justify-center gap-2"
            >
              CONTINUE SHOPPING
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              onClick={onViewOrders}
              className="h-12 px-8 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold text-sm text-gray-700 dark:text-gray-300 transition-all uppercase tracking-wider"
            >
              VIEW ORDERS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
