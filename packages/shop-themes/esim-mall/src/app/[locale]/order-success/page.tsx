'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ordersApi, type OrderDetail, type OrderItem } from '../../../lib/api';
import { parseESimFulfillmentData, type ESimFulfillmentData } from '../../../lib/esim';

export default function OrderSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'en';
  const orderId = searchParams.get('orderId');

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState(10);

  // Fetch order details
  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) {
        setIsLoading(false);
        return;
      }

      try {
        const orderData = await ordersApi.getOrder(orderId);
        setOrder(orderData);
      } catch (err) {
        console.error('Failed to fetch order:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrder();
  }, [orderId]);

  // Auto redirect countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push(`/${locale}/orders`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [locale, router]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-gray-100 py-2">
        <div className="container mx-auto px-4">
          <nav className="flex text-sm">
            <button onClick={() => router.push(`/${locale}`)} className="text-gray-500 hover:text-blue-600">Home</button>
            <span className="mx-2 text-gray-500">/</span>
            <span className="text-gray-800 font-medium">Order Confirmed</span>
          </nav>
        </div>
      </div>

      {/* Success Content */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            {/* Success Icon */}
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full">
                <i className="fas fa-check-circle text-5xl text-green-500"></i>
              </div>
            </div>

            {/* Success Message */}
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Order Confirmed!</h1>
            <p className="text-xl text-gray-600 mb-2">Thank you for your purchase</p>
            {orderId && (
              <p className="text-gray-500 mb-8">Order ID: <span className="font-mono font-medium">{orderId}</span></p>
            )}

            {/* eSIM Delivery Info */}
            {isLoading ? (
              <div className="bg-blue-50 rounded-lg p-6 mb-8 animate-pulse">
                <div className="h-6 bg-blue-200 rounded w-48 mx-auto mb-4"></div>
                <div className="h-4 bg-blue-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-blue-200 rounded w-3/4 mx-auto"></div>
              </div>
            ) : order && order.items && order.items.length > 0 ? (
              <>
                {order.items.map((item: OrderItem, index: number) => {
                  const fulfillmentData = parseESimFulfillmentData(item.fulfillmentData);

                  return (
                    <div key={item.id || index} className="bg-white rounded-lg shadow-sm p-6 mb-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">{item.productName}</h3>

                      {item.fulfillmentStatus === 'delivered' && fulfillmentData ? (
                        <>
                          {/* QR Code - 由 eSIM 插件提供 */}
                          {fulfillmentData.qrCode && (
                            <div className="mb-6 text-center">
                              <img src={fulfillmentData.qrCode} alt="eSIM QR Code" className="w-64 h-64 mx-auto border rounded-lg" />
                              <p className="text-sm text-gray-600 mt-2">Scan this QR code to install your eSIM</p>
                            </div>
                          )}

                          {/* Manual Installation Info */}
                          {fulfillmentData.lpa && (
                            <div className="bg-gray-50 p-4 rounded-lg mb-4">
                              <h4 className="font-medium mb-2">Manual Installation</h4>
                              <p className="text-sm text-gray-600 mb-2">LPA: <span className="font-mono">{fulfillmentData.lpa}</span></p>
                              {fulfillmentData.activationCode && (
                                <p className="text-sm text-gray-600">Activation Code: <span className="font-mono">{fulfillmentData.activationCode}</span></p>
                              )}
                            </div>
                          )}

                          {/* Installation Instructions */}
                          {fulfillmentData.instructions && (
                            <div className="bg-blue-50 p-4 rounded-lg mb-4">
                              <h4 className="font-medium mb-2">Installation Instructions</h4>
                              {fulfillmentData.instructions.general && (
                                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                                  {fulfillmentData.instructions.general.map((step, i) => (
                                    <li key={i}>{step}</li>
                                  ))}
                                </ol>
                              )}
                            </div>
                          )}

                          {/* Support Info */}
                          {fulfillmentData.support && (
                            <div className="text-sm text-gray-600">
                              {fulfillmentData.support.email && <p>Support Email: {fulfillmentData.support.email}</p>}
                              {fulfillmentData.support.phone && <p>Support Phone: {fulfillmentData.support.phone}</p>}
                            </div>
                          )}
                        </>
                      ) : item.fulfillmentStatus === 'processing' ? (
                        <div className="bg-yellow-50 rounded-lg p-6">
                          <div className="flex items-center justify-center mb-2">
                            <i className="fas fa-clock text-yellow-600 text-2xl mr-3"></i>
                            <h4 className="text-lg font-semibold text-gray-800">Processing Your Order</h4>
                          </div>
                          <p className="text-center text-gray-600">
                            Your eSIM is being prepared. This usually takes a few minutes.
                            Please refresh the page or check your email.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-blue-50 rounded-lg p-6">
                          <div className="flex items-center justify-center mb-2">
                            <i className="fas fa-envelope text-blue-600 text-2xl mr-3"></i>
                            <h4 className="text-lg font-semibold text-gray-800">Check Your Email</h4>
                          </div>
                          <p className="text-center text-gray-600">
                            Your eSIM will be sent to your email address shortly.
                            You can also check your order details for updates.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="bg-blue-50 rounded-lg p-6 mb-8">
                <div className="flex items-center justify-center mb-4">
                  <i className="fas fa-envelope text-blue-600 text-2xl mr-3"></i>
                  <h2 className="text-lg font-semibold text-gray-800">Check Your Email</h2>
                </div>
                <p className="text-gray-600 mb-4 text-center">
                  Your eSIM QR code will be sent to your email address.
                  You can also find it in your order history.
                </p>
                <div className="flex items-center justify-center text-sm text-gray-500">
                  <i className="fas fa-clock mr-2"></i>
                  <span>Delivery is usually instant, but may take up to 5 minutes</span>
                </div>
              </div>
            )}

            {/* Next Steps */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Next Steps</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-blue-600 font-semibold text-sm">1</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800">Open Email</h4>
                    <p className="text-sm text-gray-500">Find the QR code in your inbox</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-blue-600 font-semibold text-sm">2</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800">Scan QR Code</h4>
                    <p className="text-sm text-gray-500">Use your phone's camera</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-blue-600 font-semibold text-sm">3</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800">Activate eSIM</h4>
                    <p className="text-sm text-gray-500">Follow the on-screen steps</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <button
                onClick={() => router.push(`/${locale}/orders${orderId ? `/${orderId}` : ''}`)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-md font-medium transition"
              >
                <i className="fas fa-receipt mr-2"></i>
                View Order Details
              </button>
              <button
                onClick={() => router.push(`/${locale}/products`)}
                className="bg-white hover:bg-gray-50 text-gray-700 px-8 py-3 rounded-md font-medium border border-gray-300 transition"
              >
                <i className="fas fa-shopping-bag mr-2"></i>
                Continue Shopping
              </button>
            </div>

            {/* Auto Redirect Notice */}
            <p className="text-sm text-gray-400">
              Redirecting to your orders in {countdown} seconds...
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
