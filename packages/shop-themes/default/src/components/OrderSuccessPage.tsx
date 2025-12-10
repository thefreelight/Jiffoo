/**
 * 订单成功页面组件
 * 显示订单成功确认信息
 * Uses @jiffoo/ui design system.
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
    <div className="min-h-screen bg-neutral-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.6, type: "spring" }}
            className="mb-8"
          >
            <div className="w-24 h-24 rounded-full bg-success-100 flex items-center justify-center mx-auto">
              <CheckCircle className="h-12 w-12 text-success-600" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-bold text-success-600 mb-4">Order Successful!</h1>
            <p className="text-xl text-neutral-500">Thank you for your purchase. Your order has been confirmed.</p>
          </motion.div>

          {/* Order Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 mb-8"
          >
            <div className="text-center mb-6">
              <p className="text-sm text-neutral-500 mb-2">Order Number</p>
              <p className="text-2xl font-bold font-mono text-neutral-900">{orderNumber}</p>
            </div>

            <div className="space-y-4 text-left">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-success-50 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-4 w-4 text-success-600" />
                </div>
                <p className="text-neutral-700 pt-1">Your payment has been processed successfully</p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-4 w-4 text-brand-600" />
                </div>
                <p className="text-neutral-700 pt-1">Order confirmation email sent to your inbox</p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-warning-50 flex items-center justify-center flex-shrink-0">
                  <Package className="h-4 w-4 text-warning-600" />
                </div>
                <p className="text-neutral-700 pt-1">Tracking information will be sent to your email</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-neutral-50 rounded-xl">
              <div className="flex justify-between items-center">
                <span className="font-medium text-neutral-700">Estimated Delivery</span>
                <span className="text-brand-600 font-semibold">3-5 business days</span>
              </div>
            </div>
          </motion.div>

          {/* What's Next */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 mb-8"
          >
            <h2 className="text-xl font-semibold text-neutral-900 mb-6">What's Next?</h2>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-brand-600 font-semibold text-sm">1</span>
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-neutral-900 mb-1">Order Confirmation</h3>
                  <p className="text-sm text-neutral-500">You'll receive an email confirmation shortly</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-warning-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-warning-600 font-semibold text-sm">2</span>
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-neutral-900 mb-1">Processing</h3>
                  <p className="text-sm text-neutral-500">We'll prepare your order for shipment</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-success-600 font-semibold text-sm">3</span>
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-neutral-900 mb-1">Shipping</h3>
                  <p className="text-sm text-neutral-500">Your order will be shipped and you'll get tracking info</p>
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
            <Button size="lg" onClick={onContinueShopping}>
              Continue Shopping
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>

            <Button variant="outline" size="lg" onClick={onViewOrders} className="rounded-xl">
              View Orders
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

