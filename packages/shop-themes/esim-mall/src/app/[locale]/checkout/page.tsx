'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuthGuard } from '../../../components/AuthGuard';
import { cartApi, ordersApi, paymentApi, type Cart, type OrderAddress, type CreateOrderItem } from '../../../lib/api';

function CheckoutContent() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';

  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [deviceBrand, setDeviceBrand] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [isCompatible, setIsCompatible] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvc, setCvc] = useState('');
  const [saveCard, setSaveCard] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Fetch cart on mount
  useEffect(() => {
    async function fetchCart() {
      setIsLoading(true);
      setError(null);
      try {
        const cartData = await cartApi.getCart();
        setCart(cartData);
      } catch (err) {
        console.error('Failed to fetch cart:', err);
        setError(err instanceof Error ? err.message : 'Failed to load cart');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCart();
  }, [locale, router]);

  // Handle place order
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isCompatible) {
      setError('Please confirm your device is eSIM compatible');
      return;
    }

    if (!agreeTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    if (!cart || cart.items.length === 0) {
      setError('Your cart is empty');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create order with variantId
      const orderResponse = await ordersApi.createOrder({
        items: cart.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          variantId: item.variantId, // IMPORTANT: Include variantId
        })),
        shippingAddress: {
          firstName: firstName,
          lastName: lastName,
          phone: phone,
          address: 'N/A', // eSIM doesn't need physical address
          city: 'N/A',
          state: 'N/A',
          country: 'N/A',
          postalCode: '00000'
        },
      });
      if (!orderResponse?.id) {
        throw new Error('Failed to create order');
      }
      const orderId = orderResponse.id;

      // 2. Create payment session
      const paymentResponse = await paymentApi.createSession({
        paymentMethod: paymentMethod,
        orderId: orderId,
        successUrl: `${window.location.origin}/${locale}/order-success?orderId=${orderId}`,
        cancelUrl: `${window.location.origin}/${locale}/checkout`
      });
      const paymentUrl = paymentResponse?.url;

      if (paymentUrl) {
        window.location.href = paymentUrl;
      } else {
        // If no payment URL (e.g., mock payment), redirect to success
        router.push(`/${locale}/order-success?orderId=${orderId}`);
      }
    } catch (err) {
      console.error('Failed to create order:', err);
      setError(err instanceof Error ? err.message : 'Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gray-100 py-2">
          <div className="container mx-auto px-4">
            <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
          </div>
        </div>
        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className="h-8 bg-gray-200 rounded w-32 mx-auto mb-8 animate-pulse"></div>
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="lg:w-2/3 space-y-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
                    <div className="h-12 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
              <div className="lg:w-1/3">
                <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
                  <div className="h-24 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const primaryItem = cart?.items?.[0];
  const orderSummary = {
    image: primaryItem?.productImage || 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=800&q=80',
    name: primaryItem?.productName || 'eSIM Package',
    validity: primaryItem?.variantName || 'Travel Plan',
    rating: 4.8,
    price: Number((cart?.subtotal ?? 0).toFixed(2)),
    tax: Number((cart?.tax ?? 0).toFixed(2)),
    total: Number((cart?.total ?? 0).toFixed(2)),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-gray-100 py-2">
        <div className="container mx-auto px-4">
          <nav className="flex text-sm">
            <button onClick={() => router.push(`/${locale}`)} className="text-gray-500 hover:text-blue-600">Home</button>
            <span className="mx-2 text-gray-500">/</span>
            <button onClick={() => router.push(`/${locale}/products`)} className="text-gray-500 hover:text-blue-600">eSIM Packages</button>
            <span className="mx-2 text-gray-500">/</span>
            <button onClick={() => router.push(`/${locale}/products/1`)} className="text-gray-500 hover:text-blue-600">Japan 5GB eSIM</button>
            <span className="mx-2 text-gray-500">/</span>
            <span className="text-gray-800 font-medium">Checkout</span>
          </nav>
        </div>
      </div>

      {/* Checkout Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-8 text-center">Checkout</h1>

          <form onSubmit={handlePlaceOrder}>
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Checkout Form */}
              <div className="lg:w-2/3">
                {/* Account Information */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4">Account Information</h2>

                  <div className="grid grid-cols-1 gap-6 mb-6">
                    <p className="text-gray-600">Already have an account? <button type="button" onClick={() => router.push(`/${locale}/auth/login`)} className="text-blue-600 font-medium">Log in</button></p>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="your@email.com"
                        required
                      />
                      <p className="mt-1 text-sm text-gray-500">Your eSIM will be delivered to this email address</p>
                    </div>
                  </div>
                </div>

                {/* Device Information */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4">Device Information</h2>
                  <p className="text-gray-600 text-sm mb-4">Please confirm your device is eSIM compatible and network unlocked.</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div>
                      <label htmlFor="device-brand" className="block text-sm font-medium text-gray-700 mb-1">Device Brand *</label>
                      <select
                        id="device-brand"
                        value={deviceBrand}
                        onChange={(e) => setDeviceBrand(e.target.value)}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select Brand</option>
                        <option value="apple">Apple</option>
                        <option value="samsung">Samsung</option>
                        <option value="google">Google</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="device-model" className="block text-sm font-medium text-gray-700 mb-1">Device Model *</label>
                      <select
                        id="device-model"
                        value={deviceModel}
                        onChange={(e) => setDeviceModel(e.target.value)}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select Model</option>
                        {deviceBrand === 'apple' && (
                          <>
                            <option value="iphone-14-pro">iPhone 14 Pro</option>
                            <option value="iphone-14">iPhone 14</option>
                            <option value="iphone-13">iPhone 13</option>
                          </>
                        )}
                        {deviceBrand !== 'apple' && <option value="other">Generic Compatibility</option>}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      id="compatibility"
                      checked={isCompatible}
                      onChange={(e) => setIsCompatible(e.target.checked)}
                      className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      required
                    />
                    <label htmlFor="compatibility" className="ml-2 text-sm text-gray-600">
                      I confirm that my device is eSIM compatible and is not network locked.
                    </label>
                  </div>
                </div>

                {/* Traveler Information */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4">Traveler Information</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label htmlFor="first-name" className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                      <input
                        type="text"
                        id="first-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="last-name" className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                      <input
                        type="text"
                        id="last-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="+1 (123) 456-7890"
                      />
                    </div>

                    {/* Travel Date - 隐藏，等待 eSIM 插件实现 */}
                    {/* <div>
                      <label htmlFor="travel-date" className="block text-sm font-medium text-gray-700 mb-1">Travel Date</label>
                      <input type="date" id="travel-date" className="block w-full px-4 py-3 border border-gray-300 rounded-md" />
                    </div> */}
                  </div>
                </div>

                {/* Payment Method */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-semibold mb-4">Payment Method</h2>

                  <div className="mb-6">
                    <div className="flex space-x-4 mb-4">
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="card-payment"
                          name="payment-method"
                          checked={paymentMethod === 'card'}
                          onChange={() => setPaymentMethod('card')}
                          className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <label htmlFor="card-payment" className="ml-2 text-gray-700">Credit/Debit Card</label>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="paypal-payment"
                          name="payment-method"
                          checked={paymentMethod === 'paypal'}
                          onChange={() => setPaymentMethod('paypal')}
                          className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <label htmlFor="paypal-payment" className="ml-2 text-gray-700">PayPal</label>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="apple-payment"
                          name="payment-method"
                          checked={paymentMethod === 'apple'}
                          onChange={() => setPaymentMethod('apple')}
                          className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <label htmlFor="apple-payment" className="ml-2 text-gray-700">Apple Pay</label>
                      </div>
                    </div>

                    {paymentMethod === 'card' && (
                      <div className="grid grid-cols-1 gap-6">
                        <div>
                          <label htmlFor="card-number" className="block text-sm font-medium text-gray-700 mb-1">Card Number *</label>
                          <div className="relative">
                            <input
                              type="text"
                              id="card-number"
                              value={cardNumber}
                              onChange={(e) => setCardNumber(e.target.value)}
                              className="block w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="1234 5678 9012 3456"
                              required
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                              <i className="fab fa-cc-visa text-gray-400 text-xl"></i>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="expiry-date" className="block text-sm font-medium text-gray-700 mb-1">Expiry Date *</label>
                            <input
                              type="text"
                              id="expiry-date"
                              value={expiryDate}
                              onChange={(e) => setExpiryDate(e.target.value)}
                              className="block w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="MM/YY"
                              required
                            />
                          </div>

                          <div>
                            <label htmlFor="cvc" className="block text-sm font-medium text-gray-700 mb-1">CVC/CVV *</label>
                            <div className="relative">
                              <input
                                type="text"
                                id="cvc"
                                value={cvc}
                                onChange={(e) => setCvc(e.target.value)}
                                className="block w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="123"
                                required
                              />
                              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                <i className="far fa-question-circle text-gray-400"></i>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center mb-4">
                      <input
                        type="checkbox"
                        id="save-card"
                        checked={saveCard}
                        onChange={(e) => setSaveCard(e.target.checked)}
                        className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <label htmlFor="save-card" className="ml-2 text-gray-700">Save this card for future purchases</label>
                    </div>

                    <div className="flex items-center mb-4">
                      <input
                        type="checkbox"
                        id="terms"
                        checked={agreeTerms}
                        onChange={(e) => setAgreeTerms(e.target.checked)}
                        className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                        required
                      />
                      <label htmlFor="terms" className="ml-2 text-gray-700">
                        I agree to the <button type="button" className="text-blue-600">Terms of Service</button> and <button type="button" className="text-blue-600">Privacy Policy</button>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Summary */}
              <div className="lg:w-1/3">
                <div className="bg-white rounded-lg shadow-sm p-6 sticky top-24">
                  <h2 className="text-xl font-semibold mb-4">Order Summary</h2>

                  <div className="border-b border-gray-200 pb-4 mb-4">
                    <div className="flex items-center mb-4">
                      <img src={orderSummary.image} alt={orderSummary.name} className="w-16 h-16 object-cover rounded-md mr-4" />
                      <div>
                        <h3 className="font-medium">{orderSummary.name}</h3>
                        <p className="text-sm text-gray-600">{orderSummary.validity}</p>
                        <div className="flex items-center text-yellow-400 text-xs mt-1">
                          {[...Array(5)].map((_, i) => (
                            <i
                              key={i}
                              className={`fas ${i < Math.floor(orderSummary.rating) ? 'fa-star' : orderSummary.rating % 1 !== 0 && i === Math.floor(orderSummary.rating) ? 'fa-star-half-alt' : 'fa-star text-gray-300'}`}
                            ></i>
                          ))}
                          <span className="ml-1 text-gray-600">{orderSummary.rating}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Price</span>
                      <span>${orderSummary.price}</span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span>${orderSummary.price}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax</span>
                      <span>${orderSummary.tax}</span>
                    </div>

                    <div className="flex justify-between font-medium text-lg pt-4 border-t border-gray-200">
                      <span>Total</span>
                      <span>${orderSummary.total}</span>
                    </div>
                  </div>

                  {/* Promo Code */}
                  <div className="mt-6 mb-6">
                    <label htmlFor="promo-code" className="block text-sm font-medium text-gray-700 mb-1">Promo Code</label>
                    <div className="flex">
                      <input
                        type="text"
                        id="promo-code"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Enter code"
                      />
                      <button type="button" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-r-md transition">Apply</button>
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      'Complete Purchase'
                    )}
                  </button>

                  <div className="text-center text-sm text-gray-500 mb-4">
                    <p>You'll receive your eSIM via email immediately after purchase</p>
                  </div>

                  <div className="flex items-center justify-center space-x-4">
                    <i className="fab fa-cc-visa text-2xl text-gray-400"></i>
                    <i className="fab fa-cc-mastercard text-2xl text-gray-400"></i>
                    <i className="fab fa-cc-paypal text-2xl text-gray-400"></i>
                    <i className="fab fa-cc-apple-pay text-2xl text-gray-400"></i>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <AuthGuard>
      <CheckoutContent />
    </AuthGuard>
  );
}
