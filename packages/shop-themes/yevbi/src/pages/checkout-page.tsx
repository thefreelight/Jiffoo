'use client';

import { useState } from 'react';
import Link from 'next/link';

export function CheckoutPage() {
    const [paymentMethod, setPaymentMethod] = useState('card');

    const orderItem = {
        name: 'Japan 5GB eSIM',
        data: '5GB',
        validity: '14 Days',
        price: 24.99,
    };

    const tax = orderItem.price * 0.1;
    const total = orderItem.price + tax;

    return (
        <>
            {/* Page Header */}
            <section className="bg-blue-600 py-12 mt-16">
                <div className="container mx-auto px-4">
                    <h1 className="text-3xl font-bold text-white text-center">Checkout</h1>
                    <p className="text-center text-white/90 mt-2">Complete your purchase securely</p>
                </div>
            </section>

            <section className="py-12 bg-gray-50 min-h-[60vh]">
                <div className="container mx-auto px-4">
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Checkout Form */}
                        <div className="lg:w-2/3">
                            {/* Contact Information */}
                            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                                <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                        <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                        <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                        <input type="email" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Your eSIM QR code will be sent here" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (Optional)</label>
                                        <input type="tel" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>
                                </div>
                            </div>

                            {/* Payment Method */}
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <h2 className="text-xl font-semibold mb-4">Payment Method</h2>

                                <div className="space-y-4">
                                    <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:border-blue-500">
                                        <input
                                            type="radio"
                                            name="payment"
                                            value="card"
                                            checked={paymentMethod === 'card'}
                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                            className="mr-3"
                                        />
                                        <span className="font-medium">Credit / Debit Card</span>
                                    </label>

                                    <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:border-blue-500">
                                        <input
                                            type="radio"
                                            name="payment"
                                            value="paypal"
                                            checked={paymentMethod === 'paypal'}
                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                            className="mr-3"
                                        />
                                        <span className="font-medium">PayPal</span>
                                    </label>

                                    <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:border-blue-500">
                                        <input
                                            type="radio"
                                            name="payment"
                                            value="applepay"
                                            checked={paymentMethod === 'applepay'}
                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                            className="mr-3"
                                        />
                                        <span className="font-medium">Apple Pay</span>
                                    </label>
                                </div>

                                {paymentMethod === 'card' && (
                                    <div className="mt-6 space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                                            <input type="text" placeholder="1234 5678 9012 3456" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                                                <input type="text" placeholder="MM/YY" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                                                <input type="text" placeholder="123" className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Order Summary */}
                        <div className="lg:w-1/3">
                            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-4">
                                <h2 className="text-xl font-semibold mb-6">Order Summary</h2>

                                <div className="border-b pb-4 mb-4">
                                    <h3 className="font-medium text-gray-800">{orderItem.name}</h3>
                                    <p className="text-sm text-gray-600">{orderItem.data} • {orderItem.validity}</p>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Subtotal</span>
                                        <span className="font-medium">${orderItem.price.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Tax</span>
                                        <span className="font-medium">${tax.toFixed(2)}</span>
                                    </div>
                                    <div className="border-t pt-3 flex justify-between">
                                        <span className="text-lg font-semibold">Total</span>
                                        <span className="text-lg font-bold text-blue-600">${total.toFixed(2)}</span>
                                    </div>
                                </div>

                                <button
                                    className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-3 rounded-md font-medium transition"
                                >
                                    Complete Purchase
                                </button>

                                <p className="text-xs text-gray-500 text-center mt-4">
                                    🔒 Your payment information is encrypted and secure
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}

export default CheckoutPage;
