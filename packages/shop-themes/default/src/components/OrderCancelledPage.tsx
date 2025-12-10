/**
 * 订单取消页面组件
 * 显示订单取消/支付取消信息
 * Uses @jiffoo/ui design system.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { XCircle, ArrowLeft, ShoppingCart, HelpCircle } from 'lucide-react';
import type { OrderCancelledPageProps } from '../../../../shared/src/types/theme';
import { Button } from '../ui/Button';

export function OrderCancelledPage({
  config,
  onReturnToCart,
  onContinueShopping,
  onContactSupport,
}: OrderCancelledPageProps) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          {/* Cancelled Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.6, type: "spring" }}
            className="mb-8"
          >
            <div className="w-24 h-24 rounded-full bg-warning-100 flex items-center justify-center mx-auto">
              <XCircle className="h-12 w-12 text-warning-600" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold text-warning-600 mb-4">Payment Cancelled</h1>
            <p className="text-xl text-neutral-500">
              Your payment was cancelled. No charges were made to your account.
            </p>
          </motion.div>

          {/* Information Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 mb-8"
          >
            <div className="space-y-4 text-left">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <ShoppingCart className="h-4 w-4 text-brand-600" />
                </div>
                <div>
                  <p className="font-medium text-neutral-900 mb-1">Your cart is still saved</p>
                  <p className="text-sm text-neutral-500">
                    All items remain in your cart and you can complete your purchase anytime
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                  <HelpCircle className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-neutral-900 mb-1">Need help?</p>
                  <p className="text-sm text-neutral-500">
                    If you encountered any issues during checkout, please contact our support team
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* What Happened */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 mb-8"
          >
            <h2 className="text-xl font-semibold text-neutral-900 mb-4">What Happened?</h2>
            <p className="text-neutral-500 text-left mb-4">
              You cancelled the payment process before completing your order. This could happen if you:
            </p>
            <ul className="text-left text-neutral-500 space-y-2 list-disc list-inside">
              <li>Clicked the back button during checkout</li>
              <li>Closed the payment window</li>
              <li>Decided to review your order again</li>
              <li>Encountered a technical issue</li>
            </ul>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button size="lg" onClick={onReturnToCart}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Return to Cart
            </Button>

            <Button variant="outline" size="lg" onClick={onContinueShopping} className="rounded-xl">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Continue Shopping
            </Button>
          </motion.div>

          {/* Help Section */}
          {onContactSupport && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.0 }}
              className="mt-8 text-sm text-neutral-500"
            >
              <p>
                Need assistance?{' '}
                <button
                  onClick={onContactSupport}
                  className="text-brand-600 hover:underline font-medium"
                >
                  Contact Support
                </button>
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

