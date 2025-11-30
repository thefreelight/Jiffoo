/**
 * 订单取消页面组件
 * 显示订单取消/支付取消信息
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          {/* Cancelled Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.6, type: "spring" }}
            className="mb-8"
          >
            <XCircle className="h-24 w-24 text-orange-500 mx-auto" />
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold text-orange-600 mb-4">Payment Cancelled</h1>
            <p className="text-xl text-muted-foreground">
              Your payment was cancelled. No charges were made to your account.
            </p>
          </motion.div>

          {/* Information Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border p-6 mb-8"
          >
            <div className="space-y-4 text-left">
              <div className="flex items-start gap-3">
                <ShoppingCart className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="font-medium mb-1">Your cart is still saved</p>
                  <p className="text-sm text-muted-foreground">
                    All items remain in your cart and you can complete your purchase anytime
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <HelpCircle className="h-5 w-5 text-purple-500 mt-0.5" />
                <div>
                  <p className="font-medium mb-1">Need help?</p>
                  <p className="text-sm text-muted-foreground">
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
            className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border p-6 mb-8"
          >
            <h2 className="text-xl font-semibold mb-4">What Happened?</h2>
            <p className="text-muted-foreground text-left mb-4">
              You cancelled the payment process before completing your order. This could happen if you:
            </p>
            <ul className="text-left text-muted-foreground space-y-2 list-disc list-inside">
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
            <Button
              size="lg"
              onClick={onReturnToCart}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Return to Cart
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={onContinueShopping}
            >
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
              className="mt-8 text-sm text-muted-foreground"
            >
              <p>
                Need assistance?{' '}
                <button
                  onClick={onContactSupport}
                  className="text-primary hover:underline font-medium"
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

