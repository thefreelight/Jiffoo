/**
 * 订单成功页面组件
 * 显示订单成功确认信息
 */

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Package, Mail, ArrowRight } from 'lucide-react';
import type { OrderSuccessPageProps } from '../../../../shared/src/types/theme';
import { Button } from '../ui/Button';

export function OrderSuccessPage({
  orderNumber,
  config,
  onContinueShopping,
  onViewOrders,
}: OrderSuccessPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.6, type: "spring" }}
            className="mb-8"
          >
            <CheckCircle className="h-24 w-24 text-green-500 mx-auto" />
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold text-green-600 mb-4">Order Successful!</h1>
            <p className="text-xl text-muted-foreground">Thank you for your purchase. Your order has been confirmed.</p>
          </motion.div>

          {/* Order Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border p-6 mb-8"
          >
            <div className="text-center mb-6">
              <p className="text-sm text-muted-foreground mb-2">Order Number</p>
              <p className="text-2xl font-bold font-mono">{orderNumber}</p>
            </div>

            <div className="space-y-4 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <p>Your payment has been processed successfully</p>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-blue-500 mt-0.5" />
                <p>Order confirmation email sent to your inbox</p>
              </div>

              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-orange-500 mt-0.5" />
                <p>Tracking information will be sent to your email</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium">Estimated Delivery</span>
                <span className="text-primary font-semibold">3-5 business days</span>
              </div>
            </div>
          </motion.div>

          {/* What's Next */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border p-6 mb-8"
          >
            <h2 className="text-xl font-semibold mb-6">What's Next?</h2>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">1</span>
                </div>
                <div className="text-left">
                  <h3 className="font-medium mb-1">Order Confirmation</h3>
                  <p className="text-sm text-muted-foreground">You'll receive an email confirmation shortly</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-orange-600 dark:text-orange-400 font-semibold text-sm">2</span>
                </div>
                <div className="text-left">
                  <h3 className="font-medium mb-1">Processing</h3>
                  <p className="text-sm text-muted-foreground">We'll prepare your order for shipment</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-green-600 dark:text-green-400 font-semibold text-sm">3</span>
                </div>
                <div className="text-left">
                  <h3 className="font-medium mb-1">Shipping</h3>
                  <p className="text-sm text-muted-foreground">Your order will be shipped and you'll get tracking info</p>
                </div>
              </div>
            </div>
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
              onClick={onContinueShopping}
            >
              Continue Shopping
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={onViewOrders}
            >
              View Orders
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

