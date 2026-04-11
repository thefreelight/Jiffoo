'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';

export default function OrderCancelledPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'en';
  const orderId = searchParams.get('orderId');
  const reason = searchParams.get('reason');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-gray-100 py-2">
        <div className="container mx-auto px-4">
          <nav className="flex text-sm">
            <button onClick={() => router.push(`/${locale}`)} className="text-gray-500 hover:text-blue-600">Home</button>
            <span className="mx-2 text-gray-500">/</span>
            <span className="text-gray-800 font-medium">Order Cancelled</span>
          </nav>
        </div>
      </div>

      {/* Cancelled Content */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            {/* Cancelled Icon */}
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-red-100 rounded-full">
                <i className="fas fa-times-circle text-5xl text-red-500"></i>
              </div>
            </div>

            {/* Cancelled Message */}
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Order Cancelled</h1>
            <p className="text-xl text-gray-600 mb-2">Your order has been cancelled</p>
            {orderId && (
              <p className="text-gray-500 mb-4">Order ID: <span className="font-mono font-medium">{orderId}</span></p>
            )}

            {/* Reason Box */}
            {reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
                <div className="flex items-center justify-center mb-2">
                  <i className="fas fa-info-circle text-red-500 mr-2"></i>
                  <span className="font-medium text-red-700">Cancellation Reason</span>
                </div>
                <p className="text-red-600">{decodeURIComponent(reason)}</p>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-gray-100 rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">What happens next?</h2>
              <ul className="text-left text-gray-600 space-y-3">
                <li className="flex items-start">
                  <i className="fas fa-check text-green-500 mt-1 mr-3"></i>
                  <span>If you were charged, a refund will be processed within 5-10 business days</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check text-green-500 mt-1 mr-3"></i>
                  <span>You'll receive a confirmation email about the cancellation</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check text-green-500 mt-1 mr-3"></i>
                  <span>Your cart items have been preserved - you can try again anytime</span>
                </li>
              </ul>
            </div>

            {/* Common Reasons */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8 text-left">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Common reasons for cancellation</h3>
              <div className="space-y-3">
                <div className="flex items-start">
                  <i className="fas fa-credit-card text-gray-400 mt-1 mr-3"></i>
                  <div>
                    <h4 className="font-medium text-gray-700">Payment issue</h4>
                    <p className="text-sm text-gray-500">Try a different payment method or check your card details</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <i className="fas fa-window-close text-gray-400 mt-1 mr-3"></i>
                  <div>
                    <h4 className="font-medium text-gray-700">Browser closed</h4>
                    <p className="text-sm text-gray-500">The checkout session expired before completion</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <i className="fas fa-user-times text-gray-400 mt-1 mr-3"></i>
                  <div>
                    <h4 className="font-medium text-gray-700">User cancelled</h4>
                    <p className="text-sm text-gray-500">You chose to cancel the payment</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <button
                onClick={() => router.push(`/${locale}/checkout`)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-md font-medium transition"
              >
                <i className="fas fa-redo mr-2"></i>
                Try Again
              </button>
              <button
                onClick={() => router.push(`/${locale}/products`)}
                className="bg-white hover:bg-gray-50 text-gray-700 px-8 py-3 rounded-md font-medium border border-gray-300 transition"
              >
                <i className="fas fa-shopping-bag mr-2"></i>
                Browse Packages
              </button>
            </div>

            {/* Support Link */}
            <div className="text-sm text-gray-500">
              <p>
                Need help?{' '}
                <button
                  onClick={() => router.push(`/${locale}/contact`)}
                  className="text-blue-600 hover:underline"
                >
                  Contact our support team
                </button>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
