/**
 * Checkout Page Component
 * Displays checkout form and order summary
 * Uses @jiffoo/ui design system.
 */

import React from 'react';
import { ArrowLeft, CreditCard, Truck, Lock, Wallet } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { CheckoutPageProps } from 'shared/src/types/theme';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export function CheckoutPage({
  cart,
  isLoading,
  isProcessing,
  config,
  onSubmit,
  onBack,
}: CheckoutPageProps) {
  const [formData, setFormData] = React.useState({
    email: '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    postalCode: '',
    country: '',
    phone: '',
    paymentMethod: 'stripe',
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    if (!formData.address) newErrors.address = 'Address is required';
    if (!formData.city) newErrors.city = 'City is required';
    if (!formData.postalCode) newErrors.postalCode = 'Postal code is required';
    if (!formData.country) newErrors.country = 'Country is required';
    if (!formData.phone) newErrors.phone = 'Phone number is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    await onSubmit(formData);
  };

  const inputStyles = cn(
    'w-full px-4 py-3 rounded-xl border border-neutral-200',
    'bg-white text-neutral-900 placeholder:text-neutral-400',
    'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
    'transition-all duration-150'
  );

  const errorInputStyles = 'border-error-300 focus:ring-error-500/20 focus:border-error-500';

  return (
    <div className="min-h-screen bg-neutral-50 pt-20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" onClick={onBack} className="rounded-xl">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold text-neutral-900">Checkout</h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Checkout form */}
            <div className="lg:col-span-2 space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Shipping Information */}
                <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm">
                  <div className="p-6">
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-3 text-neutral-900">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                        <Truck className="h-5 w-5 text-brand-600" />
                      </div>
                      Shipping Information
                    </h2>

                    <div className="space-y-4">
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-2">Email *</label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className={cn(inputStyles, errors.email && errorInputStyles)}
                          placeholder="your@email.com"
                        />
                        {errors.email && <p className="text-error-600 text-sm mt-1">{errors.email}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="firstName" className="block text-sm font-medium text-neutral-700 mb-2">First Name *</label>
                          <input
                            type="text"
                            id="firstName"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            className={cn(inputStyles, errors.firstName && errorInputStyles)}
                          />
                          {errors.firstName && <p className="text-error-600 text-sm mt-1">{errors.firstName}</p>}
                        </div>
                        <div>
                          <label htmlFor="lastName" className="block text-sm font-medium text-neutral-700 mb-2">Last Name *</label>
                          <input
                            type="text"
                            id="lastName"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            className={cn(inputStyles, errors.lastName && errorInputStyles)}
                          />
                          {errors.lastName && <p className="text-error-600 text-sm mt-1">{errors.lastName}</p>}
                        </div>
                      </div>

                      <div>
                        <label htmlFor="address" className="block text-sm font-medium text-neutral-700 mb-2">Address *</label>
                        <input
                          type="text"
                          id="address"
                          name="address"
                          value={formData.address}
                          onChange={handleChange}
                          className={cn(inputStyles, errors.address && errorInputStyles)}
                          placeholder="Street address"
                        />
                        {errors.address && <p className="text-error-600 text-sm mt-1">{errors.address}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="city" className="block text-sm font-medium text-neutral-700 mb-2">City *</label>
                          <input
                            type="text"
                            id="city"
                            name="city"
                            value={formData.city}
                            onChange={handleChange}
                            className={cn(inputStyles, errors.city && errorInputStyles)}
                          />
                          {errors.city && <p className="text-error-600 text-sm mt-1">{errors.city}</p>}
                        </div>
                        <div>
                          <label htmlFor="postalCode" className="block text-sm font-medium text-neutral-700 mb-2">Postal Code *</label>
                          <input
                            type="text"
                            id="postalCode"
                            name="postalCode"
                            value={formData.postalCode}
                            onChange={handleChange}
                            className={cn(inputStyles, errors.postalCode && errorInputStyles)}
                          />
                          {errors.postalCode && <p className="text-error-600 text-sm mt-1">{errors.postalCode}</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="country" className="block text-sm font-medium text-neutral-700 mb-2">Country *</label>
                          <select
                            id="country"
                            name="country"
                            value={formData.country}
                            onChange={handleChange}
                            className={cn(inputStyles, errors.country && errorInputStyles)}
                          >
                            <option value="">Select a country</option>
                            <option value="CN">China</option>
                            <option value="US">United States</option>
                            <option value="UK">United Kingdom</option>
                            <option value="CA">Canada</option>
                            <option value="AU">Australia</option>
                          </select>
                          {errors.country && <p className="text-error-600 text-sm mt-1">{errors.country}</p>}
                        </div>
                        <div>
                          <label htmlFor="phone" className="block text-sm font-medium text-neutral-700 mb-2">Phone Number *</label>
                          <input
                            type="tel"
                            id="phone"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            className={cn(inputStyles, errors.phone && errorInputStyles)}
                          />
                          {errors.phone && <p className="text-error-600 text-sm mt-1">{errors.phone}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm">
                  <div className="p-6">
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-3 text-neutral-900">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-brand-600" />
                      </div>
                      Payment Method
                    </h2>

                    <div className="space-y-3">
                      <label className={cn(
                        'flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all',
                        formData.paymentMethod === 'stripe'
                          ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20'
                          : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                      )}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="stripe"
                          checked={formData.paymentMethod === 'stripe'}
                          onChange={handleChange}
                          className="w-4 h-4 text-brand-600"
                        />
                        <CreditCard className="h-5 w-5 text-neutral-600" />
                        <span className="font-medium text-neutral-900">Credit/Debit Card</span>
                      </label>

                      <label className={cn(
                        'flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all',
                        formData.paymentMethod === 'paypal'
                          ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20'
                          : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                      )}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="paypal"
                          checked={formData.paymentMethod === 'paypal'}
                          onChange={handleChange}
                          className="w-4 h-4 text-brand-600"
                        />
                        <Wallet className="h-5 w-5 text-neutral-600" />
                        <span className="font-medium text-neutral-900">PayPal</span>
                      </label>

                      <label className={cn(
                        'flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all',
                        formData.paymentMethod === 'alipay'
                          ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20'
                          : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                      )}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="alipay"
                          checked={formData.paymentMethod === 'alipay'}
                          onChange={handleChange}
                          className="w-4 h-4 text-brand-600"
                        />
                        <Wallet className="h-5 w-5 text-neutral-600" />
                        <span className="font-medium text-neutral-900">Alipay</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isLoading || isProcessing}
                  size="lg"
                  className="w-full shadow-brand-md"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  {isProcessing ? 'Processing...' : 'Place Order'}
                </Button>

                <p className="text-sm text-neutral-500 text-center mt-4">
                  By clicking "Place Order", you agree to our Terms of Service and Privacy Policy
                </p>
              </form>
            </div>

            {/* Right: Order summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm sticky top-8">
                <div className="p-6">
                  <h2 className="text-xl font-semibold mb-6 text-neutral-900">Order Summary</h2>

                  {/* Product list */}
                  <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
                    {cart.items.map((item) => (
                      <div key={item.id} className="flex gap-3">
                        <div className="relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-neutral-100">
                          <img
                            src={item.productImage || '/placeholder-product.jpg'}
                            alt={item.productName}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute -top-1 -right-1 bg-brand-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                            {item.quantity}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate text-neutral-900">{item.productName}</p>
                          {item.variantName && (
                            <p className="text-xs text-neutral-500">{item.variantName}</p>
                          )}
                          <p className="text-sm font-semibold text-brand-600">${item.subtotal.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Price breakdown */}
                  <div className="space-y-3 mb-6 border-t border-neutral-100 pt-4">
                    <div className="flex justify-between text-sm text-neutral-500">
                      <span>Subtotal</span>
                      <span className="text-neutral-900">${cart.subtotal.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between text-sm text-neutral-500">
                      <span>Shipping</span>
                      <span className="text-neutral-900">
                        {cart.shipping === 0 ? 'Free' : `$${cart.shipping.toFixed(2)}`}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm text-neutral-500">
                      <span>Tax</span>
                      <span className="text-neutral-900">${cart.tax.toFixed(2)}</span>
                    </div>

                    {cart.discount > 0 && (
                      <div className="flex justify-between text-sm text-success-600">
                        <span>Discount</span>
                        <span>-${cart.discount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="border-t border-neutral-100 pt-3">
                      <div className="flex justify-between text-lg font-bold">
                        <span className="text-neutral-900">Total</span>
                        <span className="text-brand-600">${cart.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Security notice */}
                  <div className="flex items-start gap-3 p-4 bg-success-50 rounded-xl">
                    <Lock className="h-4 w-4 text-success-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-success-700">
                      Your payment information is encrypted and secure. We do not store your credit card details.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
