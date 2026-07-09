/**
 * Order Success Page — TravelPass Design
 * eSIM-themed order confirmation with QR delivery steps.
 */

import React from 'react';
import type { OrderSuccessPageProps } from '../types';

export const OrderSuccessPage = React.memo(function OrderSuccessPage({
  orderNumber,
  config,
  onContinueShopping,
  onViewOrders,
}: OrderSuccessPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 pt-28 pb-12">
        <div className="max-w-2xl mx-auto text-center">
          {/* Success Icon */}
          <div className="mb-8">
            <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <i className="fas fa-check-circle text-green-600 text-5xl" />
            </div>
          </div>

          {/* Title */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-green-600 mb-3">eSIM Order Confirmed!</h1>
            <p className="text-lg text-gray-600">Your eSIM package is being prepared for activation.</p>
          </div>

          {/* Order Details */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="text-center mb-6">
              <p className="text-sm text-gray-600 mb-1">Order Number</p>
              <p className="text-2xl font-bold font-mono text-gray-900">{orderNumber}</p>
            </div>

            <div className="space-y-4 text-left">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-check-circle text-green-600 text-sm" />
                </div>
                <p className="text-gray-700 pt-1">Your payment has been processed successfully</p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-envelope text-blue-600 text-sm" />
                </div>
                <p className="text-gray-700 pt-1">eSIM QR code and activation instructions sent to your email</p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-qrcode text-blue-600 text-sm" />
                </div>
                <p className="text-gray-700 pt-1">Scan the QR code with your device to install the eSIM profile</p>
              </div>
            </div>
          </div>

          {/* eSIM Delivery Steps */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">How to Activate Your eSIM</h2>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-semibold text-sm">1</span>
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-gray-800 mb-1">Check Your Email</h3>
                  <p className="text-sm text-gray-600">You&apos;ll receive an email with your eSIM QR code within minutes</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-semibold text-sm">2</span>
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-gray-800 mb-1">Scan QR Code</h3>
                  <p className="text-sm text-gray-600">Go to Settings &gt; Cellular &gt; Add eSIM and scan the QR code</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-semibold text-sm">3</span>
                </div>
                <div className="text-left">
                  <h3 className="font-medium text-gray-800 mb-1">Activate at Destination</h3>
                  <p className="text-sm text-gray-600">Turn on data roaming when you arrive — your eSIM connects automatically</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onViewOrders}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md px-6 py-3 transition-colors"
            >
              <i className="fas fa-box mr-2" />
              View My eSIMs
            </button>

            <button
              onClick={onContinueShopping}
              className="border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-md px-6 py-3 transition-colors"
            >
              <i className="fas fa-shopping-cart mr-2" />
              Browse More Packages
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
